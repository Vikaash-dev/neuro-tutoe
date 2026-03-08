/**
 * RAG Pipeline Service
 * Implements Retrieval-Augmented Generation for document-based learning
 * Inspired by DeepTutor's LightRAG architecture
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

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
  embedding: number[]; // Simplified - in production use real embeddings
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

/**
 * RAG Pipeline Service for document-based learning
 * Handles document upload, embedding, retrieval, and citation
 */
export class RAGPipelineService {
  private knowledgeBases: Map<string, KnowledgeBase> = new Map();
  private storageKey = "rag_knowledge_bases";

  constructor() {
    this.loadKnowledgeBases();
  }

  /**
   * Load knowledge bases from storage
   */
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

  /**
   * Save knowledge bases to storage
   */
  private async saveKnowledgeBases(): Promise<void> {
    try {
      const data = Object.fromEntries(this.knowledgeBases);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save knowledge bases:", error);
    }
  }

  /**
   * Create a new knowledge base
   */
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

  /**
   * Add document to knowledge base
   */
  async addDocument(
    kbId: string,
    title: string,
    content: string,
    type: "pdf" | "txt" | "md",
    source: string
  ): Promise<Document> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) {
      throw new Error(`Knowledge base ${kbId} not found`);
    }

    const doc: Document = {
      id: `doc_${Date.now()}`,
      title,
      content,
      source,
      uploadedAt: Date.now(),
      type,
    };

    kb.documents.push(doc);

    // Generate embeddings for document chunks
    await this.generateEmbeddings(kbId, doc);

    kb.updatedAt = Date.now();
    this.knowledgeBases.set(kbId, kb);
    await this.saveKnowledgeBases();

    return doc;
  }

  /**
   * Generate embeddings for document chunks
   * In production, use real embedding models like text-embedding-3-large
   */
  private async generateEmbeddings(kbId: string, doc: Document): Promise<void> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) return;

    // Split document into chunks (simplified)
    const chunks = this.chunkDocument(doc.content);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding: EmbeddingVector = {
        documentId: doc.id,
        chunkId: `chunk_${i}`,
        text: chunk,
        embedding: this.simpleEmbedding(chunk), // Simplified embedding
        metadata: {
          chunkIndex: i,
          totalChunks: chunks.length,
          source: doc.source,
        },
      };

      kb.embeddings.push(embedding);
    }
  }

  /**
   * Split document into chunks
   */
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

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Simple embedding function (in production, use real embeddings)
   */
  private simpleEmbedding(text: string): number[] {
    // Simplified: use hash-based embedding
    const embedding: number[] = new Array(128).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i % 128] += charCode / 256;
    }

    return embedding.map((v) => v / text.length);
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Retrieve relevant documents for a query
   */
  async retrieve(kbId: string, query: string, topK: number = 5): Promise<RAGResult[]> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) {
      throw new Error(`Knowledge base ${kbId} not found`);
    }

    // Generate query embedding
    const queryEmbedding = this.simpleEmbedding(query);

    // Calculate similarity scores
    const results: Array<{ embedding: EmbeddingVector; score: number }> = [];

    for (const embedding of kb.embeddings) {
      const score = this.cosineSimilarity(queryEmbedding, embedding.embedding);
      results.push({ embedding, score });
    }

    // Sort by relevance and return top K
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK).map((result) => {
      const doc = kb.documents.find((d) => d.id === result.embedding.documentId);
      return {
        text: result.embedding.text,
        source: doc?.source || "Unknown",
        documentId: result.embedding.documentId,
        relevanceScore: result.score,
        citation: `${doc?.title || "Document"} (${doc?.source || "Unknown source"})`,
      };
    });
  }

  /**
   * Hybrid search combining keyword and semantic search
   */
  async hybridSearch(kbId: string, query: string, topK: number = 5): Promise<RAGResult[]> {
    // Semantic search
    const semanticResults = await this.retrieve(kbId, query, topK * 2);

    // Keyword search
    const keywordResults = this.keywordSearch(kbId, query, topK * 2);

    // Merge and deduplicate
    const merged = new Map<string, RAGResult>();

    for (const result of semanticResults) {
      merged.set(result.documentId, result);
    }

    for (const result of keywordResults) {
      if (!merged.has(result.documentId)) {
        merged.set(result.documentId, result);
      }
    }

    return Array.from(merged.values()).slice(0, topK);
  }

  /**
   * Keyword-based search
   */
  private keywordSearch(kbId: string, query: string, topK: number): RAGResult[] {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) return [];

    const keywords = query.toLowerCase().split(/\s+/);
    const results: Array<{ embedding: EmbeddingVector; score: number }> = [];

    for (const embedding of kb.embeddings) {
      let score = 0;
      const text = embedding.text.toLowerCase();

      for (const keyword of keywords) {
        const matches = (text.match(new RegExp(keyword, "g")) || []).length;
        score += matches;
      }

      if (score > 0) {
        results.push({ embedding, score });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK).map((result) => {
      const doc = kb.documents.find((d) => d.id === result.embedding.documentId);
      return {
        text: result.embedding.text,
        source: doc?.source || "Unknown",
        documentId: result.embedding.documentId,
        relevanceScore: Math.min(result.score / 10, 1), // Normalize score
        citation: `${doc?.title || "Document"} (${doc?.source || "Unknown source"})`,
      };
    });
  }

  /**
   * Get all knowledge bases
   */
  getKnowledgeBases(): KnowledgeBase[] {
    return Array.from(this.knowledgeBases.values());
  }

  /**
   * Get knowledge base by ID
   */
  getKnowledgeBase(kbId: string): KnowledgeBase | undefined {
    return this.knowledgeBases.get(kbId);
  }

  /**
   * Delete knowledge base
   */
  async deleteKnowledgeBase(kbId: string): Promise<void> {
    this.knowledgeBases.delete(kbId);
    await this.saveKnowledgeBases();
  }

  /**
   * Export knowledge base as JSON
   */
  exportKnowledgeBase(kbId: string): string {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) {
      throw new Error(`Knowledge base ${kbId} not found`);
    }

    return JSON.stringify(kb, null, 2);
  }

  /**
   * Import knowledge base from JSON
   */
  async importKnowledgeBase(jsonData: string): Promise<KnowledgeBase> {
    const kb = JSON.parse(jsonData) as KnowledgeBase;
    this.knowledgeBases.set(kb.id, kb);
    await this.saveKnowledgeBases();
    return kb;
  }
}

// Export singleton instance
export const ragPipeline = new RAGPipelineService();
