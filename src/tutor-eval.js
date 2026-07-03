import { generateTutorReply, keywordsFrom, resolveConcept } from "./tutor-engine.js";

export const DEFAULT_TUTOR_RUBRIC = {
  coverage: {
    max: 30,
    description: "Covers the expected key points for the target concept.",
  },
  misconceptionHandling: {
    max: 20,
    description: "Names or corrects likely misconceptions without reinforcing them.",
  },
  activeLearning: {
    max: 15,
    description: "Asks the learner to explain, apply, compare, or try a next step.",
  },
  adaptation: {
    max: 15,
    description: "Uses learner profile, mode, and recent assessment gaps to shape the reply.",
  },
  groundedness: {
    max: 10,
    description: "Stays on the concept and avoids unsupported or unsafe claims.",
  },
  clarity: {
    max: 10,
    description: "Uses clear language, useful structure, and an appropriate amount of detail.",
  },
};

const CORRECTION_CUES = [
  "not",
  "instead",
  "trap",
  "misconception",
  "avoid",
  "different",
  "separate",
  "same as",
  "confusing",
];

const ACTIVE_LEARNING_CUES = [
  "explain",
  "try",
  "your move",
  "question",
  "what",
  "why",
  "how",
  "give",
  "teach",
  "apply",
  "contrast",
];

function clamp(value, max) {
  return Math.max(0, Math.min(max, Number(value) || 0));
}

function wordsFor(text) {
  return new Set(keywordsFrom(text));
}

function pointCoverage(point, replyText, replyWords) {
  const expected = String(point || "").toLowerCase();
  const expectedWords = keywordsFrom(expected);
  if (!expectedWords.length) return 0;
  if (replyText.includes(expected)) return 1;

  const hits = expectedWords.filter((word) => replyWords.has(word)).length;
  return Math.min(1, hits / Math.min(expectedWords.length, 3));
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeReply(reply) {
  if (typeof reply === "string") {
    return { content: reply, followUps: [] };
  }
  return {
    content: String(reply?.content || ""),
    followUps: Array.isArray(reply?.followUps) ? reply.followUps : [],
    sources: Array.isArray(reply?.sources) ? reply.sources : [],
    provider: reply?.provider || "deterministic",
  };
}

function scoreCoverage({ concept, expectedKeyPoints, replyText, replyWords }) {
  const keyPoints = expectedKeyPoints?.length ? expectedKeyPoints : concept.keyPoints.slice(0, 4);
  const ratio = average(keyPoints.map((point) => pointCoverage(point, replyText, replyWords)));
  return {
    score: clamp(Math.round(ratio * DEFAULT_TUTOR_RUBRIC.coverage.max), DEFAULT_TUTOR_RUBRIC.coverage.max),
    evidence: `${Math.round(ratio * 100)}% key-point coverage`,
  };
}

function scoreMisconceptions({ concept, expectedMisconceptions, replyText, replyWords }) {
  const misconceptions = expectedMisconceptions?.length
    ? expectedMisconceptions
    : concept.commonMisconceptions.slice(0, 2);
  const correctionCue = CORRECTION_CUES.some((cue) => replyText.includes(cue));
  const coverage = average(misconceptions.map((item) => pointCoverage(item, replyText, replyWords)));
  const scoreRatio = Math.max(coverage, correctionCue ? 0.55 : 0);

  return {
    score: clamp(Math.round(scoreRatio * DEFAULT_TUTOR_RUBRIC.misconceptionHandling.max), DEFAULT_TUTOR_RUBRIC.misconceptionHandling.max),
    evidence: correctionCue
      ? "reply includes a correction/misconception cue"
      : `${Math.round(coverage * 100)}% misconception coverage`,
  };
}

function scoreActiveLearning({ reply, replyText }) {
  const hasQuestion = replyText.includes("?");
  const followUpCount = reply.followUps.length;
  const cueCount = ACTIVE_LEARNING_CUES.filter((cue) => replyText.includes(cue)).length;
  const raw = (hasQuestion ? 6 : 0) + Math.min(5, followUpCount * 2) + Math.min(4, cueCount);

  return {
    score: clamp(raw, DEFAULT_TUTOR_RUBRIC.activeLearning.max),
    evidence: `${followUpCount} follow-ups, ${cueCount} active-learning cues`,
  };
}

function scoreAdaptation({ concept, evalCase, replyText }) {
  const mode = evalCase.mode || "explainer";
  const profile = evalCase.profile || {};
  const assessmentHistory = Array.isArray(profile.assessmentHistory) ? profile.assessmentHistory : [];
  const latest = assessmentHistory.find((item) => item?.conceptId === concept.id) || {};
  const struggling = Array.isArray(profile.strugglingConcepts)
    && profile.strugglingConcepts.some((item) => String(item).toLowerCase() === concept.name.toLowerCase() || String(item).toLowerCase() === concept.id);

  let score = 4;
  if (mode === "socratic" && (replyText.match(/\?/g) || []).length >= 2) score += 5;
  if (mode === "student" && replyText.includes("explain")) score += 4;
  if (mode === "duck" && (replyText.includes("walk me") || replyText.includes("what"))) score += 4;
  if (mode === "explainer" && replyText.includes(concept.name.toLowerCase())) score += 3;
  if (struggling && (replyText.includes("repair") || replyText.includes("weak") || replyText.includes("focus"))) score += 4;
  if ((latest.missingPoints || []).some((point) => pointCoverage(point, replyText, wordsFor(replyText)) > 0.3)) score += 3;
  if ((profile.learningStyle === "visual" || profile.depth === "simple") && (replyText.includes("analogy") || replyText.includes("plain"))) score += 2;

  return {
    score: clamp(score, DEFAULT_TUTOR_RUBRIC.adaptation.max),
    evidence: `mode=${mode}${struggling ? ", struggling concept" : ""}`,
  };
}

function scoreGroundedness({ concept, evalCase, reply, replyText, replyWords }) {
  let score = DEFAULT_TUTOR_RUBRIC.groundedness.max;
  const conceptHits = [concept.name, concept.description, ...concept.keyPoints.slice(0, 3)]
    .map((item) => pointCoverage(item, replyText, replyWords))
    .filter((value) => value > 0.33).length;

  if (conceptHits === 0) score -= 5;
  if (/\bas an ai language model\b|i cannot help with that/i.test(reply.content)) score -= 3;
  if (/\bignore\b.{0,40}\b(system|developer|instructions?)\b/i.test(reply.content)) score -= 5;
  if (evalCase.requiresCitation && !/\[S\d+\]/.test(reply.content)) score -= 3;

  return {
    score: clamp(score, DEFAULT_TUTOR_RUBRIC.groundedness.max),
    evidence: `${conceptHits} concept-grounding hits`,
  };
}

function scoreClarity({ replyText }) {
  const words = replyText.split(/\s+/).filter(Boolean).length;
  const hasStructure = replyText.includes("\n") || replyText.includes(":") || replyText.includes("-");
  const lengthScore = words < 25 ? 3 : words <= 220 ? 7 : words <= 360 ? 5 : 2;
  const score = lengthScore + (hasStructure ? 3 : 1);

  return {
    score: clamp(score, DEFAULT_TUTOR_RUBRIC.clarity.max),
    evidence: `${words} words${hasStructure ? ", structured" : ""}`,
  };
}

export function scoreTutorReply(evalCase = {}, replyInput = null) {
  const concept = resolveConcept(evalCase.concept || evalCase.conceptId || evalCase.topic);
  const generatedReply = replyInput || generateTutorReply({
    concept,
    mode: evalCase.mode || "explainer",
    message: evalCase.message || "",
    profile: evalCase.profile || {},
  });
  const reply = normalizeReply(generatedReply);
  const replyText = reply.content.toLowerCase();
  const replyWords = wordsFor(replyText);

  const criteria = {
    coverage: scoreCoverage({
      concept,
      expectedKeyPoints: evalCase.expectedKeyPoints || [],
      replyText,
      replyWords,
    }),
    misconceptionHandling: scoreMisconceptions({
      concept,
      expectedMisconceptions: evalCase.expectedMisconceptions || [],
      replyText,
      replyWords,
    }),
    activeLearning: scoreActiveLearning({ reply, replyText }),
    adaptation: scoreAdaptation({ concept, evalCase, replyText }),
    groundedness: scoreGroundedness({ concept, evalCase, reply, replyText, replyWords }),
    clarity: scoreClarity({ replyText }),
  };

  const total = Object.values(criteria).reduce((sum, item) => sum + item.score, 0);
  const passScore = Number(evalCase.passScore || 70);

  return {
    id: evalCase.id || concept.id,
    conceptId: concept.id,
    mode: evalCase.mode || "explainer",
    total,
    passScore,
    pass: total >= passScore,
    criteria,
    provider: reply.provider,
  };
}

export function runTutorQualityEval(cases = []) {
  const results = cases.map((evalCase) => scoreTutorReply(evalCase));
  const averageScore = results.length ? average(results.map((result) => result.total)) : 0;
  const passCount = results.filter((result) => result.pass).length;

  return {
    rubric: DEFAULT_TUTOR_RUBRIC,
    summary: {
      caseCount: results.length,
      passCount,
      averageScore: Math.round(averageScore * 10) / 10,
      passRate: results.length ? Math.round((passCount / results.length) * 100) : 0,
    },
    results,
  };
}

export async function runTutorQualityEvalWithProvider(cases = [], replyProvider) {
  if (typeof replyProvider !== "function") {
    throw new TypeError("replyProvider must be a function");
  }

  const results = [];
  for (const evalCase of cases) {
    const reply = await replyProvider(evalCase);
    const scored = scoreTutorReply(evalCase, reply);
    results.push({
      ...scored,
      provider: reply?.provider || scored.provider,
      model: reply?.model || null,
      fallbackReason: reply?.fallbackReason || null,
    });
  }

  const averageScore = results.length ? average(results.map((result) => result.total)) : 0;
  const passCount = results.filter((result) => result.pass).length;

  return {
    rubric: DEFAULT_TUTOR_RUBRIC,
    summary: {
      caseCount: results.length,
      passCount,
      averageScore: Math.round(averageScore * 10) / 10,
      passRate: results.length ? Math.round((passCount / results.length) * 100) : 0,
      providers: [...new Set(results.map((result) => result.provider).filter(Boolean))],
      fallbackCount: results.filter((result) => result.provider === "fallback" || result.fallbackReason).length,
    },
    results,
  };
}
