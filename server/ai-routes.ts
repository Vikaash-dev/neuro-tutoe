/**
 * AI Routes — Express router for all AI tutoring endpoints
 *
 * Sprint 0: Implements all endpoints that AITutorService (lib/services/ai-tutor.ts) calls.
 *   These previously returned 404 — the tutor chat was completely broken.
 *
 * Sprint 1: 4 Feynman modes via `mode` parameter.
 * Sprint 2: APE profile inference via /api/ai/profile/infer
 * Sprint 4: Dynamic KG extraction via /api/ai/concepts/extract
 *
 * Security: All Gemini API calls go through gemini-service.ts (server-side).
 *   User API keys are forwarded in X-Gemini-API-Key header → used server-side only.
 *   The Gemini API is never called directly from the browser.
 */

import { Router, Request, Response } from "express";
import { callLLM, streamLLM, extractUserApiKey } from "./services/gemini-service";
import {
  buildSystemPrompt,
  buildExplainerPrompt,
  APE_INFERENCE_PROMPT,
  KG_EXTRACT_PROMPT,
  FeynmanMode,
  ProfileParams,
} from "./services/feynman-prompts";

export const aiRouter = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

function userKey(req: Request): string | undefined {
  return extractUserApiKey(req.headers as Record<string, string | string[] | undefined>);
}

function jsonError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

// ── Sprint 1: Adaptive response (4 Feynman modes) ───────────────────────────

aiRouter.post("/adaptive-response", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      studentQuestion, conceptId, conceptName,
      learningStyle, communicationPreference, explanationDepth,
      pacePreference, preferredExamples, conversationHistory,
      mode = "explainer",
    } = req.body as {
      studentQuestion: string;
      conceptId: string;
      conceptName: string;
      learningStyle?: string;
      communicationPreference?: string;
      explanationDepth?: number;
      pacePreference?: string;
      preferredExamples?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      mode?: FeynmanMode;
    };

    if (!studentQuestion || !conceptName) {
      jsonError(res, 400, "studentQuestion and conceptName are required");
      return;
    }

    const profile: ProfileParams = {
      depthLevel: explanationDepth,
      learningStyle,
      commStyle: communicationPreference,
    };

    const systemPrompt = buildSystemPrompt(mode, conceptName, profile);
    const history = (conversationHistory ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const result = await callLLM({
      systemPrompt,
      userMessage: studentQuestion,
      history,
      userApiKey: userKey(req),
    });

    res.json({
      response: result.content,
      conceptId,
      mode,
      feedbackType: "explanation",
      suggestedFollowUp: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    jsonError(res, 500, msg);
  }
});

// ── Sprint 1: Streaming chat (SSE) ──────────────────────────────────────────

aiRouter.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const {
    message, sessionId, mode = "explainer", history = [], topic = "the current topic", profile = {},
  } = req.body as {
    message: string;
    sessionId?: string;
    mode?: FeynmanMode;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    topic?: string;
    profile?: ProfileParams;
  };

  if (!message) {
    jsonError(res, 400, "message is required");
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const systemPrompt = buildSystemPrompt(mode, topic, profile);

  await streamLLM(
    { systemPrompt, userMessage: message, history, userApiKey: userKey(req) },
    (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk, sessionId })}\n\n`);
    },
    () => {
      res.write(`data: ${JSON.stringify({ done: true, sessionId })}\n\n`);
      res.end();
    },
    (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  );
});

// ── Sprint 0: Feynman simple explanation ────────────────────────────────────

aiRouter.post("/explain-simple", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      conceptName, description, keyPoints = [], commonMisconceptions = [],
      realWorldApplications = [], learningStyle, explanationDepth, communicationPreference,
    } = req.body as {
      conceptName: string;
      description?: string;
      keyPoints?: string[];
      commonMisconceptions?: string[];
      realWorldApplications?: string[];
      learningStyle?: string;
      explanationDepth?: number;
      communicationPreference?: string;
    };

    if (!conceptName) { jsonError(res, 400, "conceptName is required"); return; }

    const profile: ProfileParams = { depthLevel: explanationDepth, learningStyle, commStyle: communicationPreference };
    const systemPrompt = buildExplainerPrompt(conceptName, profile);

    const userMessage = [
      `Concept: ${conceptName}`,
      description ? `Description: ${description}` : "",
      keyPoints.length ? `Key points: ${keyPoints.join(", ")}` : "",
      commonMisconceptions.length ? `Common misconceptions: ${commonMisconceptions.join(", ")}` : "",
      realWorldApplications.length ? `Real-world applications: ${realWorldApplications.join(", ")}` : "",
      "Please provide a Feynman-style simple explanation with an analogy, key insights, and a teaching snapshot.",
    ].filter(Boolean).join("\n");

    const result = await callLLM({ systemPrompt, userMessage, userApiKey: userKey(req) });

    res.json({
      simpleExplanation: result.content,
      conceptName,
      analogies: [],
      keyInsights: keyPoints.slice(0, 3),
      teachingSnapshot: result.content.split("\n").slice(-2).join(" "),
    });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 0: Analyze student explanation (Feynman Step 2) ──────────────────

aiRouter.post("/analyze-explanation", async (req: Request, res: Response): Promise<void> => {
  try {
    const { conceptId, studentExplanation, correctConcept, learningStyle, communicationPreference } = req.body as {
      conceptId: string;
      studentExplanation: string;
      correctConcept: { name: string; description: string; keyPoints: string[]; commonMisconceptions: string[] };
      learningStyle?: string;
      communicationPreference?: string;
    };

    if (!studentExplanation || !correctConcept?.name) {
      jsonError(res, 400, "studentExplanation and correctConcept are required"); return;
    }

    const systemPrompt = `You are a Feynman-method tutor evaluating a student's explanation.
Assess accuracy, identify gaps, detect misconceptions, and give actionable suggestions.
Respond in JSON only:
{"accuracy":0-100,"missingPoints":[],"misconceptions":[],"suggestions":[],"refinedExplanation":"..."}
Communication style: ${communicationPreference ?? "encouraging"}, learning style: ${learningStyle ?? "mixed"}.`;

    const userMessage = `Student explained "${correctConcept.name}":
"${studentExplanation}"

Correct key points: ${correctConcept.keyPoints.join(", ")}
Common misconceptions to watch for: ${correctConcept.commonMisconceptions.join(", ")}`;

    const result = await callLLM({ systemPrompt, userMessage, userApiKey: userKey(req) });

    let parsed: { accuracy: number; missingPoints: string[]; misconceptions: string[]; suggestions: string[]; refinedExplanation: string };
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? result.content);
    } catch {
      parsed = { accuracy: 50, missingPoints: [], misconceptions: [], suggestions: [result.content], refinedExplanation: "" };
    }
    res.json({ ...parsed, conceptId });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 0: Follow-up questions ────────────────────────────────────────────

aiRouter.post("/follow-up-questions", async (req: Request, res: Response): Promise<void> => {
  try {
    const { conceptId, conceptName, identifiedGaps = [], learningStyle, explanationDepth } = req.body as {
      conceptId: string;
      conceptName: string;
      identifiedGaps: string[];
      learningStyle?: string;
      explanationDepth?: number;
    };

    const systemPrompt = `You are a Feynman-method tutor. Generate 3-5 targeted follow-up questions to help a student fill identified gaps.
Depth level: ${explanationDepth ?? 5}/10. Style: ${learningStyle ?? "mixed"}.
Return JSON array: ["question1","question2",...]`;

    const userMessage = `Concept: ${conceptName}\nGaps identified: ${identifiedGaps.join("; ")}`;
    const result = await callLLM({ systemPrompt, userMessage, userApiKey: userKey(req) });

    let questions: string[] = [];
    try {
      const match = result.content.match(/\[[\s\S]*\]/);
      questions = JSON.parse(match?.[0] ?? "[]");
    } catch {
      questions = result.content.split("\n").filter((l) => l.trim().endsWith("?")).slice(0, 5);
    }
    res.json({ questions, conceptId });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 3: Adaptive quiz generation (BKT-driven) ─────────────────────────

aiRouter.post("/generate-quiz", async (req: Request, res: Response): Promise<void> => {
  try {
    const { conceptIds = [], masteryLevels = {}, learningStyle, explanationDepth, questionCount = 5 } = req.body as {
      conceptIds: string[];
      masteryLevels: Record<string, string>;
      learningStyle?: string;
      explanationDepth?: number;
      questionCount?: number;
    };

    const systemPrompt = `You are an adaptive quiz generator using the 85% Rule (Wilson et al. 2019).
Generate ${questionCount} questions for the student's mastery level.
Depth: ${explanationDepth ?? 5}/10. Style: ${learningStyle ?? "mixed"}.
Return JSON array:
[{"id":"q1","conceptId":"...","question":"...","type":"multiple_choice","options":["A","B","C","D"],"correctAnswer":"A","explanation":"...","bloomLevel":1-6}]
Adjust difficulty: if mastery <0.6 → remember/understand (Bloom 1-2); if 0.6-0.85 → apply/analyze (3-4); if >0.85 → evaluate/create (5-6).`;

    const masteryInfo = conceptIds.map((id) => `${id}: ${masteryLevels[id] ?? "unknown"}`).join(", ");
    const result = await callLLM({ systemPrompt, userMessage: `Concepts and mastery: ${masteryInfo}`, userApiKey: userKey(req) });

    let questions: unknown[] = [];
    try {
      const match = result.content.match(/\[[\s\S]*\]/);
      questions = JSON.parse(match?.[0] ?? "[]");
    } catch {
      questions = [];
    }
    res.json({ questions });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 3: Evaluate quiz answer ──────────────────────────────────────────

aiRouter.post("/evaluate-answer", async (req: Request, res: Response): Promise<void> => {
  try {
    const { questionId, userAnswer, conceptId, learningStyle, communicationPreference } = req.body as {
      questionId: string;
      userAnswer: string;
      conceptId: string;
      learningStyle?: string;
      communicationPreference?: string;
    };

    const systemPrompt = `You are a tutor evaluating a student's quiz answer.
Style: ${communicationPreference ?? "encouraging"}, learning style: ${learningStyle ?? "mixed"}.
Return JSON: {"isCorrect":bool,"feedback":"...","explanation":"...","misconceptionsDetected":[]}`;

    const result = await callLLM({
      systemPrompt,
      userMessage: `Question ID: ${questionId}\nConcept: ${conceptId}\nStudent answer: "${userAnswer}"`,
      userApiKey: userKey(req),
    });

    let parsed: { isCorrect: boolean; feedback: string; explanation: string; misconceptionsDetected: string[] };
    try {
      const match = result.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? result.content);
    } catch {
      parsed = { isCorrect: false, feedback: result.content, explanation: "", misconceptionsDetected: [] };
    }
    res.json({ ...parsed, questionId, conceptId });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 0: Step-by-step solution ─────────────────────────────────────────

aiRouter.post("/step-by-step-solution", async (req: Request, res: Response): Promise<void> => {
  try {
    const { problem, conceptId, learningStyle, explanationDepth, communicationPreference } = req.body as {
      problem: string;
      conceptId: string;
      learningStyle?: string;
      explanationDepth?: number;
      communicationPreference?: string;
    };

    const systemPrompt = `You are a Feynman-method tutor. Break down solutions step by step.
Depth: ${explanationDepth ?? 5}/10. Style: ${communicationPreference ?? "encouraging"}, learning: ${learningStyle ?? "mixed"}.
Return JSON: {"steps":[],"explanation":"...","keyInsights":[],"relatedConcepts":[]}`;

    const result = await callLLM({ systemPrompt, userMessage: `Problem: ${problem}\nConcept: ${conceptId}`, userApiKey: userKey(req) });

    let parsed: { steps: string[]; explanation: string; keyInsights: string[]; relatedConcepts: string[] };
    try {
      const match = result.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? result.content);
    } catch {
      parsed = { steps: [result.content], explanation: result.content, keyInsights: [], relatedConcepts: [] };
    }
    res.json(parsed);
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 0: Misconception correction ──────────────────────────────────────

aiRouter.post("/correct-misconception", async (req: Request, res: Response): Promise<void> => {
  try {
    const { misconception, correctConcept, learningStyle, communicationPreference } = req.body as {
      misconception: string;
      correctConcept: { name: string; description: string; keyPoints: string[] };
      learningStyle?: string;
      communicationPreference?: string;
    };

    const systemPrompt = `You are a Feynman-method tutor. Gently correct a student misconception without making them feel bad.
Style: ${communicationPreference ?? "encouraging"}, learning: ${learningStyle ?? "mixed"}.
Return JSON: {"correctionExplanation":"...","whyMisconceptionOccurs":"...","correctUnderstanding":"...","examples":[]}`;

    const result = await callLLM({
      systemPrompt,
      userMessage: `Misconception: "${misconception}"\nCorrecting concept: ${correctConcept.name}\nKey points: ${correctConcept.keyPoints.join(", ")}`,
      userApiKey: userKey(req),
    });

    let parsed: { correctionExplanation: string; whyMisconceptionOccurs: string; correctUnderstanding: string; examples: string[] };
    try {
      const match = result.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? result.content);
    } catch {
      parsed = { correctionExplanation: result.content, whyMisconceptionOccurs: "", correctUnderstanding: "", examples: [] };
    }
    res.json(parsed);
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 4: Concept connections (Dynamic KG) ──────────────────────────────

aiRouter.post("/concept-connections", async (req: Request, res: Response): Promise<void> => {
  try {
    const { conceptName, conceptDescription } = req.body as { conceptName: string; conceptDescription: string };

    const systemPrompt = `You are a knowledge graph builder for an educational AI tutor.
Return JSON: {"prerequisites":[],"relatedConcepts":[],"advancedConcepts":[],"applications":[]}`;

    const result = await callLLM({
      systemPrompt,
      userMessage: `Concept: ${conceptName}\nDescription: ${conceptDescription}`,
      userApiKey: userKey(req),
    });

    let parsed: { prerequisites: string[]; relatedConcepts: string[]; advancedConcepts: string[]; applications: string[] };
    try {
      const match = result.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? result.content);
    } catch {
      parsed = { prerequisites: [], relatedConcepts: [], advancedConcepts: [], applications: [] };
    }
    res.json(parsed);
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 4: Dynamic KG extraction from conversation ───────────────────────

aiRouter.post("/concepts/extract", async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages = [] } = req.body as { messages: Array<{ role: string; content: string }> };
    const transcript = messages.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n");

    const result = await callLLM({
      systemPrompt: KG_EXTRACT_PROMPT,
      userMessage: `Conversation:\n${transcript}`,
      userApiKey: userKey(req),
    });

    let parsed: { new_nodes: unknown[]; new_edges: unknown[]; mastery_signals: unknown[] };
    try {
      const match = result.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? result.content);
    } catch {
      parsed = { new_nodes: [], new_edges: [], mastery_signals: [] };
    }
    res.json(parsed);
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});

// ── Sprint 2: APE profile inference ─────────────────────────────────────────

aiRouter.post("/profile/infer", async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages = [] } = req.body as { messages: Array<{ role: string; content: string }> };

    if (messages.length < 2) {
      res.json({ profile: null, reason: "Not enough messages to infer profile (need ≥ 2)" });
      return;
    }

    const transcript = messages.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n");

    const result = await callLLM({
      systemPrompt: APE_INFERENCE_PROMPT,
      userMessage: `Conversation (last ${Math.min(messages.length, 10)} messages):\n${transcript}`,
      userApiKey: userKey(req),
    });

    let profile: Record<string, unknown>;
    try {
      const match = result.content.match(/\{[\s\S]*\}/);
      profile = JSON.parse(match?.[0] ?? result.content);
    } catch {
      profile = { error: "Could not parse profile", raw: result.content };
    }
    res.json({ profile });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : "Unknown error");
  }
});
