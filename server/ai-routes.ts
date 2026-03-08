/**
 * AI Tutor Routes  –  /api/ai/*
 *
 * All endpoints accept an optional `x-gemini-api-key` header (falls back
 * to GEMINI_API_KEY env var).  They call Gemini gemini-2.0-flash and return
 * structured JSON that matches the TypeScript types in lib/types/learning.ts.
 *
 * Endpoints
 * ─────────
 *  POST /api/ai/explain-simple          ConceptExplanation
 *  POST /api/ai/analyze-explanation     accuracy / gaps / misconceptions
 *  POST /api/ai/follow-up-questions     string[]
 *  POST /api/ai/generate-quiz           { questions: QuizQuestion[] }
 *  POST /api/ai/evaluate-answer         isCorrect / feedback / explanation
 *  POST /api/ai/step-by-step-solution   steps / keyInsights / relatedConcepts
 *  POST /api/ai/correct-misconception   correctionExplanation / examples
 *  POST /api/ai/concept-connections     prerequisites / relatedConcepts / …
 *  POST /api/ai/adaptive-response       AITutorResponse
 *  POST /api/ai/chat-with-rag           streaming RAG-augmented chat
 */

import { Router, Request, Response } from "express";
import { resolveGeminiKey, geminiJSON, geminiChat } from "./services/gemini";
import { ragStore } from "./services/rag-store";

export const aiRouter = Router();

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function handleError(res: Response, err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  const status = (error as Error & { statusCode?: number }).statusCode ?? 500;
  console.error("[ai-routes]", error.message);
  res.status(status).json({ error: error.message });
}

// ---------------------------------------------------------------------------
// 1. Feynman-style simple explanation
// ---------------------------------------------------------------------------

aiRouter.post("/explain-simple", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      conceptName,
      description,
      keyPoints = [],
      commonMisconceptions = [],
      realWorldApplications = [],
      learningStyle = "visual",
      explanationDepth = "moderate",
      communicationPreference = "encouraging",
    } = req.body as Record<string, unknown>;

    const prompt = `You are an expert educator using the Feynman Technique.

Concept: "${conceptName}"
Description: "${description}"
Key Points: ${JSON.stringify(keyPoints)}
Common Misconceptions: ${JSON.stringify(commonMisconceptions)}
Real-World Applications: ${JSON.stringify(realWorldApplications)}
Student Learning Style: ${learningStyle}
Explanation Depth: ${explanationDepth}
Communication Preference: ${communicationPreference}

Return a JSON object matching this exact shape:
{
  "concept": "<concept name>",
  "simpleExplanation": "<Feynman-style plain language explanation, 3–5 sentences>",
  "keyPoints": ["<point 1>", "<point 2>", "<point 3>"],
  "commonMisconceptions": ["<misconception 1>", "<misconception 2>"],
  "realWorldExamples": ["<example 1>", "<example 2>"],
  "relatedConcepts": ["<concept 1>", "<concept 2>"],
  "visualDescription": "<one sentence describing a diagram that would help>"
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 2. Analyze student's teach-back explanation
// ---------------------------------------------------------------------------

aiRouter.post("/analyze-explanation", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      conceptId,
      studentExplanation,
      correctConcept,
      learningStyle = "visual",
      communicationPreference = "encouraging",
    } = req.body as Record<string, unknown>;

    const prompt = `You are an expert tutor evaluating a student's Feynman-style explanation.

Concept ID: ${conceptId}
Correct Concept: ${JSON.stringify(correctConcept)}
Student's Explanation: "${studentExplanation}"
Learning Style: ${learningStyle}
Communication Preference: ${communicationPreference}

Evaluate the explanation and return JSON:
{
  "accuracy": <0-100>,
  "missingPoints": ["<missing point 1>", "..."],
  "misconceptions": ["<misconception 1>", "..."],
  "suggestions": ["<improvement suggestion 1>", "..."],
  "refinedExplanation": "<an improved version of their explanation>"
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 3. Generate Socratic follow-up questions
// ---------------------------------------------------------------------------

aiRouter.post("/follow-up-questions", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      conceptId,
      conceptName,
      identifiedGaps = [],
      learningStyle = "visual",
      explanationDepth = "moderate",
      communicationPreference = "encouraging",
    } = req.body as Record<string, unknown>;

    const prompt = `You are a Socratic tutor for "${conceptName}" (ID: ${conceptId}).

The student has these knowledge gaps: ${JSON.stringify(identifiedGaps)}
Learning Style: ${learningStyle}, Depth: ${explanationDepth}, Tone: ${communicationPreference}

Generate 3-5 targeted follow-up questions that guide the student to discover the answers themselves.
Return JSON: { "questions": ["<question 1>", "<question 2>", "..."] }`;

    const result = await geminiJSON<{ questions: string[] }>(apiKey, prompt);
    res.json({ questions: result.questions ?? [] });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 4. Generate adaptive quiz questions
// ---------------------------------------------------------------------------

aiRouter.post("/generate-quiz", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      conceptIds = [],
      masteryLevels = {},
      learningStyle = "visual",
      explanationDepth = "moderate",
      communicationPreference = "encouraging",
      questionCount = 5,
    } = req.body as Record<string, unknown>;

    const prompt = `You are an adaptive quiz generator.

Concepts: ${JSON.stringify(conceptIds)}
Mastery Levels: ${JSON.stringify(masteryLevels)}
Learning Style: ${learningStyle}, Depth: ${explanationDepth}

Generate ${questionCount} adaptive quiz questions. Return JSON:
{
  "questions": [
    {
      "id": "q_<unique>",
      "conceptId": "<concept id>",
      "type": "multiple_choice",
      "question": "<question text>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correctAnswer": "<A|B|C|D>",
      "explanation": "<why this is correct>",
      "difficulty": "beginner|intermediate|advanced|expert",
      "relatedMisconceptions": []
    }
  ]
}`;

    const result = await geminiJSON<{ questions: unknown[] }>(apiKey, prompt);
    res.json({ questions: result.questions ?? [] });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 5. Evaluate a quiz answer
// ---------------------------------------------------------------------------

aiRouter.post("/evaluate-answer", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      questionId,
      userAnswer,
      conceptId,
      learningStyle = "visual",
      communicationPreference = "encouraging",
    } = req.body as Record<string, unknown>;

    const prompt = `You are evaluating a student's quiz answer.

Question ID: ${questionId}
Concept: ${conceptId}
Student Answer: "${userAnswer}"
Learning Style: ${learningStyle}, Tone: ${communicationPreference}

Return JSON:
{
  "isCorrect": <true|false>,
  "feedback": "<encouraging 1-2 sentence feedback>",
  "explanation": "<why the answer is correct or incorrect>",
  "misconceptionsDetected": ["<misconception if any>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 6. Step-by-step problem solution (DeepTutor multi-agent style)
// ---------------------------------------------------------------------------

aiRouter.post("/step-by-step-solution", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      problem,
      conceptId,
      learningStyle = "visual",
      explanationDepth = "moderate",
      communicationPreference = "encouraging",
    } = req.body as Record<string, unknown>;

    const prompt = `You are a step-by-step tutor solving a problem using the Feynman method.

Problem: "${problem}"
Concept: ${conceptId}
Learning Style: ${learningStyle}, Depth: ${explanationDepth}, Tone: ${communicationPreference}

Return JSON:
{
  "steps": ["<step 1>", "<step 2>", "<step 3>"],
  "explanation": "<overall explanation of the approach>",
  "keyInsights": ["<insight 1>", "<insight 2>"],
  "relatedConcepts": ["<concept 1>", "<concept 2>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 7. Correct a misconception
// ---------------------------------------------------------------------------

aiRouter.post("/correct-misconception", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      misconception,
      correctConcept,
      learningStyle = "visual",
      communicationPreference = "encouraging",
    } = req.body as Record<string, unknown>;

    const prompt = `You are a compassionate tutor correcting a student misconception.

Misconception: "${misconception}"
Correct Concept: ${JSON.stringify(correctConcept)}
Learning Style: ${learningStyle}, Tone: ${communicationPreference}

Return JSON:
{
  "correctionExplanation": "<clear correction in 2-3 sentences>",
  "whyMisconceptionOccurs": "<why students typically believe this>",
  "correctUnderstanding": "<the correct mental model>",
  "examples": ["<concrete example 1>", "<concrete example 2>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 8. Concept connections (knowledge graph expansion)
// ---------------------------------------------------------------------------

aiRouter.post("/concept-connections", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const { conceptName, conceptDescription } = req.body as Record<string, unknown>;

    const prompt = `You are building an educational knowledge graph.

Concept: "${conceptName}"
Description: "${conceptDescription}"

Return JSON:
{
  "prerequisites": ["<concept a student must know first>"],
  "relatedConcepts": ["<closely related concept>"],
  "advancedConcepts": ["<what to learn next>"],
  "applications": ["<real-world application 1>", "<real-world application 2>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 9. Adaptive tutor response (Theory of Mind)
// ---------------------------------------------------------------------------

aiRouter.post("/adaptive-response", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      studentQuestion,
      conceptId,
      conceptName,
      learningStyle = "visual",
      communicationPreference = "encouraging",
      explanationDepth = "moderate",
      pacePreference = "moderate",
      preferredExamples = "mixed",
      conversationHistory = [],
      ragContext = "",
    } = req.body as Record<string, unknown>;

    const systemPrompt = `You are NeuroTutor AI, an adaptive Feynman-technique tutor.

Student Profile:
- Concept: ${conceptName} (ID: ${conceptId})
- Learning Style: ${learningStyle}
- Communication Preference: ${communicationPreference}
- Explanation Depth: ${explanationDepth}
- Pace: ${pacePreference}
- Preferred Examples: ${preferredExamples}

${ragContext ? `Relevant knowledge from uploaded documents:\n${ragContext}\n` : ""}

Use the Feynman technique: explain simply, use analogies, check understanding.
Never just state facts — guide the student to understand WHY.`;

    // Build history for Gemini
    const history = (conversationHistory as Array<{ role: string; content: string }>).map(
      (m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      })
    );

    const responseText = await geminiChat(
      apiKey,
      studentQuestion as string,
      { systemPrompt, history }
    );

    const response = {
      id: `resp_${Date.now()}`,
      conceptId: conceptId as string,
      explanation: responseText,
      stepByStepSolution: undefined,
      relatedConcepts: [],
      followUpQuestions: [],
      misconceptionsAddressed: [],
      confidence: 0.9,
      sources: ragContext ? ["Uploaded documents"] : [],
    };

    res.json(response);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 10. RAG-augmented chat (searches all KBs before answering)
// ---------------------------------------------------------------------------

aiRouter.post("/chat-with-rag", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      message,
      conceptId = "",
      conceptName = "",
      learningStyle = "visual",
      communicationPreference = "encouraging",
      explanationDepth = "moderate",
      conversationHistory = [],
      kbId,
    } = req.body as Record<string, unknown>;

    // Step 1: retrieve relevant context from RAG
    let ragContext = "";
    let ragCitations: string[] = [];
    try {
      const results = kbId
        ? await ragStore.search(kbId as string, message as string, apiKey, 3)
        : await ragStore.searchAll(message as string, apiKey, 3);

      if (results.length > 0) {
        ragContext = results.map((r) => `[${r.citation}]\n${r.text}`).join("\n\n");
        ragCitations = results.map((r) => r.citation);
      }
    } catch {
      // RAG failure is non-fatal
    }

    // Step 2: re-use adaptive-response logic with RAG context injected
    const systemPrompt = `You are NeuroTutor AI, an adaptive Feynman-technique tutor.

Student Profile:
- Concept: ${conceptName} (ID: ${conceptId})
- Learning Style: ${learningStyle}
- Communication Preference: ${communicationPreference}
- Explanation Depth: ${explanationDepth}

${ragContext ? `Relevant context from uploaded documents:\n${ragContext}\n\nUse this context to ground your answer. Cite sources when using this information.\n` : ""}

Explain clearly using analogies. Guide understanding, don't just provide answers.`;

    const history = (conversationHistory as Array<{ role: string; content: string }>).map(
      (m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      })
    );

    const responseText = await geminiChat(apiKey, message as string, {
      systemPrompt,
      history,
    });

    res.json({
      id: `resp_${Date.now()}`,
      conceptId,
      explanation: responseText,
      relatedConcepts: [],
      followUpQuestions: [],
      misconceptionsAddressed: [],
      confidence: 0.9,
      sources: ragCitations,
      ragUsed: ragCitations.length > 0,
    });
  } catch (err) {
    handleError(res, err);
  }
});
