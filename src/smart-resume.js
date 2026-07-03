import { CONCEPTS } from "./concepts.js";
import {
  buildTutorSessionState,
  estimateRetention,
  masteryPercent,
} from "./tutor-engine.js";
import { sanitizeLearnerState } from "./learner-state.js";

function conceptLabel(conceptId, concepts, fallback = "") {
  const concept = concepts.find((item) => item.id === conceptId);
  return concept?.name || fallback || conceptId;
}

function compactText(value = "", max = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function sortedEvents(events = []) {
  return [...(Array.isArray(events) ? events : [])]
    .filter((event) => event && typeof event === "object")
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function defaultMemory(conceptId, now) {
  return {
    conceptId,
    memoryType: "short_term",
    masteryLevel: "novice",
    retentionScore: 35,
    lastReviewDate: now,
    nextReviewDate: now,
    reviewCount: 0,
    correctAnswers: 0,
    totalAttempts: 0,
    sessionLearned: now,
    consolidationProgress: 0,
    stabilityDays: 1,
  };
}

function dueReviewItems(memory = {}, concepts = CONCEPTS, now = Date.now()) {
  return Object.values(memory)
    .filter((item) => item && typeof item === "object" && Number(item.nextReviewDate || 0) <= now)
    .map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptLabel(item.conceptId, concepts),
      retention: estimateRetention(item, now),
      mastery: item.masteryLevel || "novice",
      reviewCount: Number(item.reviewCount || 0),
      nextReviewDate: Number(item.nextReviewDate || 0),
    }))
    .sort((a, b) => a.nextReviewDate - b.nextReviewDate || a.retention - b.retention)
    .slice(0, 5);
}

function weakMemoryItems(memory = {}, concepts = CONCEPTS, now = Date.now()) {
  return Object.values(memory)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      conceptId: item.conceptId,
      conceptName: conceptLabel(item.conceptId, concepts),
      retention: estimateRetention(item, now),
      masteryPercent: masteryPercent(item.masteryLevel),
      attempts: Number(item.totalAttempts || 0),
    }))
    .sort((a, b) => (a.retention + a.masteryPercent) - (b.retention + b.masteryPercent))
    .slice(0, 5);
}

function action(id, label, view, reason, priority = 3) {
  return {
    id,
    label: compactText(label, 140),
    view,
    reason: compactText(reason, 180),
    priority,
  };
}

function buildActionList({ cleanState, currentConcept, session, dueReviews, weakAreas, recentEvents }) {
  const actions = [
    action(
      "current-next-action",
      session.nextAction.label,
      session.nextAction.view,
      `${session.phase} phase for ${currentConcept.name}`,
      1,
    ),
  ];

  if (cleanState.quiz && !cleanState.quiz.complete) {
    actions.push(action(
      "continue-active-quiz",
      `Finish the active ${currentConcept.name} recall set`,
      "quiz",
      `${cleanState.quiz.questionCount || cleanState.quiz.questions?.length || 0} questions saved in progress`,
      1,
    ));
  }

  if (dueReviews.length > 0) {
    actions.push(action(
      "review-due-memory",
      `Review ${dueReviews[0].conceptName}`,
      "quiz",
      `${dueReviews.length} concept${dueReviews.length === 1 ? "" : "s"} due now; ${dueReviews[0].retention}% retention`,
      2,
    ));
  }

  if (cleanState.lastTeachBack && cleanState.lastTeachBack.accuracy < 75) {
    actions.push(action(
      "repair-teach-back",
      `Repair teach-back gaps in ${conceptLabel(cleanState.lastTeachBack.conceptId, [currentConcept])}`,
      "teachback",
      `${cleanState.lastTeachBack.accuracy}% teach-back score with ${cleanState.lastTeachBack.missingPoints.length} missing point${cleanState.lastTeachBack.missingPoints.length === 1 ? "" : "s"}`,
      2,
    ));
  }

  const lastQuiz = recentEvents.find((event) => event.type === "quiz_completed" && Number.isFinite(Number(event.score)));
  if (lastQuiz && Number(lastQuiz.score) < 70) {
    actions.push(action(
      "retry-low-quiz",
      `Retry weak quiz topic: ${lastQuiz.conceptName || lastQuiz.conceptId}`,
      "quiz",
      `Latest quiz score was ${lastQuiz.score}%`,
      2,
    ));
  }

  if (weakAreas.length > 0) {
    actions.push(action(
      "weakest-memory",
      `Strengthen ${weakAreas[0].conceptName}`,
      "teachback",
      `${weakAreas[0].retention}% retention and ${weakAreas[0].masteryPercent}% mastery`,
      3,
    ));
  }

  return actions
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
}

export function buildSmartResume(payload = {}) {
  const now = Number.isFinite(Number(payload.now)) ? Number(payload.now) : Date.now();
  const cleanState = sanitizeLearnerState(payload.state || {}, { now });
  const concepts = [...CONCEPTS, ...cleanState.customConcepts];
  const currentConcept =
    concepts.find((concept) => concept.id === cleanState.selectedConceptId) ||
    concepts[0] ||
    CONCEPTS[0];
  const currentMemory = cleanState.memory[currentConcept.id] || defaultMemory(currentConcept.id, now);
  const session = buildTutorSessionState({
    concept: currentConcept,
    memory: currentMemory,
    profile: cleanState.profile,
    now,
  });
  const recentEvents = sortedEvents(payload.events).slice(0, 8);
  const dueReviews = dueReviewItems(cleanState.memory, concepts, now);
  const weakAreas = weakMemoryItems(cleanState.memory, concepts, now);
  const actions = buildActionList({
    cleanState,
    currentConcept,
    session,
    dueReviews,
    weakAreas,
    recentEvents,
  });
  const lastEvent = recentEvents[0] || null;
  const known = cleanState.profile.knownConcepts.slice(0, 4);
  const struggling = cleanState.profile.strugglingConcepts.slice(0, 4);

  return {
    generatedAt: now,
    currentConcept: {
      id: currentConcept.id,
      name: currentConcept.name,
      difficulty: currentConcept.difficulty,
    },
    headline: actions[0]?.label || session.nextAction.label,
    summary: compactText(
      `${session.phase} phase. ${session.focusPoints.slice(0, 2).join(" ")}${
        lastEvent ? ` Last event: ${lastEvent.type.replaceAll("_", " ")}.` : ""
      }`,
      260,
    ),
    nextAction: actions[0] || action("current-next-action", session.nextAction.label, session.nextAction.view, session.phase, 1),
    actions,
    focusPoints: session.focusPoints.slice(0, 4),
    dueReviews,
    weakAreas,
    recentActivity: recentEvents.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      conceptId: event.conceptId,
      conceptName: event.conceptName || conceptLabel(event.conceptId, concepts),
      score: event.score,
      provider: event.provider,
      note: compactText(event.note || event.fallbackReason || "", 120),
    })),
    learnerSignals: {
      phase: session.phase,
      retention: session.retention,
      masteryLevel: session.masteryLevel,
      confidenceLevel: session.confidenceLevel,
      motivationLevel: session.motivationLevel,
      dueReviewCount: dueReviews.length,
      knownConcepts: known,
      strugglingConcepts: struggling,
      hasActiveQuiz: Boolean(cleanState.quiz && !cleanState.quiz.complete),
      lastTeachBackAccuracy: cleanState.lastTeachBack?.accuracy ?? null,
    },
  };
}
