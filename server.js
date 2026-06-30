import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { CONCEPTS } from "./src/concepts.js";
import {
  applySemanticEmbeddings,
  buildKnowledgeBase,
  conceptDocuments,
  getDocumentChunks,
  retrieveKnowledgeContext,
  searchKnowledgeBase,
  summarizeKnowledgeBase,
} from "./src/knowledge-base.js";
import {
  analyzeTeachBackWithLlm,
  generateQuizWithLlm,
  generateTutorReplyWithLlm,
  getLlmConfig,
  probeLlm,
} from "./src/local-llm.js";
import { scoreTutorReply } from "./src/tutor-eval.js";
import { assessPromptInjectionRisk } from "./src/prompt-guard.js";
import { resolveConcept } from "./src/tutor-engine.js";
import {
  appendLearnerEvent,
  createLearnerEvent,
  summarizeLearnerEvents,
} from "./src/learner-records.js";
import {
  sanitizeLearnerState,
  summarizeLearnerState,
} from "./src/learner-state.js";
import { buildSmartResume } from "./src/smart-resume.js";
import {
  createEmbeddingProvider,
} from "./src/embedding-provider.js";
import {
  buildLessonScript,
  summarizeLessonScripts,
} from "./src/lesson-script.js";
import { buildCitationNotebook } from "./src/citation-notebook.js";
import { buildCourseOutline } from "./src/course-outline.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(__dirname, "public");
const srcRoot = resolve(__dirname, "src");
const dataRoot = process.env.DATA_ROOT ? resolve(process.env.DATA_ROOT) : resolve(__dirname, "data");
const userKnowledgePath = resolve(dataRoot, "user-knowledge.json");
const learnerEventsPath = resolve(dataRoot, "learner-events.json");
const learnerStatePath = resolve(dataRoot, "learner-state.json");
const lessonScriptsPath = resolve(dataRoot, "lesson-scripts.json");
const port = Number(process.env.PORT || 5173);

let userKnowledgeDocuments = [];
let learnerEvents = [];
let learnerState = sanitizeLearnerState({ updatedAt: 0 }, { now: 0 });
let lessonScripts = [];
const embeddingProvider = createEmbeddingProvider();
let knowledgeBase = buildKnowledgeBase(conceptDocuments(CONCEPTS));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readRequestBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function loadUserKnowledgeDocuments() {
  try {
    const raw = await readFile(userKnowledgePath, "utf8");
    const parsed = JSON.parse(raw);
    userKnowledgeDocuments = Array.isArray(parsed.documents) ? parsed.documents : [];
  } catch {
    userKnowledgeDocuments = [];
  }
  await rebuildKnowledgeBase();
}

async function saveUserKnowledgeDocuments() {
  await mkdir(dataRoot, { recursive: true });
  await writeFile(
    userKnowledgePath,
    JSON.stringify({ documents: userKnowledgeDocuments }, null, 2),
    "utf8",
  );
}

async function loadLearnerEvents() {
  try {
    const raw = await readFile(learnerEventsPath, "utf8");
    const parsed = JSON.parse(raw);
    learnerEvents = Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    learnerEvents = [];
  }
}

async function saveLearnerEvents() {
  await mkdir(dataRoot, { recursive: true });
  await writeFile(
    learnerEventsPath,
    JSON.stringify({ events: learnerEvents }, null, 2),
    "utf8",
  );
}

async function loadLessonScripts() {
  try {
    const raw = await readFile(lessonScriptsPath, "utf8");
    const parsed = JSON.parse(raw);
    lessonScripts = Array.isArray(parsed.scripts) ? parsed.scripts : [];
  } catch {
    lessonScripts = [];
  }
}

async function saveLessonScripts() {
  await mkdir(dataRoot, { recursive: true });
  await writeFile(
    lessonScriptsPath,
    JSON.stringify({ scripts: lessonScripts }, null, 2),
    "utf8",
  );
}

function latestLessonScript(conceptId = learnerState.selectedConceptId) {
  return [...lessonScripts]
    .filter((script) => !conceptId || script.conceptId === conceptId)
    .sort((a, b) => Number(b.generatedAt || 0) - Number(a.generatedAt || 0))[0] || null;
}

function refreshSavedLessonScript(script) {
  if (!script) return null;
  return buildLessonScript({
    state: learnerState,
    events: learnerEvents,
    conceptId: script.conceptId,
    goal: script.goal,
    now: script.generatedAt || Date.now(),
  });
}

async function generateAndSaveLessonScript(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId || learnerState.selectedConceptId);
  const script = buildLessonScript({
    state: payload.state || learnerState,
    events: learnerEvents,
    concept,
    goal: payload.goal,
  });
  lessonScripts = [
    script,
    ...lessonScripts.filter((item) => item.id !== script.id),
  ]
    .sort((a, b) => Number(b.generatedAt || 0) - Number(a.generatedAt || 0))
    .slice(0, 40);
  await saveLessonScripts();
  return script;
}

async function loadLearnerState() {
  try {
    const raw = await readFile(learnerStatePath, "utf8");
    const parsed = JSON.parse(raw);
    const savedState = parsed.state || parsed;
    learnerState = sanitizeLearnerState(savedState, {
      now: savedState.updatedAt || parsed.updatedAt || Date.now(),
    });
  } catch {
    learnerState = sanitizeLearnerState({ updatedAt: 0 }, { now: 0 });
  }
}

async function saveLearnerState(nextState) {
  learnerState = sanitizeLearnerState(nextState);
  await mkdir(dataRoot, { recursive: true });
  await writeFile(
    learnerStatePath,
    JSON.stringify({ state: learnerState }, null, 2),
    "utf8",
  );
  return learnerState;
}

async function appendLearnerEventAndSave(type, data = {}, options = {}) {
  const event = createLearnerEvent(type, data, options);
  learnerEvents = appendLearnerEvent(learnerEvents, event, 500);
  await saveLearnerEvents();
  return event;
}

async function appendLearnerEventBestEffort(type, data = {}) {
  try {
    return await appendLearnerEventAndSave(type, data);
  } catch (error) {
    console.warn("Could not save learner event:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function rebuildKnowledgeBase() {
  const nextKnowledgeBase = buildKnowledgeBase([...conceptDocuments(CONCEPTS), ...userKnowledgeDocuments]);
  knowledgeBase = await applySemanticEmbeddings(nextKnowledgeBase, embeddingProvider);
}

function createUserKnowledgeDocument(payload = {}) {
  const title = String(payload.title || "Untitled learning note").trim().slice(0, 120);
  const text = String(payload.text || payload.content || "").trim();
  const source = String(payload.source || "pasted note").trim().slice(0, 160);
  const conceptId = payload.conceptId ? String(payload.conceptId) : "";

  if (title.length < 2) throw new Error("Knowledge document title is required");
  if (text.length < 80) throw new Error("Knowledge document text must be at least 80 characters");
  if (text.length > 200000) throw new Error("Knowledge document text is too large for this MVP");

  return {
    id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    text,
    source,
    conceptId,
    createdAt: Date.now(),
    guardrail: assessPromptInjectionRisk(text),
  };
}

function findKnowledgeDocument(id) {
  return knowledgeBase.documents.find((document) => document.id === id);
}

function retrievalQueryFor(payload = {}, purpose = "tutor") {
  const concept = resolveConcept(payload.concept || payload.conceptId || payload.topic || payload.goal);
  const parts = [
    purpose,
    concept.name,
    concept.description,
    payload.message,
    payload.explanation,
    payload.studentExplanation,
    payload.learningGoal,
    payload.goal,
  ];
  return {
    concept,
    query: parts.filter(Boolean).join("\n"),
  };
}

async function queryEmbeddingFor(query) {
  if (!knowledgeBase?.stats?.embedding?.remote || !embeddingProvider?.config?.remote) {
    return { queryEmbedding: null, semanticWeight: undefined };
  }

  try {
    const result = await embeddingProvider.embedMany([query]);
    return {
      queryEmbedding: result.vectors[0],
      semanticWeight: 0.65,
    };
  } catch {
    return {
      queryEmbedding: null,
      semanticWeight: 0,
    };
  }
}

async function enrichWithKnowledge(payload = {}, purpose = "tutor") {
  const { concept, query } = retrievalQueryFor(payload, purpose);
  const embedding = await queryEmbeddingFor(query);
  const retrieval = retrieveKnowledgeContext(knowledgeBase, {
    query,
    conceptId: concept.id,
    prerequisiteConceptIds: concept.prerequisites,
    relatedConceptIds: concept.relatedConcepts,
    maxPerDocument: 3,
    topK: purpose === "quiz" ? 6 : 5,
    maxChars: purpose === "quiz" ? 6500 : 5200,
    ...embedding,
  });

  return {
    ...payload,
    concept,
    retrieval,
  };
}

function safeResolve(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const cleanPath = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const fullPath = resolve(root, cleanPath);
  const pathFromRoot = relative(root, fullPath);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !pathFromRoot.includes(`..${sep}`))
    ? fullPath
    : null;
}

async function serveStatic(req, res, pathname) {
  let root = publicRoot;
  let filePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");

  if (pathname.startsWith("/src/")) {
    root = srcRoot;
    filePath = pathname.replace(/^\/src\//, "");
  }

  const fullPath = safeResolve(root, filePath);
  if (!fullPath) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const info = await stat(fullPath);
    if (!info.isFile()) {
      json(res, 404, { error: "Not found" });
      return;
    }

    const body = await readFile(fullPath);
    const type = contentTypes[extname(fullPath)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": body.length,
      "Cache-Control": pathname.startsWith("/src/") ? "no-store" : "public, max-age=60",
    });
    res.end(body);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      json(res, 200, { ok: true, name: "neuro-tutor-web", llm: getLlmConfig() });
      return;
    }

    if (req.method === "GET" && pathname === "/api/llm/health") {
      json(res, 200, await probeLlm());
      return;
    }

    if (req.method === "GET" && pathname === "/api/kb") {
      json(res, 200, { ok: true, ...summarizeKnowledgeBase(knowledgeBase) });
      return;
    }

    if (req.method === "GET" && pathname === "/api/kb/embeddings/health") {
      const health = await embeddingProvider.probe();
      json(res, 200, {
        ok: true,
        active: summarizeKnowledgeBase(knowledgeBase).embedding,
        provider: health,
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/learner/events") {
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 12), 100));
      json(res, 200, {
        ok: true,
        summary: summarizeLearnerEvents(learnerEvents, limit),
        events: learnerEvents.slice(-limit).reverse(),
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/learner/citations") {
      const conceptId = url.searchParams.get("conceptId") || "";
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 80), 300));
      json(res, 200, {
        ok: true,
        notebook: buildCitationNotebook(learnerEvents, { conceptId, limit }),
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/learner/state") {
      json(res, 200, {
        ok: true,
        state: learnerState,
        summary: summarizeLearnerState(learnerState),
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/learner/resume") {
      json(res, 200, {
        ok: true,
        resume: buildSmartResume({
          state: learnerState,
          events: learnerEvents,
        }),
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/learner/course-outline") {
      const conceptId = url.searchParams.get("conceptId") || learnerState.selectedConceptId;
      json(res, 200, {
        ok: true,
        outline: buildCourseOutline({
          state: learnerState,
          events: learnerEvents,
          conceptId,
          knowledgeSummary: summarizeKnowledgeBase(knowledgeBase),
        }),
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/learner/course-outline") {
      const payload = await readRequestBody(req);
      json(res, 200, {
        ok: true,
        outline: buildCourseOutline({
          state: payload.state || learnerState,
          events: learnerEvents,
          concept: payload.concept,
          conceptId: payload.conceptId,
          goal: payload.goal,
          knowledgeSummary: summarizeKnowledgeBase(knowledgeBase),
        }),
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/learner/lesson-script") {
      const conceptId = url.searchParams.get("conceptId") || learnerState.selectedConceptId;
      const saved = latestLessonScript(conceptId);
      const script = saved ? refreshSavedLessonScript(saved) : buildLessonScript({
        state: learnerState,
        events: learnerEvents,
        conceptId,
      });
      json(res, 200, {
        ok: true,
        saved: Boolean(saved),
        script,
        scripts: summarizeLessonScripts(lessonScripts),
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/learner/lesson-script") {
      const payload = await readRequestBody(req);
      const script = await generateAndSaveLessonScript(payload);
      json(res, 201, {
        ok: true,
        script,
        scripts: summarizeLessonScripts(lessonScripts),
      });
      return;
    }

    if ((req.method === "PUT" || req.method === "POST") && pathname === "/api/learner/state") {
      const payload = await readRequestBody(req);
      const state = await saveLearnerState(payload.state || payload);
      json(res, 200, {
        ok: true,
        state,
        summary: summarizeLearnerState(state),
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/learner/events") {
      const payload = await readRequestBody(req);
      const event = await appendLearnerEventAndSave(payload.type, payload);
      json(res, 201, {
        ok: true,
        event,
        summary: summarizeLearnerEvents(learnerEvents),
      });
      return;
    }

    const chunkMatch = pathname.match(/^\/api\/kb\/documents\/([^/]+)\/chunks$/);
    if (req.method === "GET" && chunkMatch) {
      const documentId = decodeURIComponent(chunkMatch[1]);
      const document = findKnowledgeDocument(documentId);
      if (!document) {
        json(res, 404, { error: "Knowledge document not found" });
        return;
      }
      json(res, 200, {
        ok: true,
        document: {
          id: document.id,
          title: document.title,
          source: document.source,
          conceptId: document.conceptId,
          guardrail: document.guardrail,
          textLength: document.text.length,
          createdAt: document.createdAt,
          userEditable: document.id.startsWith("user-"),
        },
        chunks: getDocumentChunks(knowledgeBase, documentId),
      });
      return;
    }

    const documentMatch = pathname.match(/^\/api\/kb\/documents\/([^/]+)$/);
    if (req.method === "DELETE" && documentMatch) {
      const documentId = decodeURIComponent(documentMatch[1]);
      const existing = findKnowledgeDocument(documentId);
      if (!existing) {
        json(res, 404, { error: "Knowledge document not found" });
        return;
      }
      if (!documentId.startsWith("user-")) {
        json(res, 403, { error: "Built-in concept documents cannot be deleted" });
        return;
      }
      userKnowledgeDocuments = userKnowledgeDocuments.filter((document) => document.id !== documentId);
      await rebuildKnowledgeBase();
      await saveUserKnowledgeDocuments();
      json(res, 200, { ok: true, deletedDocumentId: documentId, ...summarizeKnowledgeBase(knowledgeBase) });
      return;
    }

    if (req.method === "POST" && pathname === "/api/kb/search") {
      const payload = await readRequestBody(req);
      const concept = resolveConcept(payload.concept || payload.conceptId || payload.query);
      const query = payload.query || concept.name;
      const embedding = await queryEmbeddingFor(query);
      const results = searchKnowledgeBase(knowledgeBase, query, {
        conceptId: payload.conceptId || concept.id,
        prerequisiteConceptIds: concept.prerequisites,
        relatedConceptIds: concept.relatedConcepts,
        maxPerDocument: 3,
        topK: payload.topK || 6,
        ...embedding,
      });
      json(res, 200, { ok: true, results });
      return;
    }

    if (req.method === "POST" && pathname === "/api/kb/documents") {
      const payload = await readRequestBody(req);
      const document = createUserKnowledgeDocument(payload);
      userKnowledgeDocuments.push(document);
      await rebuildKnowledgeBase();
      await saveUserKnowledgeDocuments();
      await appendLearnerEventBestEffort("knowledge_document_added", {
        conceptId: document.conceptId,
        conceptName: resolveConcept(document.conceptId || document.title).name,
        note: document.title,
        source: document.source,
      });
      json(res, 201, {
        ok: true,
        document: {
          id: document.id,
          title: document.title,
          source: document.source,
          conceptId: document.conceptId,
          guardrail: document.guardrail,
          textLength: document.text.length,
          createdAt: document.createdAt,
        },
        ...summarizeKnowledgeBase(knowledgeBase),
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/tutor") {
      const payload = await readRequestBody(req);
      const enriched = await enrichWithKnowledge(payload, "tutor");
      const reply = await generateTutorReplyWithLlm(enriched);
      const quality = scoreTutorReply(
        {
          id: `live-${enriched.concept.id}-${Date.now()}`,
          concept: enriched.concept,
          mode: enriched.mode || payload.mode || "explainer",
          message: payload.message || "",
          profile: payload.profile || {},
          expectedKeyPoints: enriched.concept.keyPoints.slice(0, 4),
          expectedMisconceptions: enriched.concept.commonMisconceptions.slice(0, 3),
          requiresCitation: Boolean(reply.sources?.length),
        },
        reply,
      );
      const scoredReply = {
        ...reply,
        quality,
      };
      await appendLearnerEventBestEffort("tutor_reply", {
        concept: enriched.concept,
        mode: enriched.mode,
        provider: scoredReply.provider,
        model: scoredReply.model,
        fallbackReason: scoredReply.fallbackReason,
        evidenceTrace: scoredReply.evidenceTrace,
        sources: scoredReply.sources,
        quality,
        message: payload.message,
      });
      json(res, 200, scoredReply);
      return;
    }

    if (req.method === "POST" && pathname === "/api/analyze") {
      const payload = await readRequestBody(req);
      const enriched = await enrichWithKnowledge(payload, "teach-back");
      const analysis = await analyzeTeachBackWithLlm(enriched);
      await appendLearnerEventBestEffort("teach_back_assessment", {
        concept: enriched.concept,
        provider: analysis.provider,
        model: analysis.model,
        score: analysis.accuracy,
        missingPoints: analysis.missingPoints,
        misconceptions: analysis.misconceptions,
        fallbackReason: analysis.fallbackReason,
        evidenceTrace: analysis.evidenceTrace,
        sources: analysis.sources,
        explanation: payload.explanation || payload.studentExplanation,
      });
      json(res, 200, analysis);
      return;
    }

    if (req.method === "POST" && pathname === "/api/quiz") {
      const payload = await readRequestBody(req);
      const enriched = await enrichWithKnowledge(payload, "quiz");
      const quiz = await generateQuizWithLlm(enriched);
      await appendLearnerEventBestEffort("quiz_generated", {
        concept: enriched.concept,
        provider: quiz.provider,
        model: quiz.model,
        questionCount: quiz.questions?.length || 0,
        fallbackReason: quiz.fallbackReason,
        evidenceTrace: quiz.evidenceTrace,
        sources: quiz.sources,
        note: payload.learningGoal || payload.goal,
      });
      json(res, 200, quiz);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    json(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error",
    });
  }
});

await loadUserKnowledgeDocuments();
await loadLearnerEvents();
await loadLessonScripts();
await loadLearnerState();

server.listen(port, "127.0.0.1", () => {
  console.log(`NeuroTutor running at http://127.0.0.1:${port}`);
});
