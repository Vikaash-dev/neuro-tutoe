/**
 * Server-side Gemini Service — Sprint 0 security architecture
 *
 * Key resolution (managed → env → user header):
 *   1. BUILT_IN_FORGE_API_KEY (production) → invokeLLM
 *   2. GEMINI_API_KEY env var
 *   3. X-Gemini-API-Key request header (self-hosted: user key forwarded server-side)
 */

import { invokeLLM, Message } from "../_core/llm";
import { ENV } from "../_core/env";

export interface ServerLLMRequest {
  systemPrompt: string;
  userMessage: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  userApiKey?: string;
  maxTokens?: number;
}

export interface ServerLLMResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

interface GeminiPart { text: string }
// Gemini REST API uses "model" for assistant turns (not "assistant" — that's OpenAI convention)
interface GeminiContent { role: "user" | "model"; parts: GeminiPart[] }

const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function hasForgeKey(): boolean { return Boolean(ENV.forgeApiKey); }

function resolveApiKey(userApiKey?: string): string | null {
  if (ENV.forgeApiKey) return null;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (userApiKey) return userApiKey;
  return null;
}

export async function callLLM(req: ServerLLMRequest): Promise<ServerLLMResponse> {
  const { systemPrompt, userMessage, history = [], userApiKey } = req;

  if (hasForgeKey()) {
    const messages: Message[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    for (const h of history) {
      messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: h.content });
    }
    messages.push({ role: "user", content: userMessage });
    const result = await invokeLLM({ messages, maxTokens: req.maxTokens ?? 4096 });
    const content = result.choices[0]?.message?.content;
    const text = typeof content === "string" ? content
      : (content as Array<GeminiPart>)?.[0]?.text ?? "";
    return {
      content: text,
      usage: result.usage
        ? { promptTokens: result.usage.prompt_tokens, completionTokens: result.usage.completion_tokens }
        : undefined,
    };
  }

  const apiKey = resolveApiKey(userApiKey);
  if (!apiKey) {
    throw new Error("No Gemini API key. Set BUILT_IN_FORGE_API_KEY, GEMINI_API_KEY, or X-Gemini-API-Key header.");
  }
  return callGeminiDirect(apiKey, systemPrompt, userMessage, history, req.maxTokens ?? 4096);
}

export async function streamLLM(
  req: ServerLLMRequest,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  const apiKey = resolveApiKey(req.userApiKey);
  if (!apiKey && !hasForgeKey()) {
    onError(new Error("No Gemini API key configured."));
    return;
  }
  if (hasForgeKey()) {
    try { const r = await callLLM(req); onChunk(r.content); onDone(); }
    catch (err) { onError(err instanceof Error ? err : new Error(String(err))); }
    return;
  }
  try {
    await streamGeminiDirect(apiKey!, req.systemPrompt, req.userMessage, req.history ?? [], onChunk, onDone);
  } catch (err) { onError(err instanceof Error ? err : new Error(String(err))); }
}

async function callGeminiDirect(
  apiKey: string, systemPrompt: string, userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>, maxTokens: number
): Promise<ServerLLMResponse> {
  const contents: GeminiContent[] = [
    ...history.map((h): GeminiContent => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
    { role: "user", parts: [{ text: userMessage }] },
  ];
  const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: maxTokens } };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

  const resp = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Gemini API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json() as {
    candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    usage: data.usageMetadata ? { promptTokens: data.usageMetadata.promptTokenCount ?? 0, completionTokens: data.usageMetadata.candidatesTokenCount ?? 0 } : undefined,
  };
}

async function streamGeminiDirect(
  apiKey: string, systemPrompt: string, userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  onChunk: (chunk: string) => void, onDone: () => void
): Promise<void> {
  const contents: GeminiContent[] = [
    ...history.map((h): GeminiContent => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
    { role: "user", parts: [{ text: userMessage }] },
  ];
  const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: 4096 } };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

  const resp = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) throw new Error(`Gemini streaming error ${resp.status}: ${await resp.text()}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr) as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> };
        const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (chunk) onChunk(chunk);
      } catch { /* ignore malformed SSE */ }
    }
  }
  onDone();
}

export function extractUserApiKey(headers: Record<string, string | string[] | undefined>): string | undefined {
  const val = headers["x-gemini-api-key"];
  return Array.isArray(val) ? val[0] : val;
}
