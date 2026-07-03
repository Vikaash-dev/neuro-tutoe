import { CONCEPTS, CONCEPT_MAP, createCustomConcept, getConceptById } from "./concepts.js";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "between",
  "could",
  "every",
  "from",
  "have",
  "into",
  "like",
  "main",
  "more",
  "only",
  "same",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "thing",
  "this",
  "through",
  "uses",
  "when",
  "where",
  "which",
  "with",
  "without",
]);

const DEPTH_COPY = {
  simple: "I will keep the vocabulary light and build from a concrete example.",
  moderate: "I will connect the intuition to the core mechanism.",
  detailed: "I will include the mechanism, edge cases, and a tighter definition.",
  expert: "I will include the mechanism, limits, and transfer cases.",
};

export function resolveConcept(input) {
  if (!input) return CONCEPTS[0];
  if (typeof input === "object" && input.id) {
    const base = CONCEPT_MAP[input.id] || createCustomConcept(input.name || input.id);
    return {
      ...base,
      ...input,
      id: String(input.id || base.id),
      name: input.name || base.name,
      category: input.category || base.category,
      difficulty: input.difficulty || base.difficulty,
      description: input.description || base.description,
      analogy: input.analogy || base.analogy,
      prerequisites: Array.isArray(input.prerequisites) ? input.prerequisites : base.prerequisites,
      relatedConcepts: Array.isArray(input.relatedConcepts) ? input.relatedConcepts : base.relatedConcepts,
      keyPoints: Array.isArray(input.keyPoints) && input.keyPoints.length ? input.keyPoints : base.keyPoints,
      commonMisconceptions: Array.isArray(input.commonMisconceptions) && input.commonMisconceptions.length
        ? input.commonMisconceptions
        : base.commonMisconceptions,
      realWorldApplications: Array.isArray(input.realWorldApplications) && input.realWorldApplications.length
        ? input.realWorldApplications
        : base.realWorldApplications,
    };
  }
  return CONCEPT_MAP[input] || createCustomConcept(input);
}

function normalizeKeyword(word) {
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ses")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("is")) {
    return word.slice(0, -1);
  }
  return word;
}

export function keywordsFrom(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .map(normalizeKeyword)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function coverageForPoint(point, explanationWords, explanationText) {
  const words = keywordsFrom(point);
  if (words.length === 0) return 0;
  if (explanationText.includes(point.toLowerCase())) return 1;
  const hits = words.filter((word) => explanationWords.has(word)).length;
  return hits / Math.min(words.length, 3);
}

function detectMisconceptions(concept, explanationWords, explanationText) {
  return concept.commonMisconceptions.filter((misconception) => {
    const lowerMisconception = misconception.toLowerCase();
    const words = keywordsFrom(misconception);
    if (words.length === 0) return false;
    if (explanationText.includes(lowerMisconception)) return true;
    if (/\bsame\b|\bsame as\b|\bsame thing\b|\bexactly like\b|\bidentical\b|\bequivalent\b/.test(lowerMisconception)) {
      const hasIdentityCue =
        /\bsame\b|\bsame thing\b|\bsame as\b|\bjust a[n]?\b|\bbasically a[n]?\b|\bidentical\b|\bequivalent\b|\bno different\b/.test(
          explanationText,
        );
      if (!hasIdentityCue) return false;
    }
    const hits = words.filter((word) => explanationWords.has(word)).length;
    return hits >= Math.min(3, words.length);
  });
}

function comparisonClauses(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[.;!?]|\b(?:because|while|whereas|although|though|but|since|so)\b/g)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function normalizeComparisonEntity(value) {
  const words = keywordsFrom(value).filter(
    (word) => !["faster", "slower", "travel", "travels", "move", "moves", "speed", "velocity", "rate"].includes(word),
  );
  return words.slice(-3).join(" ") || String(value || "").toLowerCase().trim();
}

function extractComparisons(text) {
  const comparisons = [];
  for (const clause of comparisonClauses(text)) {
    const match = clause.match(/^(.+?)\s+(?:is|are|travels?|moves?|goes?)?\s*(faster|slower)\s+than\s+(.+?)$/i);
    if (!match) continue;
    const subject = normalizeComparisonEntity(match[1]);
    const object = normalizeComparisonEntity(match[3]);
    if (!subject || !object || subject === object) continue;
    comparisons.push({
      subject,
      relation: match[2].toLowerCase(),
      object,
      sourceClause: clause,
    });
  }
  return comparisons;
}

function sameComparisonEntity(left, right) {
  return left === right || left.split(" ").includes(right) || right.split(" ").includes(left);
}

function correctedComparisonFrom(evidenceComparison) {
  return `${evidenceComparison.subject} is ${evidenceComparison.relation} than ${evidenceComparison.object}.`;
}

export function detectSelfCorrectionConflict(payload = {}) {
  const claim = String(payload.claim || payload.explanation || payload.answer || "").trim();
  const evidence = Array.isArray(payload.evidence)
    ? payload.evidence
    : Array.isArray(payload.trustedComparisons)
      ? payload.trustedComparisons
      : [];
  const claimComparisons = extractComparisons(claim);
  const evidenceComparisons = evidence.flatMap((item) => extractComparisons(item));

  for (const claimComparison of claimComparisons) {
    for (const evidenceComparison of evidenceComparisons) {
      const reversedEntities =
        sameComparisonEntity(claimComparison.subject, evidenceComparison.object) &&
        sameComparisonEntity(claimComparison.object, evidenceComparison.subject);
      const sameEntities =
        sameComparisonEntity(claimComparison.subject, evidenceComparison.subject) &&
        sameComparisonEntity(claimComparison.object, evidenceComparison.object);
      const oppositeRelation =
        (claimComparison.relation === "faster" && evidenceComparison.relation === "slower") ||
        (claimComparison.relation === "slower" && evidenceComparison.relation === "faster");

      if ((reversedEntities && claimComparison.relation === evidenceComparison.relation) || (sameEntities && oppositeRelation)) {
        const correctedClaim = correctedComparisonFrom(evidenceComparison);
        const likelyMistake = reversedEntities ? "reversed_comparison" : "opposite_comparison";
        return {
          conflict: true,
          likelyMistake,
          claim,
          claimComparison: claimComparison.sourceClause,
          correctedClaim,
          cues: [
            evidenceComparison.sourceClause,
            `Compare ${evidenceComparison.subject} against ${evidenceComparison.object} before saving the fact.`,
          ],
          feedback: `This conflicts with stronger comparison evidence: ${correctedClaim} Self-correct the relation before practicing it.`,
        };
      }
    }
  }

  return {
    conflict: false,
    likelyMistake: "",
    claim,
    claimComparison: "",
    correctedClaim: "",
    cues: [],
    feedback: "No trusted comparison conflict detected.",
  };
}

export function analyzeTeachBack(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId);
  const explanation = String(payload.explanation || payload.studentExplanation || "").trim();
  const profile = payload.profile || {};
  const explanationText = explanation.toLowerCase();
  const explanationWords = new Set(keywordsFrom(explanation));

  const pointScores = concept.keyPoints.map((point) => ({
    point,
    score: Math.min(1, coverageForPoint(point, explanationWords, explanationText)),
  }));

  const coveredPoints = pointScores.filter((item) => item.score >= 0.34).map((item) => item.point);
  const missingPoints = pointScores.filter((item) => item.score < 0.34).map((item) => item.point);
  const misconceptions = detectMisconceptions(concept, explanationWords, explanationText);
  const trustedComparisons = [
    ...(Array.isArray(payload.trustedComparisons) ? payload.trustedComparisons : []),
    ...(Array.isArray(payload.evidence) ? payload.evidence : []),
    concept.description,
    ...concept.keyPoints,
  ].filter(Boolean);
  const selfCorrection = detectSelfCorrectionConflict({ claim: explanation, evidence: trustedComparisons });
  const wordCount = explanation ? explanation.split(/\s+/).length : 0;
  const coverage = pointScores.length
    ? pointScores.reduce((sum, item) => sum + item.score, 0) / pointScores.length
    : 0;
  const clarityBonus = Math.min(14, Math.round((wordCount / 45) * 14));
  const misconceptionPenalty = misconceptions.length * 13;
  const selfCorrectionPenalty = selfCorrection.conflict ? 12 : 0;
  const accuracy = Math.round(
    Math.max(0, Math.min(100, coverage * 100 + clarityBonus - misconceptionPenalty - selfCorrectionPenalty)),
  );

  const suggestions = [];
  if (wordCount < 35) suggestions.push("Add one concrete example and one why-it-matters sentence.");
  if (missingPoints.length > 0) suggestions.push(`Work in: ${missingPoints.slice(0, 2).join("; ")}.`);
  if (misconceptions.length > 0) suggestions.push("Separate the tempting misconception from the corrected idea.");
  if (selfCorrection.conflict) {
    suggestions.push(`Self-correct the conflicting comparison: ${selfCorrection.correctedClaim}`);
  }
  if (profile.learningStyle === "visual") suggestions.push("Sketch the flow as boxes and arrows before explaining it again.");
  if (accuracy >= 82) suggestions.push("Strong teach-back. Try an application problem next.");

  return {
    conceptId: concept.id,
    accuracy,
    coveredPoints,
    missingPoints,
    misconceptions,
    selfCorrection,
    suggestions,
    refinedExplanation: buildTeachingSnapshot(concept, profile),
  };
}

export function assessTransferAttempt(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId || payload.topic);
  const answer = String(payload.answer || payload.response || payload.explanation || "").trim();
  const targetExample = String(payload.targetExample || payload.target || concept.realWorldApplications[0] || "").trim();
  const sourceExample = String(payload.sourceExample || payload.source || "").trim();
  const answerText = answer.toLowerCase();
  const answerWords = new Set(keywordsFrom(answer));
  const targetWords = keywordsFrom(targetExample);
  const targetHits = targetWords.filter((word) => answerWords.has(word)).slice(0, 5);
  const sourceWords = keywordsFrom(sourceExample);
  const sourceHits = sourceWords.filter((word) => answerWords.has(word)).slice(0, 5);
  const pointScores = concept.keyPoints.map((point) => ({
    point,
    score: Math.min(1, coverageForPoint(point, answerWords, answerText)),
  }));
  const invariantChecks = pointScores.filter((item) => item.score >= 0.34).map((item) => item.point);
  const changedChecks = [];
  const hasInvariantLanguage = /\binvariant\b|\bstill\b|\bsame\b|\bunchanged\b|\bremains?\b|\bcore\b/.test(answerText);
  const hasChangeLanguage = /\bchange[sd]?\b|\bdifferent\b|\bnew\b|\bcontext\b|\benvironment\b|\bwhereas\b|\bwhile\b|\bbut\b/.test(
    answerText,
  );

  if (hasInvariantLanguage && invariantChecks.length > 0) {
    changedChecks.push("Named what stays invariant across contexts");
  }
  if (hasChangeLanguage) {
    changedChecks.push("Named what changes in the new context");
  }
  if (targetHits.length > 0) {
    changedChecks.push(`Used target-context evidence: ${targetHits.slice(0, 3).join(", ")}`);
  }

  const misconceptions = concept.commonMisconceptions.filter((misconception) => {
    const lowerMisconception = misconception.toLowerCase();
    const words = keywordsFrom(misconception);
    const hits = words.filter((word) => answerWords.has(word)).length;
    const exactMatch = answerText.includes(lowerMisconception);
    const strongOverlap = hits >= Math.min(4, words.length);
    const negated =
      /\bnot\b|\bnever\b|\bno\b|\bavoid\b|\bfalse\b|\bwrong\b|\bmisconception\b|\btrap\b/.test(answerText) &&
      words.some((word) => answerText.includes(word));
    return (exactMatch || strongOverlap) && !negated;
  });
  const missingPoints = pointScores.filter((item) => item.score < 0.34).map((item) => item.point).slice(0, 4);
  const coverage = pointScores.length
    ? pointScores.reduce((sum, item) => sum + item.score, 0) / pointScores.length
    : 0;
  const sourceTargetBridge = sourceHits.length > 0 && targetHits.length > 0 ? 10 : targetHits.length > 0 ? 7 : 0;
  const score = clampScore(
    Math.round(
      coverage * 40 +
        (hasInvariantLanguage ? 20 : 0) +
        (hasChangeLanguage ? 20 : 0) +
        sourceTargetBridge +
        Math.min(16, invariantChecks.length * 8) -
        misconceptions.length * 15,
    ),
    0,
  );
  const transferLevel =
    score >= 75 && hasChangeLanguage && invariantChecks.length > 0
      ? "far"
      : score >= 55 && invariantChecks.length > 0
        ? "near"
        : "attempted";

  return {
    conceptId: concept.id,
    conceptName: concept.name,
    score,
    transferLevel,
    sourceExample,
    targetExample,
    invariantChecks,
    changedChecks,
    missingPoints,
    misconceptions,
    nextPrompt:
      transferLevel === "far"
        ? `Good transfer. Now solve a farther case and explain what changes about ${concept.name}.`
        : `Try again: name what stays the same, what changes, and which misconception you are avoiding.`,
  };
}

function clampScore(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.max(0, Math.min(100, number)));
}

function normalizeStringList(values = []) {
  const seen = new Set();
  const result = [];

  for (const value of Array.isArray(values) ? values : []) {
    const label = String(value || "").trim();
    const key = label.toLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      result.push(label);
    }
  }

  return result;
}

function conceptKeys(concept) {
  return new Set(
    [concept.id, concept.name]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase()),
  );
}

function removeConceptFromList(values, concept) {
  const keys = conceptKeys(concept);
  return normalizeStringList(values).filter((value) => !keys.has(value.toLowerCase()));
}

function addConceptToFront(values, concept, limit) {
  const label = concept.name || concept.id;
  return [label, ...removeConceptFromList(values, concept)].slice(0, limit);
}

function assessmentList(values = []) {
  return Array.isArray(values)
    ? values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
}

export function buildCalibrationInsight(payload = {}) {
  const predictedConfidence = clampScore(payload.predictedConfidence ?? payload.confidence ?? 50, 50);
  const actualScore = clampScore(payload.actualScore ?? payload.score ?? payload.accuracy ?? 0, 0);
  const gap = predictedConfidence - actualScore;
  const absGap = Math.abs(gap);
  let label = "developing";
  let feedback = "Your confidence and result are close enough to keep practicing with evidence.";

  if (absGap <= 10) {
    label = "calibrated";
    feedback = "Your confidence matched the evidence. Keep using the same self-check before answering.";
  } else if (gap >= 20) {
    label = "overconfident";
    feedback = "Slow down and ask what evidence supports each step before trusting the answer.";
  } else if (gap <= -20) {
    label = "underconfident";
    feedback = "You knew more than you predicted. Name the strategy that worked so you can trust it next time.";
  }

  return {
    predictedConfidence,
    actualScore,
    gap,
    label,
    feedback,
  };
}

function conceptIsInList(values, concept) {
  const keys = conceptKeys(concept);
  return normalizeStringList(values).some((value) => keys.has(value.toLowerCase()));
}

function latestAssessmentForConcept(profile = {}, concept) {
  const history = Array.isArray(profile.assessmentHistory) ? profile.assessmentHistory : [];
  return history.find((item) => {
    if (!item || typeof item !== "object") return false;
    const conceptId = String(item.conceptId || "").toLowerCase();
    const conceptName = String(item.conceptName || "").toLowerCase();
    return conceptId === concept.id.toLowerCase() || conceptName === concept.name.toLowerCase();
  });
}

export function updateLearnerProfileAfterAssessment(profile = {}, payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId || payload.topic);
  const score = clampScore(payload.score ?? payload.accuracy, 0);
  const missingPoints = assessmentList(payload.missingPoints);
  const misconceptions = assessmentList(payload.misconceptions);
  const knownConcepts = normalizeStringList(profile.knownConcepts);
  const strugglingConcepts = normalizeStringList(profile.strugglingConcepts);
  const priorHistory = Array.isArray(profile.assessmentHistory)
    ? profile.assessmentHistory.filter((item) => item && typeof item === "object")
    : [];
  const hasSeriousGap = misconceptions.length > 0 || missingPoints.length >= 2;
  const isStrong = score >= 80 && misconceptions.length === 0 && missingPoints.length <= 1;
  const needsReview = score < 65 || hasSeriousGap;
  const createdAt = Number.isFinite(Number(payload.createdAt)) ? Number(payload.createdAt) : Date.now();

  let nextKnownConcepts = removeConceptFromList(knownConcepts, concept);
  let nextStrugglingConcepts = removeConceptFromList(strugglingConcepts, concept);
  let confidenceDelta = score >= 70 ? 3 : -3;
  let motivationDelta = 1;
  let status = "developing";
  const calibration =
    payload.predictedConfidence === undefined && payload.confidence === undefined
      ? null
      : buildCalibrationInsight({
          predictedConfidence: payload.predictedConfidence ?? payload.confidence,
          actualScore: score,
        });

  if (isStrong) {
    nextKnownConcepts = addConceptToFront(knownConcepts, concept, 16);
    confidenceDelta = score >= 90 ? 8 : 6;
    motivationDelta = 3;
    status = "strengthening";
  } else if (needsReview) {
    nextStrugglingConcepts = addConceptToFront(strugglingConcepts, concept, 12);
    confidenceDelta = score < 45 ? -8 : -5;
    motivationDelta = misconceptions.length > 0 ? -2 : 0;
    status = "needs_review";
  }

  if (calibration?.label === "overconfident") {
    confidenceDelta -= calibration.gap >= 35 ? 6 : 3;
    motivationDelta -= 1;
  } else if (calibration?.label === "underconfident" && isStrong) {
    confidenceDelta += 2;
  }

  const assessment = {
    conceptId: concept.id,
    conceptName: concept.name,
    score,
    source: payload.source || "assessment",
    status,
    missingPoints,
    misconceptions,
    createdAt,
  };
  if (calibration) assessment.calibration = calibration;

  return {
    ...profile,
    learningStyle: profile.learningStyle || "visual",
    depth: profile.depth || profile.explanationDepth || "moderate",
    tone: profile.tone || "encouraging",
    knownConcepts: nextKnownConcepts.slice(0, 16),
    strugglingConcepts: nextStrugglingConcepts.slice(0, 12),
    confidenceLevel: clampScore(clampScore(profile.confidenceLevel, 50) + confidenceDelta, 50),
    motivationLevel: clampScore(clampScore(profile.motivationLevel, 75) + motivationDelta, 75),
    assessmentHistory: [assessment, ...priorHistory].slice(0, 8),
    lastUpdated: createdAt,
  };
}

export function buildTutorSessionState(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId || payload.topic);
  const memory = payload.memory || createInitialMemory(concept.id);
  const profile = payload.profile || {};
  const now = Number.isFinite(Number(payload.now)) ? Number(payload.now) : Date.now();
  const latestAssessment = latestAssessmentForConcept(profile, concept);
  const retention = estimateRetention(memory, now);
  const isKnown = conceptIsInList(profile.knownConcepts, concept);
  const isStruggling = conceptIsInList(profile.strugglingConcepts, concept);
  const dueForReview = (memory.nextReviewDate || 0) <= now;
  const missingPoints = assessmentList(latestAssessment?.missingPoints);
  const misconceptions = assessmentList(latestAssessment?.misconceptions);
  const focusPoints = [
    ...missingPoints,
    ...misconceptions.map((item) => `Correct misconception: ${item}`),
    ...concept.keyPoints,
  ].filter((item, index, arr) => item && arr.indexOf(item) === index).slice(0, 4);

  let phase = "learn";
  let nextView = "tutor";
  let nextLabel = `Build the core model for ${concept.name}`;

  if (isStruggling || latestAssessment?.status === "needs_review" || (memory.reviewCount > 0 && retention < 45)) {
    phase = "repair";
    nextView = "teachback";
    nextLabel = `Repair the weakest part of ${concept.name}`;
  } else if (dueForReview && memory.reviewCount > 0) {
    phase = "review";
    nextView = "quiz";
    nextLabel = `Review ${concept.name} before it fades`;
  } else if (memory.reviewCount === 0) {
    phase = "learn";
    nextView = "tutor";
    nextLabel = `Learn ${concept.name} from the ground up`;
  } else if (isKnown || memory.masteryLevel === "expert") {
    phase = "transfer";
    nextView = "tutor";
    nextLabel = `Apply ${concept.name} to a new problem`;
  } else {
    phase = "practice";
    nextView = "quiz";
    nextLabel = `Practice recall for ${concept.name}`;
  }

  return {
    conceptId: concept.id,
    conceptName: concept.name,
    phase,
    nextAction: {
      label: nextLabel,
      view: nextView,
    },
    focusPoints,
    dueForReview,
    retention,
    masteryLevel: memory.masteryLevel || "novice",
    confidenceLevel: clampScore(profile.confidenceLevel, 50),
    motivationLevel: clampScore(profile.motivationLevel, 75),
    latestAssessment: latestAssessment || null,
  };
}

export function buildTeachingSnapshot(concept, profile = {}) {
  const depth = profile.depth || profile.explanationDepth || "moderate";
  const firstPoints = concept.keyPoints.slice(0, 3).join("; ");
  const example = concept.realWorldApplications?.[0] || "a real problem";
  const latestAssessment = latestAssessmentForConcept(profile, concept);
  const weakFocus = assessmentList(latestAssessment?.missingPoints)[0];
  const misconceptionFocus = assessmentList(latestAssessment?.misconceptions)[0];
  const learnerContext = conceptIsInList(profile.strugglingConcepts, concept)
    ? `Because this is currently a weak area, start with: ${weakFocus || concept.keyPoints[0]}.`
    : conceptIsInList(profile.knownConcepts, concept)
      ? `Because this is currently a strength, connect it to transfer: ${example}.`
      : "";
  const misconceptionContext = misconceptionFocus
    ? `A recent misconception to correct is: ${misconceptionFocus}.`
    : "";

  return [
    `${concept.name} means ${concept.description.toLowerCase()}`,
    `Think of it this way: ${concept.analogy}`,
    `The core ideas are: ${firstPoints}.`,
    `A common trap is thinking that ${concept.commonMisconceptions[0]?.toLowerCase() || "the label alone is enough"}.`,
    misconceptionContext,
    learnerContext,
    `A good test is whether you can use it in ${example.toLowerCase()} and explain what changes, why it changes, and what result you expect.`,
    DEPTH_COPY[depth] || DEPTH_COPY.moderate,
  ]
    .filter(Boolean)
    .join(" ");
}

export function generateSimpleExplanation(concept, profile = {}) {
  const known = profile.knownConcepts?.length
    ? `I will connect this to what you already know: ${profile.knownConcepts.slice(0, 3).join(", ")}.`
    : "I will start from first principles.";

  return [
    `Here is ${concept.name} in plain language: ${concept.description}`,
    "",
    `Analogy: ${concept.analogy}`,
    "",
    "Core pieces:",
    ...concept.keyPoints.slice(0, 4).map((point) => `- ${point}`),
    "",
    "Watch for these traps:",
    ...concept.commonMisconceptions.slice(0, 2).map((item) => `- ${item}`),
    "",
    known,
    "Quick check: can you explain the idea back using one example and no jargon?",
  ].join("\n");
}

function socraticReply(concept, message) {
  const analysis = analyzeTeachBack({ concept, explanation: message });
  const words = new Set(keywordsFrom(message));
  const weakPoint =
    analysis.missingPoints[0] ||
    concept.keyPoints.find((point) => coverageForPoint(point, words, message.toLowerCase()) < 0.34) ||
    concept.keyPoints[0];
  const covered = analysis.coveredPoints.slice(0, 2);
  const misconception = analysis.misconceptions[0] || concept.commonMisconceptions[0];
  const anchor = covered.length
    ? `Good anchor: ${covered.join("; ")}.`
    : `Start with the mechanism: ${concept.keyPoints[0]}.`;

  return [
    `Let's reason through ${concept.name}.`,
    anchor,
    `A trap to avoid is: ${misconception}.`,
    `What do you think "${weakPoint}" means in your own words?`,
    `How is that different from the misconception, and what would break if that difference were false?`,
  ].join("\n");
}

function studentModeReply(concept, message) {
  if (!message || message.trim().length < 20) {
    return `I want to learn ${concept.name}. Can you explain it from the beginning, as if I have never seen it before?`;
  }

  const analysis = analyzeTeachBack({ concept, explanation: message });
  if (analysis.missingPoints.length > 0) {
    return `I think I follow part of it. Where does "${analysis.missingPoints[0]}" fit into your explanation?`;
  }

  return `So if I understand you, ${concept.name} is about ${concept.description.toLowerCase()} Can you give me a real example where that would matter?`;
}

function duckReply(concept, message) {
  if (!message || message.trim().length < 20) {
    return `Walk me through what you currently believe about ${concept.name}.`;
  }

  const words = keywordsFrom(message);
  const focus = words.slice(-3).join(", ") || concept.name;
  return `I hear you circling around ${focus}. What is the next thing that must be true for your explanation to work?`;
}

function adaptiveReply(concept, message, profile = {}) {
  const analysis = analyzeTeachBack({ concept, explanation: message, profile });
  const session = buildTutorSessionState({ concept, profile });

  if (!message || message.trim().length < 10) {
    if (session.phase === "repair") {
      return [
        `Let's repair ${concept.name} from the weakest useful piece.`,
        `Focus: ${session.focusPoints[0] || concept.keyPoints[0]}.`,
        buildTeachingSnapshot(concept, { ...profile, depth: "simple" }),
        "",
        "Your move: explain only that focus point in one example.",
      ].join("\n");
    }
    if (session.phase === "transfer") {
      return [
        `You already have a base for ${concept.name}. Let's make it usable.`,
        buildTeachingSnapshot(concept, profile),
        "",
        `Transfer challenge: apply it to ${concept.realWorldApplications[0]} and say what would break if the misconception were true.`,
      ].join("\n");
    }
    return generateSimpleExplanation(concept, profile);
  }

  if (analysis.selfCorrection?.conflict) {
    return [
      "Pause and self-correct before we practice that.",
      analysis.selfCorrection.feedback,
      `Rewrite the comparison as: ${analysis.selfCorrection.correctedClaim}`,
      "Then explain which clue forced the correction.",
    ].join("\n");
  }

  if (analysis.accuracy < 45) {
    return [
      `Let's rebuild ${concept.name} from a smaller piece.`,
      buildTeachingSnapshot(concept, { ...profile, depth: "simple" }),
      "",
      `Your next step: explain just this part: ${concept.keyPoints[0]}.`,
    ].join("\n");
  }

  if (analysis.misconceptions.length > 0) {
    return [
      `You are close, but I spotted a possible misconception: ${analysis.misconceptions[0]}.`,
      `Correction: ${buildTeachingSnapshot(concept, profile)}`,
      "",
      "Try again in one sentence, making that distinction explicit.",
    ].join("\n");
  }

  if (analysis.missingPoints.length > 0) {
    return [
      `Good start. The main gap is: ${analysis.missingPoints[0]}.`,
      `Add that to your model and connect it to this example: ${concept.realWorldApplications[0]}.`,
      "",
      "Question: why would the concept fail or become misleading without that missing piece?",
    ].join("\n");
  }

  return [
    `That explanation is solid. I would score it around ${analysis.accuracy}%.`,
    "Now move from remembering to transfer:",
    `- Use ${concept.name} in ${concept.realWorldApplications[0]}.`,
    `- Contrast it with this misconception: ${concept.commonMisconceptions[0]}.`,
    "- Teach it again in half the words.",
  ].join("\n");
}

export function generateTutorReply(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId || payload.topic);
  const mode = payload.mode || "explainer";
  const message = String(payload.message || "");
  const profile = payload.profile || {};
  let content;

  if (mode === "socratic") content = socraticReply(concept, message);
  else if (mode === "student") content = studentModeReply(concept, message);
  else if (mode === "duck") content = duckReply(concept, message);
  else content = adaptiveReply(concept, message, profile);

  return {
    id: `reply-${Date.now()}`,
    role: "assistant",
    mode,
    conceptId: concept.id,
    content,
    followUps: [
      `Explain ${concept.name} without using jargon.`,
      `Give a real-world example of ${concept.name}.`,
      `What is a common misconception about ${concept.name}?`,
    ],
  };
}

function makeDistractors(concept, correct, seedIndex, priorityDistractors = []) {
  const pool = [
    ...priorityDistractors,
    ...concept.commonMisconceptions,
    ...concept.relatedConcepts.map((id) => getConceptById(id).name),
    ...concept.realWorldApplications,
    "A label for the topic rather than the mechanism",
    "An unrelated detail that sounds technical",
  ].filter((item) => item && item !== correct);

  const distractors = [];
  for (let i = 0; distractors.length < 3 && i < pool.length + 6; i += 1) {
    const item = pool[(seedIndex + i) % pool.length];
    if (item && !distractors.includes(item)) distractors.push(item);
  }
  return distractors;
}

function rotateOptions(options, index) {
  const offset = index % options.length;
  return options.slice(offset).concat(options.slice(0, offset));
}

export function generateQuiz(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId);
  const profile = payload.profile || {};
  const count = Math.max(3, Math.min(Number(payload.count || 5), 8));
  const latestAssessment = latestAssessmentForConcept(profile, concept);
  const targetPoints = [
    ...assessmentList(latestAssessment?.missingPoints),
    ...concept.keyPoints,
  ].filter((item, index, arr) => item && arr.indexOf(item) === index);
  const priorityMisconceptions = [
    ...assessmentList(latestAssessment?.misconceptions),
    ...concept.commonMisconceptions,
  ].filter((item, index, arr) => item && arr.indexOf(item) === index);
  const questions = [];

  for (let i = 0; i < count; i += 1) {
    const keyPoint = targetPoints[i % targetPoints.length];
    const correct = i % 2 === 0 ? keyPoint : concept.realWorldApplications[i % concept.realWorldApplications.length];
    const stem =
      i % 2 === 0
        ? `Which statement best strengthens your understanding of ${concept.name}?`
        : `Which example best shows ${concept.name} being used?`;
    const options = rotateOptions([correct, ...makeDistractors(concept, correct, i, priorityMisconceptions)], i);

    questions.push({
      id: `${concept.id}-q-${i + 1}`,
      conceptId: concept.id,
      type: "multiple_choice",
      question: stem,
      options,
      correctAnswer: correct,
      explanation:
        i % 2 === 0
          ? `${correct} is one of the core points for ${concept.name}.`
          : `${correct} is a practical use case for ${concept.name}.`,
      difficulty: concept.difficulty,
      relatedMisconceptions: priorityMisconceptions.slice(0, 2),
    });
  }

  questions.push({
    id: `${concept.id}-teach-back`,
    conceptId: concept.id,
    type: "explain",
    question: `In one or two sentences, explain ${concept.name} as if teaching a beginner.`,
    options: [],
    correctAnswer: concept.keyPoints[0],
    explanation: buildTeachingSnapshot(concept, payload.profile || {}),
    difficulty: concept.difficulty,
    relatedMisconceptions: concept.commonMisconceptions,
  });

  return questions.slice(0, count);
}

export function createInitialMemory(conceptId) {
  const now = Date.now();
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

export function calculateConsolidationProgress(memory) {
  const accuracy = memory.totalAttempts > 0 ? (memory.correctAnswers / memory.totalAttempts) * 100 : 0;
  const reviewScore = Math.min(memory.reviewCount * 18, 100);
  const daysSinceFirstReview = Math.max(0, (Date.now() - memory.sessionLearned) / 86400000);
  const timeScore = Math.min((daysSinceFirstReview / 21) * 100, 100);
  return Math.round(accuracy * 0.42 + reviewScore * 0.36 + timeScore * 0.22);
}

export function updateMasteryLevel(currentMastery, score, reviewCount) {
  if (currentMastery === "novice" && score >= 70 && reviewCount >= 1) return "intermediate";
  if (currentMastery === "intermediate" && score >= 80 && reviewCount >= 2) return "proficient";
  if (currentMastery === "proficient" && score >= 90 && reviewCount >= 3) return "expert";
  return currentMastery || "novice";
}

export function updateMemoryAfterQuiz(memory, quizScore, questionCount) {
  const now = Date.now();
  const correctThisRound = Math.round((quizScore / 100) * questionCount);
  const reviewCount = (memory.reviewCount || 0) + 1;
  const correctAnswers = (memory.correctAnswers || 0) + correctThisRound;
  const totalAttempts = (memory.totalAttempts || 0) + questionCount;
  const stabilityMultiplier = quizScore >= 85 ? 2.5 : quizScore >= 70 ? 1.8 : quizScore >= 50 ? 1.1 : 0.7;
  const stabilityDays = Math.max(1, Math.round((memory.stabilityDays || 1) * stabilityMultiplier));
  const nextIntervalDays = quizScore >= 85 ? stabilityDays : quizScore >= 70 ? Math.max(1, Math.round(stabilityDays * 0.75)) : 1;

  const updated = {
    ...memory,
    retentionScore: Math.round(Math.max(20, Math.min(99, quizScore))),
    lastReviewDate: now,
    nextReviewDate: now + nextIntervalDays * 86400000,
    reviewCount,
    correctAnswers,
    totalAttempts,
    stabilityDays,
  };

  updated.consolidationProgress = calculateConsolidationProgress(updated);
  updated.masteryLevel = updateMasteryLevel(memory.masteryLevel, quizScore, reviewCount);
  updated.memoryType =
    updated.consolidationProgress >= 70 && reviewCount >= 3 && quizScore >= 80
      ? "long_term"
      : "short_term";

  return updated;
}

export function updateMemoryAfterTeachBack(memory, accuracy) {
  const now = Date.now();
  const score = clampScore(accuracy, 0);
  const reviewCount = (memory.reviewCount || 0) + 1;
  const questionCount = 3;
  const correctThisRound = score >= 82 ? 3 : score >= 65 ? 2 : score >= 45 ? 1 : 0;
  const correctAnswers = (memory.correctAnswers || 0) + correctThisRound;
  const totalAttempts = (memory.totalAttempts || 0) + questionCount;
  const stabilityMultiplier = score >= 85 ? 2 : score >= 70 ? 1.4 : score >= 50 ? 0.95 : 0.65;
  const stabilityDays = Math.max(1, Math.round((memory.stabilityDays || 1) * stabilityMultiplier));
  const nextIntervalDays = score >= 85 ? stabilityDays : score >= 70 ? 1 : 0;
  const previousRetention = clampScore(memory.retentionScore, 35);

  const updated = {
    ...memory,
    retentionScore: clampScore(previousRetention * 0.35 + score * 0.65, score),
    lastReviewDate: now,
    nextReviewDate: now + nextIntervalDays * 86400000,
    reviewCount,
    correctAnswers,
    totalAttempts,
    stabilityDays,
  };

  updated.consolidationProgress = calculateConsolidationProgress(updated);
  updated.masteryLevel = updateMasteryLevel(memory.masteryLevel, score, reviewCount);
  updated.memoryType =
    updated.consolidationProgress >= 70 && reviewCount >= 3 && score >= 80
      ? "long_term"
      : "short_term";

  return updated;
}

export function estimateRetention(memory, now = Date.now()) {
  if (!memory) return 0;
  const elapsedDays = Math.max(0, (now - memory.lastReviewDate) / 86400000);
  const stability = Math.max(0.5, memory.stabilityDays || 1);
  const decay = Math.exp(-elapsedDays / stability);
  return Math.round(Math.max(5, Math.min(100, (memory.retentionScore || 35) * decay)));
}

export function masteryPercent(level) {
  return {
    novice: 22,
    intermediate: 48,
    proficient: 74,
    expert: 96,
  }[level || "novice"];
}

const LEVEL_RANK = {
  unlearned: 0,
  novice: 1,
  beginner: 1,
  intermediate: 2,
  proficient: 3,
  advanced: 3,
  expert: 4,
};

const DIFFICULTY_REQUIRED_LEVEL = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
  expert: "expert",
};

function memoryCurrentLevel(memory) {
  if (!memory || memory.reviewCount === 0) return "unlearned";
  if (memory.masteryLevel === "expert") return "expert";
  if (memory.masteryLevel === "proficient") return "advanced";
  if (memory.masteryLevel === "intermediate") return "intermediate";
  return "beginner";
}

function conceptReadiness(concept, memoryByConcept = {}) {
  const blockedBy = concept.prerequisites.filter((id) => {
    const prereqMemory = memoryByConcept[id];
    return LEVEL_RANK[memoryCurrentLevel(prereqMemory)] < LEVEL_RANK.intermediate;
  });

  return {
    ready: blockedBy.length === 0,
    blockedBy,
  };
}

export function inferSkillGaps(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId || payload.goal);
  const concepts = payload.concepts || CONCEPTS;
  const conceptMap = Object.fromEntries(concepts.map((item) => [item.id, item]));
  const memoryByConcept = payload.memoryByConcept || {};
  const focusIds = [
    ...concept.prerequisites,
    concept.id,
    ...concept.relatedConcepts.slice(0, 2),
  ].filter((id, index, arr) => id && arr.indexOf(id) === index);

  return focusIds.map((id) => {
    const item = conceptMap[id] || getConceptById(id);
    const memory = memoryByConcept[id];
    const requiredLevel = id === concept.id
      ? DIFFICULTY_REQUIRED_LEVEL[item.difficulty] || "intermediate"
      : "intermediate";
    const currentLevel = memoryCurrentLevel(memory);
    const isGap = LEVEL_RANK[currentLevel] < LEVEL_RANK[requiredLevel];
    const retention = estimateRetention(memory);
    const reason = isGap
      ? retention <= 45
        ? "Retention is low or the topic has not been reviewed enough."
        : "Current mastery is below the level needed for the target concept."
      : "Current mastery is sufficient for this part of the path.";

    return {
      id,
      name: item.name,
      isGap,
      requiredLevel,
      currentLevel,
      reason,
      levelConfidence: memory?.totalAttempts > 2 ? "high" : memory?.totalAttempts > 0 ? "medium" : "low",
    };
  });
}

export function generateLearningPath(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId || payload.goal);
  const concepts = payload.concepts || CONCEPTS;
  const conceptMap = Object.fromEntries(concepts.map((item) => [item.id, item]));
  const memoryByConcept = payload.memoryByConcept || {};
  const profile = payload.profile || {};
  const gaps = inferSkillGaps({ concept, concepts, memoryByConcept });
  const sessionState = buildTutorSessionState({
    concept,
    memory: memoryByConcept[concept.id],
    profile,
  });
  const path = [];

  for (const gap of gaps.filter((item) => item.isGap && item.id !== concept.id)) {
    const item = conceptMap[gap.id] || getConceptById(gap.id);
    path.push({
      id: `session-${path.length + 1}`,
      title: `Repair prerequisite: ${item.name}`,
      abstract: `Close the gap in ${item.name} before pushing deeper into ${concept.name}. Focus on one plain explanation, one example, and one active recall check.`,
      status: memoryByConcept[item.id]?.reviewCount > 0 ? "review" : "new",
      associatedSkills: [item.name],
      desiredOutcome: [{ name: item.name, level: "intermediate" }],
      minutes: profile.depth === "expert" ? 40 : 25,
    });
  }

  if (sessionState.phase === "repair") {
    path.push({
      id: `session-${path.length + 1}`,
      title: `Repair weak model: ${concept.name}`,
      abstract: `Use the latest assessment signal to rebuild the weakest part first: ${sessionState.focusPoints.slice(0, 2).join("; ")}.`,
      status: "repair",
      associatedSkills: sessionState.focusPoints.slice(0, 3),
      desiredOutcome: [{ name: concept.name, level: "intermediate" }],
      minutes: profile.depth === "expert" ? 35 : 20,
    });
  }

  path.push({
    id: `session-${path.length + 1}`,
    title: `Core model: ${concept.name}`,
    abstract: `Build the central mental model for ${concept.name}: definition, mechanism, analogy, misconception contrast, and a teaching snapshot.`,
    status: memoryByConcept[concept.id]?.reviewCount > 0 ? "review" : "new",
    associatedSkills: [concept.name],
    desiredOutcome: [{ name: concept.name, level: DIFFICULTY_REQUIRED_LEVEL[concept.difficulty] || "intermediate" }],
    minutes: profile.depth === "simple" ? 20 : 35,
  });

  path.push({
    id: `session-${path.length + 1}`,
    title: "Teach-back and gap repair",
    abstract: `Explain ${concept.name} without jargon. The tutor scores coverage, flags misconceptions, and updates memory state.`,
    status: "practice",
    associatedSkills: ["Feynman explanation", "Misconception detection"],
    desiredOutcome: [{ name: "Teach-back clarity", level: "advanced" }],
    minutes: 20,
  });

  path.push({
    id: `session-${path.length + 1}`,
    title: "Active recall review",
    abstract: `Take an adaptive quiz, review explanations for wrong answers, and schedule the next review from performance.`,
    status: "assessment",
    associatedSkills: ["Retrieval practice", "Long-term retention"],
    desiredOutcome: [{ name: "Recall reliability", level: "advanced" }],
    minutes: 15,
  });

  if (concept.relatedConcepts.length > 0) {
    const related = concept.relatedConcepts
      .slice(0, 2)
      .map((id) => conceptMap[id] || getConceptById(id))
      .filter(Boolean);

    path.push({
      id: `session-${path.length + 1}`,
      title: "Transfer to nearby concepts",
      abstract: `Connect ${concept.name} to ${related.map((item) => item.name).join(" and ")} so the idea becomes usable outside the original example.`,
      status: "extension",
      associatedSkills: related.map((item) => item.name),
      desiredOutcome: related.map((item) => ({ name: item.name, level: "beginner" })),
      minutes: 20,
    });
  }

  return {
    target: concept.name,
    readiness: conceptReadiness(concept, memoryByConcept),
    gaps,
    sessions: path.slice(0, 7),
  };
}

export function identifyWeakAreas(payload = {}) {
  const concepts = payload.concepts || CONCEPTS;
  const memoryByConcept = payload.memoryByConcept || {};

  return concepts
    .map((concept) => {
      const memory = memoryByConcept[concept.id] || createInitialMemory(concept.id);
      const retention = estimateRetention(memory);
      const mastery = masteryPercent(memory.masteryLevel);
      const attempts = memory.totalAttempts || 0;
      const urgency = (100 - retention) * 0.55 + (100 - mastery) * 0.35 + (attempts > 0 ? 10 : 0);
      return {
        conceptId: concept.id,
        name: concept.name,
        retention,
        mastery,
        attempts,
        urgency: Math.round(urgency),
      };
    })
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 5);
}

export function recommendResources(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId);
  const profile = payload.profile || {};
  const style = profile.learningStyle || "visual";
  const base = [
    {
      type: "Teach-back",
      title: `One-page explanation of ${concept.name}`,
      why: "Forces the idea into simple language and exposes hidden gaps.",
    },
    {
      type: "Practice",
      title: `${concept.name} active recall quiz`,
      why: "Retrieval practice improves retention more than passive rereading.",
    },
  ];

  const byStyle = {
    visual: {
      type: "Diagram",
      title: `${concept.name} flow map`,
      why: "Use arrows to make prerequisites, inputs, outputs, and misconceptions visible.",
    },
    verbal: {
      type: "Dialogue",
      title: `Socratic walkthrough for ${concept.name}`,
      why: "Answering guided questions builds the explanation step by step.",
    },
    kinesthetic: {
      type: "Project",
      title: `Apply ${concept.name} to a small real task`,
      why: "Hands-on transfer makes the concept less brittle.",
    },
    reading_writing: {
      type: "Notes",
      title: `${concept.name} compare-and-contrast sheet`,
      why: "Written contrasts help separate correct ideas from tempting misconceptions.",
    },
  };

  return [byStyle[style] || byStyle.visual, ...base];
}

export function generateWhiteboardArtifact(payload = {}) {
  const concept = resolveConcept(payload.concept || payload.conceptId);
  const nodes = [
    { id: concept.id, label: concept.name, kind: "target" },
    ...concept.prerequisites.map((id) => ({
      id,
      label: getConceptById(id).name,
      kind: "prerequisite",
    })),
    ...concept.relatedConcepts.slice(0, 3).map((id) => ({
      id,
      label: getConceptById(id).name,
      kind: "related",
    })),
  ];

  const edges = [
    ...concept.prerequisites.map((id) => ({ source: id, target: concept.id, label: "supports" })),
    ...concept.relatedConcepts.slice(0, 3).map((id) => ({ source: concept.id, target: id, label: "connects" })),
  ];

  return {
    title: `${concept.name} whiteboard`,
    nodes,
    edges,
    diagram: {
      centerId: concept.id,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      legend: [
        { kind: "target", label: "Current concept" },
        { kind: "prerequisite", label: "Prerequisite" },
        { kind: "related", label: "Transfer concept" },
      ],
    },
    notes: [
      `Analogy: ${concept.analogy}`,
      `Core: ${concept.keyPoints[0]}`,
      `Misconception to avoid: ${concept.commonMisconceptions[0]}`,
    ],
    misconceptionContrast: {
      misconception: concept.commonMisconceptions[0],
      correction: concept.keyPoints[0],
      checkQuestion: `What would be different if "${concept.commonMisconceptions[0]}" were true?`,
    },
    workedExample: {
      scenario: concept.realWorldApplications[0] || concept.name,
      prompt: `Use ${concept.name} in ${concept.realWorldApplications[0] || "a real problem"}.`,
      steps: [
        `Identify the part of the situation that matches: ${concept.keyPoints[0]}.`,
        `Contrast it with the trap: ${concept.commonMisconceptions[0]}.`,
        `Predict the result using: ${concept.keyPoints[1] || concept.description}.`,
      ],
    },
    teachBackPrompt: `Teach ${concept.name} using the analogy, one key point, and one trap to avoid.`,
  };
}
