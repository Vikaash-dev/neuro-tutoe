import { CONCEPTS, getConceptById } from "./concepts.js";
import {
  createInitialMemory,
  estimateRetention,
  generateLearningPath,
  masteryPercent,
  resolveConcept,
} from "./tutor-engine.js";
import { sanitizeLearnerState } from "./learner-state.js";

function compactText(value = "", max = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function statusForConcept(conceptId, state, events, now) {
  const memory = state.memory[conceptId] || createInitialMemory(conceptId);
  const teachBack = events
    .filter((event) => event.conceptId === conceptId && event.type === "teach_back_assessment")
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
  const quiz = events
    .filter((event) => event.conceptId === conceptId && event.type === "quiz_completed")
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
  const retention = estimateRetention(memory, now);
  const mastery = masteryPercent(memory.masteryLevel);

  if (Number(quiz?.score || 0) >= 80 && Number(teachBack?.score || 0) >= 80) return "complete";
  if (Number(quiz?.score || 0) >= 70 || Number(teachBack?.score || 0) >= 75 || memory.reviewCount > 0) return "practice";
  if (retention < 45 || mastery < 40) return "repair";
  return "ready";
}

function conceptById(concepts, id) {
  return concepts.find((concept) => concept.id === id) || getConceptById(id);
}

function uniqueConceptIds(values = []) {
  return values.filter(Boolean).filter((id, index, arr) => arr.indexOf(id) === index);
}

function sourceCoverageFor(conceptId, knowledgeSummary = {}) {
  const documents = Array.isArray(knowledgeSummary.documents) ? knowledgeSummary.documents : [];
  const matchingDocuments = documents.filter((document) => document.conceptId === conceptId);
  const globalDocuments = documents.filter((document) => !document.conceptId);

  return {
    documentCount: matchingDocuments.length,
    globalDocumentCount: globalDocuments.length,
    hasDedicatedSource: matchingDocuments.length > 0,
    sourceTitles: matchingDocuments.slice(0, 4).map((document) => document.title),
  };
}

function moduleForConcept({ concept, role, state, events, knowledgeSummary, now, sequence }) {
  const status = statusForConcept(concept.id, state, events, now);
  const coverage = sourceCoverageFor(concept.id, knowledgeSummary);
  const minutes = role === "prerequisite" ? 30 : role === "extension" ? 25 : 45;

  return {
    id: `module-${sequence}-${concept.id}`,
    sequence,
    conceptId: concept.id,
    conceptName: concept.name,
    role,
    title: role === "prerequisite"
      ? `Repair prerequisite: ${concept.name}`
      : role === "extension"
        ? `Transfer into ${concept.name}`
        : `Core course module: ${concept.name}`,
    status,
    minutes,
    sourceCoverage: coverage,
    objectives: [
      concept.keyPoints[0],
      concept.keyPoints[1],
      `Avoid: ${concept.commonMisconceptions[0]}`,
    ].filter(Boolean).map((item) => compactText(item, 160)),
    checkpoints: [
      {
        id: `${concept.id}-source`,
        view: "knowledge",
        label: coverage.hasDedicatedSource ? "Inspect dedicated source chunks" : "Search KB and add a dedicated source if needed",
        target: coverage.hasDedicatedSource ? "source ready" : "source gap",
      },
      {
        id: `${concept.id}-teachback`,
        view: "teachback",
        label: `Teach back ${concept.name} in plain language`,
        target: "75% teach-back",
      },
      {
        id: `${concept.id}-quiz`,
        view: "quiz",
        label: `Run active recall on ${concept.name}`,
        target: "70% quiz",
      },
      {
        id: `${concept.id}-transfer`,
        view: "tutor",
        label: `Apply ${concept.name} to ${concept.realWorldApplications[0] || "a real scenario"}`,
        target: "transfer answer",
      },
    ],
  };
}

export function buildCourseOutline(payload = {}) {
  const now = Number.isFinite(Number(payload.now)) ? Number(payload.now) : Date.now();
  const state = sanitizeLearnerState(payload.state || {}, { now });
  const concepts = [...CONCEPTS, ...state.customConcepts];
  const target = resolveConcept(payload.concept || payload.conceptId || state.selectedConceptId);
  const conceptMap = Object.fromEntries(concepts.map((concept) => [concept.id, concept]));
  const targetConcept = conceptMap[target.id] ? { ...conceptMap[target.id], ...target } : target;
  const memoryByConcept = {
    ...Object.fromEntries(concepts.map((concept) => [concept.id, createInitialMemory(concept.id)])),
    ...state.memory,
  };
  const events = Array.isArray(payload.events) ? payload.events : [];
  const learningPath = generateLearningPath({
    concept: targetConcept,
    concepts,
    memoryByConcept,
    profile: state.profile,
    goal: payload.goal || state.learningGoal,
  });
  const moduleIds = uniqueConceptIds([
    ...targetConcept.prerequisites,
    targetConcept.id,
    ...targetConcept.relatedConcepts.slice(0, 2),
  ]);
  const modules = moduleIds.map((id, index) => {
    const concept = id === targetConcept.id ? targetConcept : conceptById(concepts, id);
    const role = id === targetConcept.id ? "core" : targetConcept.prerequisites.includes(id) ? "prerequisite" : "extension";
    return moduleForConcept({
      concept,
      role,
      state: { ...state, memory: memoryByConcept },
      events,
      knowledgeSummary: payload.knowledgeSummary || {},
      now,
      sequence: index + 1,
    });
  });
  const doneCount = modules.filter((module) => module.status === "complete").length;
  const sourceReadyCount = modules.filter((module) => module.sourceCoverage.hasDedicatedSource).length;
  const minutes = modules.reduce((sum, module) => sum + Number(module.minutes || 0), 0);

  return {
    id: `course-${targetConcept.id}-${now}`,
    version: 1,
    generatedAt: now,
    conceptId: targetConcept.id,
    conceptName: targetConcept.name,
    goal: compactText(payload.goal || state.learningGoal || `Learn ${targetConcept.name}`, 240),
    title: `${targetConcept.name} course outline`,
    status: doneCount === modules.length ? "complete" : doneCount > 0 ? "in_progress" : "ready",
    estimatedMinutes: minutes,
    progress: {
      doneCount,
      totalModules: modules.length,
      percent: modules.length ? Math.round((doneCount / modules.length) * 100) : 0,
    },
    sourceCoverage: {
      readyModules: sourceReadyCount,
      totalModules: modules.length,
      documentCount: Number(payload.knowledgeSummary?.documentCount || 0),
      chunkCount: Number(payload.knowledgeSummary?.chunkCount || 0),
    },
    readiness: learningPath.readiness,
    modules,
  };
}
