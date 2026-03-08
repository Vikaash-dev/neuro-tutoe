/**
 * RAG Pipeline Service
 * Implements Retrieval-Augmented Generation for document-based learning.
 * Inspired by DeepTutor's LightRAG architecture.
 *
 * Embeddings now use real Gemini text-embedding-004 vectors (768-dim) via the
 * server proxy at /api/rag/embed — giving genuine semantic retrieval quality
 * instead of the previous hash-based approximation.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://127.0.0.1:3000";

export interface Document {
  id: string;
  title: string;
  content: string;
  source: string;
  uploadedAt: number;
  type: "pdf" | "txt" | "md";
}

export interface EmbeddingVector {
  documentId: string;
  chunkId: string;
  text: string;
  embedding: number[]; // 768-dim Gemini text-embedding-004 vectors (via /api/rag/embed)
  metadata: Record<string, unknown>;
}

export interface RAGResult {
  text: string;
  source: string;
  documentId: string;
  relevanceScore: number;
  citation: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: Document[];
  embeddings: EmbeddingVector[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getApiKey(): Promise<string> {
  return (await AsyncStorage.getItem("GEMINI_API_KEY")) ?? "";
}

async function apiHeaders(): Promise<Record<string, string>> {
  const key = await getApiKey();
  return {
    "Content-Type": "application/json",
    ...(key ? { "x-gemini-api-key": key } : {}),
  };
}

/**
 * Get a real 768-dim Gemini embedding for `text` via the server proxy.
 * Falls back to a zero vector if the call fails (degraded but non-crashing).
 */
async function getEmbedding(text: string): Promise<number[]> {
  try {
    const res = await fetch(`${API_BASE}/api/rag/embed`, {
      method: "POST",
      headers: await apiHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`embed ${res.status}`);
    const data = await res.json() as { embedding: number[] };
    return data.embedding;
  } catch {
    return new Array(768).fill(0);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// RAG Pipeline Service
// ---------------------------------------------------------------------------

/**
 * RAG Pipeline Service for document-based learning.
 * Handles document upload, real-embedding generation, retrieval, and citation.
 */
export class RAGPipelineService {
  private knowledgeBases: Map<string, KnowledgeBase> = new Map();
  private storageKey = "rag_knowledge_bases";

  constructor() {
    this.loadKnowledgeBases();
  }

  private async loadKnowledgeBases(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.knowledgeBases = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error("Failed to load knowledge bases:", error);
    }
  }

  private async saveKnowledgeBases(): Promise<void> {
    try {
      const data = Object.fromEntries(this.knowledgeBases);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save knowledge bases:", error);
    }
  }

  async createKnowledgeBase(name: string, description: string): Promise<KnowledgeBase> {
    const kb: KnowledgeBase = {
      id: `kb_${Date.now()}`,
      name,
      description,
      documents: [],
      embeddings: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.knowledgeBases.set(kb.id, kb);
    await this.saveKnowledgeBases();
    return kb;
  }

  async addDocument(
    kbId: string,
    title: string,
    content: string,
    type: "pdf" | "txt" | "md",
    source: string
  ): Promise<Document> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);

    const doc: Document = {
      id: `doc_${Date.now()}`,
      title,
      content,
      source,
      uploadedAt: Date.now(),
      type,
    };

    kb.documents.push(doc);
    await this.generateEmbeddings(kbId, doc);

    kb.updatedAt = Date.now();
    this.knowledgeBases.set(kbId, kb);
    await this.saveKnowledgeBases();
    return doc;
  }

  private async generateEmbeddings(kbId: string, doc: Document): Promise<void> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) return;

    const chunks = this.chunkDocument(doc.content);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Use real Gemini embeddings via server proxy
      const embedding = await getEmbedding(chunk);

      kb.embeddings.push({
        documentId: doc.id,
        chunkId: `chunk_${i}`,
        text: chunk,
        embedding,
        metadata: { chunkIndex: i, totalChunks: chunks.length, source: doc.source },
      });
    }
  }

  private chunkDocument(content: string, chunkSize: number = 500): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence + ". ";
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk.trim());
    return chunks.length > 0 ? chunks : [content.slice(0, chunkSize)];
  }

  async retrieve(kbId: string, query: string, topK: number = 5): Promise<RAGResult[]> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);

    const queryEmbedding = await getEmbedding(query);
    const allZero = queryEmbedding.every((v) => v === 0);

    // Keyword scoring — used as fallback when embeddings are unavailable (e.g. server not running)
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const keywordScore = (text: string): number =>
      keywords.reduce((acc, kw) => acc + (text.toLowerCase().includes(kw) ? 1 : 0), 0) / Math.max(keywords.length, 1);

    const results = kb.embeddings.map((emb) => {
      const sem = allZero ? 0 : cosineSimilarity(queryEmbedding, emb.embedding);
      const kw = keywordScore(emb.text);
      const score = allZero ? kw : 0.7 * sem + 0.3 * kw;
      return { emb, score };
    });

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK).map(({ emb, score }) => {
      const doc = kb.documents.find((d) => d.id === emb.documentId);
      return {
        text: emb.text,
        source: doc?.source ?? "Unknown",
        documentId: emb.documentId,
        relevanceScore: score,
        citation: `${doc?.title ?? "Document"} (${doc?.source ?? "Unknown source"})`,
      };
    });
  }

  async hybridSearch(kbId: string, query: string, topK: number = 5): Promise<RAGResult[]> {
    const semanticResults = await this.retrieve(kbId, query, topK * 2);

    const kb = this.knowledgeBases.get(kbId);
    if (!kb) return semanticResults.slice(0, topK);

    const keywords = query.toLowerCase().split(/\s+/);
    const keywordResults = kb.embeddings
      .map((emb) => {
        const lowerText = emb.text.toLowerCase();
        const score = keywords.reduce((acc, kw) => acc + (lowerText.includes(kw) ? 1 : 0), 0) / keywords.length;
        return { emb, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK * 2)
      .map(({ emb, score }) => {
        const doc = kb.documents.find((d) => d.id === emb.documentId);
        return {
          text: emb.text,
          source: doc?.source ?? "Unknown",
          documentId: emb.documentId,
          relevanceScore: score,
          citation: `${doc?.title ?? "Document"} (${doc?.source ?? "Unknown source"})`,
        };
      });

    const merged = new Map<string, RAGResult>();
    for (const r of semanticResults) merged.set(r.documentId + r.text, r);
    for (const r of keywordResults) if (!merged.has(r.documentId + r.text)) merged.set(r.documentId + r.text, r);

    return Array.from(merged.values()).slice(0, topK);
  }

  getKnowledgeBases(): KnowledgeBase[] {
    return Array.from(this.knowledgeBases.values());
  }

  getKnowledgeBase(kbId: string): KnowledgeBase | undefined {
    return this.knowledgeBases.get(kbId);
  }

  async deleteKnowledgeBase(kbId: string): Promise<void> {
    this.knowledgeBases.delete(kbId);
    await this.saveKnowledgeBases();
  }

  exportKnowledgeBase(kbId: string): string {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);
    return JSON.stringify(kb, null, 2);
  }

  async importKnowledgeBase(jsonData: string): Promise<KnowledgeBase> {
    const kb = JSON.parse(jsonData) as KnowledgeBase;
    this.knowledgeBases.set(kb.id, kb);
    await this.saveKnowledgeBases();
    return kb;
  }
}

export const ragPipeline = new RAGPipelineService();

