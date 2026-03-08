/**
 * Server-side RAG Store
 *
 * In-memory store for knowledge bases + documents + real Gemini embeddings
 * (text-embedding-004, 768-dim).  Persists to a local JSON file on disk so
 * documents survive server restarts.
 *
 * Architecture
 * ────────────
 *  • KnowledgeBase  — named collection of documents
 *  • Document       — raw text content (extracted from PDF/TXT/MD)
 *  • Chunk          — 500-char sentence-split pieces with 768-dim embedding
 *
 * Retrieval
 * ─────────
 *  • Semantic : cosine similarity on Gemini embeddings (primary)
 *  • Keyword  : BM25-style term frequency on raw chunk text (fallback / re-rank)
 *  • Hybrid   : linear blend (α=0.7 semantic + 0.3 keyword)
 */

import * as fs from "fs";
import * as path from "path";
import { geminiEmbed, cosineSimilarity } from "./gemini";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RagDocument {
  id: string;
  title: string;
  content: string;          // full extracted text
  source: string;
  uploadedAt: number;
  type: "pdf" | "txt" | "md" | "unknown";
}

export interface RagChunk {
  id: string;
  documentId: string;
  text: string;
  embedding: number[];      // 768-dim Gemini embedding
  chunkIndex: number;
}

export interface RagKnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: RagDocument[];
  chunks: RagChunk[];
  createdAt: number;
  updatedAt: number;
}

export interface RagSearchResult {
  text: string;
  source: string;
  documentId: string;
  documentTitle: string;
  chunkId: string;
  relevanceScore: number;
  citation: string;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const DATA_FILE = path.join(process.cwd(), ".rag-store.json");

function loadFromDisk(): Map<string, RagKnowledgeBase> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, RagKnowledgeBase>;
      return new Map(Object.entries(parsed));
    }
  } catch {
    // corrupt file — start fresh
  }
  return new Map();
}

function saveToDisk(store: Map<string, RagKnowledgeBase>): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(store), null, 2));
  } catch {
    // non-fatal — in-memory store still works
  }
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Split text into overlapping sentence-boundary chunks (~500 chars each).
 */
export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      // keep last `overlap` chars for context continuity
      current = current.slice(-overlap) + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim());

  // If no sentence boundaries found (e.g. code), fall back to char-split
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.slice(i, i + chunkSize));
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// RAG Store
// ---------------------------------------------------------------------------

export class RagStore {
  private kbs: Map<string, RagKnowledgeBase>;

  constructor() {
    this.kbs = loadFromDisk();
  }

  // ── Knowledge Base CRUD ──────────────────────────────────────────────────

  createKB(name: string, description = ""): RagKnowledgeBase {
    const kb: RagKnowledgeBase = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      description,
      documents: [],
      chunks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.kbs.set(kb.id, kb);
    saveToDisk(this.kbs);
    return kb;
  }

  listKBs(): RagKnowledgeBase[] {
    return Array.from(this.kbs.values()).map((kb) => ({
      ...kb,
      chunks: [],          // omit large embedding arrays from list response
    }));
  }

  getKB(kbId: string): RagKnowledgeBase | undefined {
    return this.kbs.get(kbId);
  }

  deleteKB(kbId: string): boolean {
    const deleted = this.kbs.delete(kbId);
    if (deleted) saveToDisk(this.kbs);
    return deleted;
  }

  // ── Document ingestion ───────────────────────────────────────────────────

  /**
   * Add a document to a KB and embed all its chunks via Gemini.
   * Returns the document object once all chunks are embedded.
   */
  async addDocument(
    kbId: string,
    title: string,
    content: string,
    source: string,
    type: RagDocument["type"],
    apiKey: string
  ): Promise<RagDocument> {
    const kb = this.kbs.get(kbId);
    if (!kb) throw new Error(`Knowledge base "${kbId}" not found`);

    const doc: RagDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      content,
      source,
      uploadedAt: Date.now(),
      type,
    };

    kb.documents.push(doc);

    // Chunk + embed
    const rawChunks = chunkText(content);
    let chunkIndex = 0;
    for (const chunkText of rawChunks) {
      let embedding: number[];
      try {
        embedding = await geminiEmbed(apiKey, chunkText);
      } catch {
        // Fallback to zero vector if embedding fails (degraded but functional)
        embedding = new Array(768).fill(0);
      }

      const chunk: RagChunk = {
        id: `chunk_${doc.id}_${chunkIndex}`,
        documentId: doc.id,
        text: chunkText,
        embedding,
        chunkIndex,
      };
      kb.chunks.push(chunk);
      chunkIndex++;
    }

    kb.updatedAt = Date.now();
    this.kbs.set(kbId, kb);
    saveToDisk(this.kbs);
    return doc;
  }

  // ── Retrieval ────────────────────────────────────────────────────────────

  /**
   * Hybrid semantic + keyword search across all chunks in a KB.
   * α = 0.7 semantic weight, 0.3 keyword weight.
   */
  async search(
    kbId: string,
    query: string,
    apiKey: string,
    topK = 5,
    alpha = 0.7
  ): Promise<RagSearchResult[]> {
    const kb = this.kbs.get(kbId);
    if (!kb) throw new Error(`Knowledge base "${kbId}" not found`);
    if (kb.chunks.length === 0) return [];

    // Semantic scores
    let queryEmbedding: number[];
    try {
      queryEmbedding = await geminiEmbed(apiKey, query);
    } catch {
      queryEmbedding = [];
    }

    const semanticScores = new Map<string, number>();
    if (queryEmbedding.length > 0) {
      for (const chunk of kb.chunks) {
        if (chunk.embedding.length > 0) {
          semanticScores.set(chunk.id, cosineSimilarity(queryEmbedding, chunk.embedding));
        }
      }
    }

    // Keyword scores (TF-style)
    const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const keywordScores = new Map<string, number>();
    const maxKw = keywords.length || 1;
    for (const chunk of kb.chunks) {
      const lowerText = chunk.text.toLowerCase();
      let hits = 0;
      for (const kw of keywords) {
        if (lowerText.includes(kw)) hits++;
      }
      keywordScores.set(chunk.id, hits / maxKw);
    }

    // Blend
    const blended = kb.chunks.map((chunk) => {
      const sem = semanticScores.get(chunk.id) ?? 0;
      const kw = keywordScores.get(chunk.id) ?? 0;
      return { chunk, score: alpha * sem + (1 - alpha) * kw };
    });

    blended.sort((a, b) => b.score - a.score);

    return blended.slice(0, topK).map(({ chunk, score }) => {
      const doc = kb.documents.find((d) => d.id === chunk.documentId);
      return {
        text: chunk.text,
        source: doc?.source ?? "Unknown",
        documentId: chunk.documentId,
        documentTitle: doc?.title ?? "Unknown",
        chunkId: chunk.id,
        relevanceScore: score,
        citation: `${doc?.title ?? "Document"} (${doc?.source ?? "Unknown source"})`,
      };
    });
  }

  /**
   * Search across ALL knowledge bases and return merged results.
   */
  async searchAll(
    query: string,
    apiKey: string,
    topK = 5
  ): Promise<RagSearchResult[]> {
    const allResults: RagSearchResult[] = [];
    for (const kb of this.kbs.values()) {
      const results = await this.search(kb.id, query, apiKey, topK);
      allResults.push(...results);
    }
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return allResults.slice(0, topK);
  }
}

// Singleton — shared across all route handlers
export const ragStore = new RagStore();
