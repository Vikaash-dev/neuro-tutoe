/**
 * DeepTutor Routes  –  /api/deeptutor/*
 *
 * Implements DeepTutor's multi-agent capabilities using Gemini as the LLM
 * backend.  All endpoints accept `x-gemini-api-key` header.
 *
 * Endpoints
 * ─────────
 *  POST /api/deeptutor/questiongen           Adaptive quiz (QuestionGen module)
 *  POST /api/deeptutor/knowledge-graph       Concept relationship graph
 *  POST /api/deeptutor/deep-research         Comprehensive concept explanation
 *  POST /api/deeptutor/skill-transfer        Analogical skill-transfer explanation
 *  POST /api/deeptutor/multi-agent-solve     Multi-agent problem decomposition
 *  POST /api/deeptutor/exercise-gen          Practice exercise generation
 *  POST /api/deeptutor/idea-gen              Cross-domain idea connections
 *  POST /api/deeptutor/knowledge-base/save   Personal KB entry save
 *  POST /api/deeptutor/knowledge-base/search Personal KB semantic search
 */

import { Router, Request, Response } from "express";
import { resolveGeminiKey, geminiJSON } from "./services/gemini";

export const deepTutorRouter = Router();

function handleError(res: Response, err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  const status = (error as Error & { statusCode?: number }).statusCode ?? 500;
  console.error("[deeptutor-routes]", error.message);
  res.status(status).json({ error: error.message });
}

// In-memory personal knowledge base (per-user, keyed by userId)
const personalKB = new Map<string, Array<{ id: string; conceptId: string; notes: string; tags: string[]; timestamp: number }>>();

// ---------------------------------------------------------------------------
// 1. QuestionGen — Adaptive quiz generation with forgetting-curve awareness
// ---------------------------------------------------------------------------

deepTutorRouter.post("/questiongen", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      concepts = [],
      difficulty = "medium",
      questionCount = 5,
    } = req.body as Record<string, unknown>;

    const conceptList = (concepts as Array<{ conceptId: string; decayFactor: number; masteryLevel: string }>)
      .sort((a, b) => b.decayFactor - a.decayFactor) // prioritize high-decay concepts
      .slice(0, 5);

    const prompt = `You are DeepTutor's QuestionGen module using spaced-repetition theory.

Concepts to quiz (sorted by forgetting priority):
${JSON.stringify(conceptList, null, 2)}

Difficulty: ${difficulty}

Generate ${questionCount} adaptive multiple-choice questions, prioritizing the highest-decay concepts.
Return JSON:
{
  "questions": [
    {
      "id": "q_<unique_id>",
      "conceptId": "<concept id>",
      "type": "multiple_choice",
      "question": "<clear question text>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correctAnswer": "<A|B|C|D>",
      "explanation": "<why this answer is correct>",
      "difficulty": "${difficulty}",
      "relatedMisconceptions": ["<common wrong belief>"]
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
// 2. DR-in-KG — Deep concept relationship mapping
// ---------------------------------------------------------------------------

deepTutorRouter.post("/knowledge-graph", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const { conceptName, conceptDescription } = req.body as Record<string, unknown>;

    const prompt = `You are DeepTutor's DR-in-KG (Deep Research in Knowledge Graph) module.

Concept: "${conceptName}"
Description: "${conceptDescription}"

Map all educational relationships for this concept. Return JSON:
{
  "prerequisites": [
    { "name": "<prerequisite concept>", "relationship": "<why it must come first>" }
  ],
  "relatedConcepts": [
    { "name": "<related concept>", "relationship": "<how they connect>" }
  ],
  "advancedTopics": [
    { "name": "<advanced topic>", "relationship": "<how it builds on this>" }
  ],
  "transferableSkills": ["<skill that transfers to other domains>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 3. Deep Research — Comprehensive multi-perspective explanation
// ---------------------------------------------------------------------------

deepTutorRouter.post("/deep-research", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      conceptName,
      relatedConcepts = [],
      researchDepth = "intermediate",
    } = req.body as Record<string, unknown>;

    const prompt = `You are DeepTutor's Deep Research module.

Concept: "${conceptName}"
Related Concepts: ${JSON.stringify(relatedConcepts)}
Research Depth: ${researchDepth}

Provide a comprehensive multi-perspective explanation. Return JSON:
{
  "mainExplanation": "<thorough explanation of the main concept>",
  "relatedConceptExplanations": {
    "<related concept 1>": "<how it connects to main concept>",
    "<related concept 2>": "<how it connects to main concept>"
  },
  "keyInsights": ["<surprising or non-obvious insight>"],
  "applicationExamples": ["<real-world application>"],
  "commonMisconceptions": ["<common wrong belief and why it's wrong>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 4. Skill Transfer — Explain new concept via known schemas
// ---------------------------------------------------------------------------

deepTutorRouter.post("/skill-transfer", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      newConcept,
      coreSchemas = [],
      studentBackground = [],
    } = req.body as Record<string, unknown>;

    const prompt = `You are DeepTutor's Skill Transfer Engine.

New concept to learn: "${newConcept}"
Student's known schemas: ${JSON.stringify(coreSchemas)}
Student's background: ${JSON.stringify(studentBackground)}

Explain the new concept using analogies from what the student already knows. Return JSON:
{
  "explanation": "<explanation using student's existing knowledge>",
  "analogies": [
    { "schema": "<known concept>", "analogy": "<how new concept is like the known one>" }
  ],
  "transferablePatterns": ["<pattern from known domain that applies here>"],
  "practiceProblems": ["<practice problem that tests the transferred skill>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 5. Multi-Agent Problem Solving — Decompose complex problems
// ---------------------------------------------------------------------------

deepTutorRouter.post("/multi-agent-solve", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      problem,
      conceptId,
      relatedConcepts = [],
    } = req.body as Record<string, unknown>;

    const prompt = `You are simulating DeepTutor's multi-agent problem-solving system.
Four agents collaborate: Analyzer, Solver, Validator, and Explainer.

Problem: "${problem}"
Primary Concept: ${conceptId}
Related Concepts: ${JSON.stringify(relatedConcepts)}

Simulate the multi-agent discussion and return JSON:
{
  "steps": ["<solution step 1>", "<solution step 2>", "<solution step 3>"],
  "agentResponses": [
    { "agent": "Analyzer", "role": "Breaks down the problem", "contribution": "<analysis>" },
    { "agent": "Solver", "role": "Generates solution approach", "contribution": "<approach>" },
    { "agent": "Validator", "role": "Checks correctness", "contribution": "<validation>" },
    { "agent": "Explainer", "role": "Makes it understandable", "contribution": "<feynman explanation>" }
  ],
  "keyInsights": ["<insight from solving>"],
  "alternativeSolutions": ["<alternative approach>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 6. Exercise Generator — Custom practice problems
// ---------------------------------------------------------------------------

deepTutorRouter.post("/exercise-gen", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      conceptIds = [],
      masteryLevels = {},
      learningStyle = "visual",
      exerciseCount = 5,
    } = req.body as Record<string, unknown>;

    const prompt = `You are DeepTutor's Exercise Generator.

Concepts: ${JSON.stringify(conceptIds)}
Mastery Levels: ${JSON.stringify(masteryLevels)}
Learning Style: ${learningStyle}

Generate ${exerciseCount} practice exercises graduated by difficulty. Return JSON:
{
  "exercises": [
    {
      "id": "ex_<unique>",
      "problem": "<exercise description>",
      "difficulty": "beginner|intermediate|advanced|expert",
      "hints": ["<hint 1>", "<hint 2>"],
      "solution": "<complete solution>",
      "explanation": "<why this is the solution>"
    }
  ]
}`;

    const result = await geminiJSON<{ exercises: unknown[] }>(apiKey, prompt);
    res.json({ exercises: result.exercises ?? [] });
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 7. Idea Generation — Cross-domain concept applications
// ---------------------------------------------------------------------------

deepTutorRouter.post("/idea-gen", async (req: Request, res: Response) => {
  try {
    const apiKey = resolveGeminiKey(req);
    const {
      conceptName,
      domains = ["science", "technology", "business", "art"],
    } = req.body as Record<string, unknown>;

    const prompt = `You are DeepTutor's Idea Generation engine for creative cross-domain thinking.

Concept: "${conceptName}"
Domains to explore: ${JSON.stringify(domains)}

Generate novel applications and cross-domain connections. Return JSON:
{
  "ideas": [
    {
      "domain": "<domain name>",
      "application": "<novel application of this concept in that domain>",
      "novelty": <0.0-1.0>,
      "feasibility": <0.0-1.0>
    }
  ],
  "crossDomainConnections": ["<how concepts in different domains mirror each other>"],
  "researchOpportunities": ["<open research question this concept raises>"]
}`;

    const result = await geminiJSON(apiKey, prompt);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ---------------------------------------------------------------------------
// 8 & 9. Personal Knowledge Base (in-memory)
// ---------------------------------------------------------------------------

deepTutorRouter.post("/knowledge-base/save", async (req: Request, res: Response) => {
  try {
    const { userId, conceptId, notes, tags = [] } = req.body as {
      userId?: string;
      conceptId?: string;
      notes?: string;
      tags?: string[];
    };

    if (!userId || !conceptId || !notes) {
      return res.status(400).json({ error: "userId, conceptId, and notes are required" });
    }

    const userKB = personalKB.get(userId) ?? [];
    const entry = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      conceptId,
      notes,
      tags,
      timestamp: Date.now(),
    };
    userKB.push(entry);
    personalKB.set(userId, userKB);

    res.json({ success: true, id: entry.id });
  } catch (err) {
    handleError(res, err);
  }
});

deepTutorRouter.post("/knowledge-base/search", async (req: Request, res: Response) => {
  try {
    const { userId, query, limit = 10 } = req.body as {
      userId?: string;
      query?: string;
      limit?: number;
    };

    if (!userId || !query) {
      return res.status(400).json({ error: "userId and query are required" });
    }

    const userKB = personalKB.get(userId) ?? [];
    const lower = query.toLowerCase();

    const results = userKB
      .map((entry) => ({
        ...entry,
        relevanceScore:
          (entry.notes.toLowerCase().includes(lower) ? 0.5 : 0) +
          (entry.tags.some((t) => t.toLowerCase().includes(lower)) ? 0.3 : 0) +
          (entry.conceptId.toLowerCase().includes(lower) ? 0.2 : 0),
      }))
      .filter((e) => e.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    res.json({ results });
  } catch (err) {
    handleError(res, err);
  }
});
