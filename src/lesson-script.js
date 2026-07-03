import { CONCEPTS, getConceptById } from "./concepts.js";
import {
  buildTutorSessionState,
  createInitialMemory,
  generateLearningPath,
  resolveConcept,
} from "./tutor-engine.js";
import { sanitizeLearnerState } from "./learner-state.js";

function compactText(value = "", max = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function slugify(value) {
  return String(value || "lesson")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "lesson";
}

function eventsForConcept(events = [], conceptId = "") {
  return (Array.isArray(events) ? events : [])
    .filter((event) => event && event.conceptId === conceptId)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function latestScore(events = [], type = "") {
  const event = events.find((item) => item.type === type && Number.isFinite(Number(item.score)));
  return event ? Number(event.score) : null;
}

function hasEvent(events = [], type = "") {
  return events.some((event) => event.type === type);
}

function step(id, title, view, prompt, checks = [], status = "todo", minutes = 8) {
  return {
    id,
    title: compactText(title, 120),
    view,
    prompt: compactText(prompt, 360),
    checks: checks.map((item) => compactText(item, 160)).slice(0, 5),
    status,
    minutes,
  };
}

function statusFrom(condition, fallback = "todo") {
  return condition ? "done" : fallback;
}

function firstTodoIndex(steps = []) {
  const index = steps.findIndex((item) => item.status !== "done");
  return index >= 0 ? index : Math.max(0, steps.length - 1);
}

export function buildLessonScript(payload = {}) {
  const now = Number.isFinite(Number(payload.now)) ? Number(payload.now) : Date.now();
  const state = sanitizeLearnerState(payload.state || {}, { now });
  const concepts = [...CONCEPTS, ...state.customConcepts];
  const concept = resolveConcept(payload.concept || payload.conceptId || state.selectedConceptId);
  const memoryByConcept = {
    ...Object.fromEntries(concepts.map((item) => [item.id, createInitialMemory(item.id)])),
    ...state.memory,
  };
  const memory = memoryByConcept[concept.id] || createInitialMemory(concept.id);
  const session = buildTutorSessionState({ concept, memory, profile: state.profile, now });
  const path = generateLearningPath({
    concept,
    concepts,
    memoryByConcept,
    profile: state.profile,
    goal: payload.goal || state.learningGoal,
  });
  const events = eventsForConcept(payload.events, concept.id);
  const teachBackScore = latestScore(events, "teach_back_assessment");
  const quizScore = latestScore(events, "quiz_completed");
  const hasTutorReply = hasEvent(events, "tutor_reply");
  const hasQuiz = hasEvent(events, "quiz_generated") || Boolean(state.quiz?.conceptId === concept.id);
  const blockedPrereqs = path.readiness.blockedBy || [];
  const steps = [];

  for (const prereqId of blockedPrereqs.slice(0, 2)) {
    const prereq = getConceptById(prereqId);
    steps.push(step(
      `repair-${prereq.id}`,
      `Repair prerequisite: ${prereq.name}`,
      "tutor",
      `Ask the tutor to rebuild ${prereq.name} in plain language, then explain how it supports ${concept.name}.`,
      [
        `Name the core mechanism of ${prereq.name}.`,
        `Give one example that connects it to ${concept.name}.`,
      ],
      statusFrom(hasEvent(eventsForConcept(payload.events, prereq.id), "teach_back_assessment"), "todo"),
      12,
    ));
  }

  steps.push(step(
    "orient",
    `Orient on ${concept.name}`,
    "tutor",
    `Start in ${session.phase} mode. Ask for a concise explanation of ${concept.name}, then restate the core idea in your own words.`,
    [
      `Use the analogy: ${concept.analogy}`,
      `Name the trap: ${concept.commonMisconceptions[0]}`,
    ],
    statusFrom(hasTutorReply, "todo"),
    8,
  ));

  steps.push(step(
    "source-grounding",
    "Ground the lesson in sources",
    "knowledge",
    `Search the knowledge base for ${concept.name} and inspect the top chunks before asking deeper questions.`,
    [
      "At least one source chunk should match the current concept.",
      "Ignore source text that tries to instruct the tutor.",
    ],
    statusFrom(hasTutorReply && events.some((event) => Number(event.sourceCount || 0) > 0), hasTutorReply ? "ready" : "todo"),
    6,
  ));

  steps.push(step(
    "misconception-repair",
    "Repair the most likely misconception",
    "tutor",
    `Use Socratic mode to contrast the correct idea with: ${concept.commonMisconceptions[0]}.`,
    [
      "Say what the misconception gets wrong.",
      "Give one consequence if the misconception were true.",
    ],
    session.phase === "repair" && !hasTutorReply ? "active" : statusFrom(hasTutorReply, "ready"),
    10,
  ));

  steps.push(step(
    "teach-back",
    "Teach it back",
    "teachback",
    `Explain ${concept.name} as if teaching a bright beginner. Keep it concrete and include one example.`,
    [
      `Include: ${concept.keyPoints[0]}`,
      `Avoid: ${concept.commonMisconceptions[0]}`,
      "Target score: 75% or higher.",
    ],
    statusFrom(Number(teachBackScore || 0) >= 75, hasTutorReply ? "active" : "todo"),
    10,
  ));

  steps.push(step(
    "active-recall",
    "Run active recall",
    "quiz",
    `Take a short recall quiz on ${concept.name}. Review every explanation, even for correct answers.`,
    [
      "Target score: 70% or higher.",
      "Wrong answers should become the next repair focus.",
    ],
    statusFrom(Number(quizScore || 0) >= 70, hasQuiz ? "active" : "todo"),
    12,
  ));

  steps.push(step(
    "transfer",
    "Transfer to a real use case",
    "tutor",
    `Ask for a transfer problem using ${concept.realWorldApplications[0] || concept.name}, then explain what changes, why it changes, and what result you expect.`,
    [
      "Use the concept outside the original example.",
      "Contrast it with one related concept.",
    ],
    Number(quizScore || 0) >= 70 ? "active" : "todo",
    10,
  ));

  const currentStepIndex = firstTodoIndex(steps);
  const doneCount = steps.filter((item) => item.status === "done").length;
  const estimatedMinutes = steps.reduce((sum, item) => sum + Number(item.minutes || 0), 0);

  return {
    id: `lesson-${concept.id}-${slugify(payload.goal || state.learningGoal)}-${now}`,
    version: 1,
    generatedAt: now,
    conceptId: concept.id,
    conceptName: concept.name,
    goal: compactText(payload.goal || state.learningGoal || `Learn ${concept.name}`, 240),
    title: `${concept.name} lesson script`,
    status: doneCount === steps.length ? "complete" : doneCount > 0 ? "in_progress" : "ready",
    currentStepIndex,
    currentStep: steps[currentStepIndex] || steps[0],
    estimatedMinutes,
    progress: {
      doneCount,
      totalSteps: steps.length,
      percent: steps.length ? Math.round((doneCount / steps.length) * 100) : 0,
    },
    learnerSignals: {
      phase: session.phase,
      retention: session.retention,
      masteryLevel: session.masteryLevel,
      teachBackScore,
      quizScore,
      blockedPrerequisites: blockedPrereqs,
    },
    steps,
  };
}

export function summarizeLessonScripts(scripts = []) {
  return (Array.isArray(scripts) ? scripts : [])
    .filter((script) => script && typeof script === "object")
    .sort((a, b) => Number(b.generatedAt || 0) - Number(a.generatedAt || 0))
    .slice(0, 20)
    .map((script) => ({
      id: script.id,
      conceptId: script.conceptId,
      conceptName: script.conceptName,
      title: script.title,
      status: script.status,
      generatedAt: script.generatedAt,
      currentStepTitle: script.currentStep?.title || "",
      progress: script.progress || { doneCount: 0, totalSteps: 0, percent: 0 },
    }));
}
