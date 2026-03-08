/**
 * Server-side Gemini Service
 *
 * Wraps the Google Generative Language REST API so the backend can call
 * Gemini without exposing the API key to the browser.
 *
 * API key resolution order:
 *  1. `x-gemini-api-key` request header (sent by the React-Native client)
 *  2. `GEMINI_API_KEY` environment variable
 *
 * Models used:
 *  • Chat / generation : gemini-2.0-flash
 *  • Embeddings        : text-embedding-004  (768-dim)
 */

import { Request } from "express";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const CHAT_MODEL = "gemini-2.0-flash";
const EMBED_MODEL = "text-embedding-004";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface GeminiChatOptions {
  systemPrompt?: string;
  history?: GeminiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the Gemini API key from the request header or env variable.
 * Throws a clear 401-style error if neither is set.
 */
export function resolveGeminiKey(req: Request): string {
  const fromHeader = req.headers["x-gemini-api-key"];
  const key =
    (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ??
    process.env.GEMINI_API_KEY ??
    "";
  if (!key) {
    const err: Error & { statusCode?: number } = new Error(
      "Gemini API key missing. Pass x-gemini-api-key header or set GEMINI_API_KEY env."
    );
    err.statusCode = 401;
    throw err;
  }
  return key;
}

// ---------------------------------------------------------------------------
// Core: generateContent
// ---------------------------------------------------------------------------

/**
 * Send a single prompt (with optional history + system instruction) to
 * Gemini and return the text response.
 */
export async function geminiChat(
  apiKey: string,
  userMessage: string,
  options: GeminiChatOptions = {}
): Promise<string> {
  const {
    systemPrompt,
    history = [],
    temperature = 0.7,
    maxOutputTokens = 4096,
  } = options;

  const contents: GeminiMessage[] = [];

  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I will follow these instructions." }],
    });
  }

  contents.push(...history);
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
      topK: 40,
      topP: 0.95,
    },
  };

  const res = await fetch(
    `${GEMINI_BASE}/models/${CHAT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini chat error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(`Gemini error: ${data.error.message}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

// ---------------------------------------------------------------------------
// Core: generateContent with JSON output
// ---------------------------------------------------------------------------

/**
 * Like geminiChat but parses the response as JSON.
 * Retries up to `retries` times if JSON parsing fails.
 */
export async function geminiJSON<T>(
  apiKey: string,
  prompt: string,
  options: GeminiChatOptions & { retries?: number } = {}
): Promise<T> {
  const { retries = 2, ...chatOpts } = options;

  const jsonPrompt = `${prompt}

IMPORTANT: Respond with ONLY valid JSON — no markdown fences, no extra text.`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = await geminiChat(apiKey, jsonPrompt, chatOpts);
      // Strip markdown fences if the model includes them anyway
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      return JSON.parse(cleaned) as T;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Failed to get valid JSON from Gemini");
}

// ---------------------------------------------------------------------------
// Core: embedContent
// ---------------------------------------------------------------------------

/**
 * Generate a 768-dimensional embedding for `text` using text-embedding-004.
 */
export async function geminiEmbed(apiKey: string, text: string): Promise<number[]> {
  const body = {
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text }] },
  };

  const res = await fetch(
    `${GEMINI_BASE}/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini embed error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    embedding?: { values: number[] };
    error?: { message: string };
  };

  if (data.error) throw new Error(`Gemini embed error: ${data.error.message}`);
  const values = data.embedding?.values;
  if (!values?.length) throw new Error("Empty embedding from Gemini");
  return values;
}

// ---------------------------------------------------------------------------
// Batch embedding helper
// ---------------------------------------------------------------------------

/**
 * Embed multiple texts, respecting rate limits with a small delay between
 * requests.
 */
export async function geminiEmbedBatch(
  apiKey: string,
  texts: string[],
  delayMs = 50
): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await geminiEmbed(apiKey, text));
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Utility: cosine similarity
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
