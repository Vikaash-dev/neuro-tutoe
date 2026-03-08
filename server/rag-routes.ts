/**
 * RAG API Routes
 *
 * POST /api/rag/kb                  — create knowledge base
 * GET  /api/rag/kb                  — list knowledge bases
 * DELETE /api/rag/kb/:kbId          — delete knowledge base
 * POST /api/rag/kb/:kbId/upload     — upload document (text body)
 * POST /api/rag/upload              — upload to "default" KB (auto-creates)
 * POST /api/rag/kb/:kbId/search     — search within a KB
 * POST /api/rag/search              — search across all KBs
 * POST /api/rag/embed               — embed a single text (used by client RAG service)
 */

import { Router, Request, Response } from "express";
import { resolveGeminiKey } from "./services/gemini";
import { ragStore } from "./services/rag-store";

export const ragRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function handleError(res: Response, err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  const status = (error as Error & { statusCode?: number }).statusCode ?? 500;
  res.status(status).json({ error: error.message });
}

// ---------------------------------------------------------------------------
// Knowledge Base CRUD
// ---------------------------------------------------------------------------

ragRouter.post("/kb", (req: Request, res: Response) => {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name) return res.status(400).json({ error: "name is required" });
    const kb = ragStore.createKB(name, description ?? "");
    res.json(kb);
  } catch (err) {
    handleError(res, err);
  }
});

ragRouter.get("/kb", (_req: Request, res: Response) => {
  res.json(ragStore.listKBs());
});

ragRouter.delete("/kb/:kbId", (req: Request, res: Response) => {
  const deleted = ragStore.deleteKB(req.params.kbId);
  if (!deleted) return res.status(404).json({ error: "Knowledge base not found" });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Document upload to specific KB
// ---------------------------------------------------------------------------

ragRouter.post("/kb/:kbId/upload", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const { title, content, source, type } = req.body as {
      title?: string;
      content?: string;
      source?: string;
      type?: "pdf" | "txt" | "md";
    };

    if (!content) return res.status(400).json({ error: "content is required" });

    const doc = await ragStore.addDocument(
      req.params.kbId,
      title ?? "Untitled",
      content,
      source ?? "manual upload",
      type ?? "txt",
      apiKey
    );

    res.json({ success: true, document: doc });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Convenience: upload to "default" KB (auto-creates if needed)
// ---------------------------------------------------------------------------

ragRouter.post("/upload", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const { title, content, source, type } = req.body as {
      title?: string;
      content?: string;
      source?: string;
      type?: "pdf" | "txt" | "md";
    };

    if (!content) return res.status(400).json({ error: "content is required" });

    // Find or create default KB
    const kbs = ragStore.listKBs();
    let defaultKB = kbs.find((kb) => kb.name === "Default");
    if (!defaultKB) {
      defaultKB = ragStore.createKB("Default", "Default knowledge base");
    }

    const doc = await ragStore.addDocument(
      defaultKB.id,
      title ?? "Untitled",
      content,
      source ?? "upload",
      type ?? "txt",
      apiKey
    );

    res.json({ success: true, document: doc, kbId: defaultKB.id });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Search within a KB
// ---------------------------------------------------------------------------

ragRouter.post("/kb/:kbId/search", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const { query, topK } = req.body as { query?: string; topK?: number };
    if (!query) return res.status(400).json({ error: "query is required" });

    const results = await ragStore.search(req.params.kbId, query, apiKey, topK ?? 5);
    res.json({ results });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Search across all KBs
// ---------------------------------------------------------------------------

ragRouter.post("/search", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const { query, topK } = req.body as { query?: string; topK?: number };
    if (!query) return res.status(400).json({ error: "query is required" });

    const results = await ragStore.searchAll(query, apiKey, topK ?? 5);
    res.json({ results });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Single-text embedding endpoint (used by client RAGPipelineService)
// ---------------------------------------------------------------------------

ragRouter.post("/embed", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const { text } = req.body as { text?: string };
    if (!text) return res.status(400).json({ error: "text is required" });

    const { geminiEmbed } = await import("./services/gemini");
    const embedding = await geminiEmbed(apiKey, text);
    res.json({ embedding });
  } catch (err) {
    handleError(res, err);
  }
});
