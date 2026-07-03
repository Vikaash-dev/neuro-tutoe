const STATE_VERSION = 1;
const MAX_MESSAGE_CHARS = 2000;
const MAX_MESSAGES_PER_CONCEPT = 24;

const DEFAULT_PROFILE = {
  learningStyle: "visual",
  depth: "moderate",
  tone: "encouraging",
  knownConcepts: [],
  strugglingConcepts: [],
  confidenceLevel: 50,
  motivationLevel: 75,
  assessmentHistory: [],
  lastUpdated: null,
};

function compactText(value = "", max = 280) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, fallback = 0) {
  return Math.round(Math.max(0, Math.min(100, finiteNumber(value, fallback))));
}

function cleanStringList(values = [], limit = 16) {
  const seen = new Set();
  const result = [];

  for (const value of Array.isArray(values) ? values : []) {
    const label = compactText(value, 140);
    const key = label.toLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      result.push(label);
    }
    if (result.length >= limit) break;
  }

  return result;
}

function cleanAssessment(item = {}) {
  const calibration =
    item.calibration && typeof item.calibration === "object"
      ? {
          predictedConfidence: clamp(item.calibration.predictedConfidence, 50),
          actualScore: clamp(item.calibration.actualScore, clamp(item.score, 0)),
          gap: Math.round(finiteNumber(item.calibration.gap, 0)),
          label: compactText(item.calibration.label || "", 40),
          feedback: compactText(item.calibration.feedback || "", 220),
        }
      : null;

  const assessment = {
    conceptId: String(item.conceptId || "").trim(),
    conceptName: compactText(item.conceptName || "", 120),
    score: clamp(item.score, 0),
    source: compactText(item.source || "assessment", 80),
    status: compactText(item.status || "", 80),
    missingPoints: cleanStringList(item.missingPoints, 6),
    misconceptions: cleanStringList(item.misconceptions, 6),
    createdAt: finiteNumber(item.createdAt, Date.now()),
  };
  if (calibration) assessment.calibration = calibration;
  return assessment;
}

function cleanProfile(profile = {}) {
  return {
    ...DEFAULT_PROFILE,
    learningStyle: compactText(profile.learningStyle || DEFAULT_PROFILE.learningStyle, 40),
    depth: compactText(profile.depth || profile.explanationDepth || DEFAULT_PROFILE.depth, 40),
    tone: compactText(profile.tone || DEFAULT_PROFILE.tone, 40),
    knownConcepts: cleanStringList(profile.knownConcepts, 24),
    strugglingConcepts: cleanStringList(profile.strugglingConcepts, 24),
    confidenceLevel: clamp(profile.confidenceLevel, DEFAULT_PROFILE.confidenceLevel),
    motivationLevel: clamp(profile.motivationLevel, DEFAULT_PROFILE.motivationLevel),
    assessmentHistory: (Array.isArray(profile.assessmentHistory) ? profile.assessmentHistory : [])
      .map(cleanAssessment)
      .filter((item) => item.conceptId)
      .slice(0, 20),
    lastUpdated: profile.lastUpdated ? finiteNumber(profile.lastUpdated, null) : null,
  };
}

function cleanMemoryEntry(memory = {}, fallbackConceptId = "") {
  const conceptId = String(memory.conceptId || fallbackConceptId || "").trim();
  if (!conceptId) return null;

  return {
    conceptId,
    memoryType: memory.memoryType === "long_term" ? "long_term" : "short_term",
    masteryLevel: ["novice", "intermediate", "proficient", "expert"].includes(memory.masteryLevel)
      ? memory.masteryLevel
      : "novice",
    retentionScore: clamp(memory.retentionScore, 35),
    lastReviewDate: finiteNumber(memory.lastReviewDate, Date.now()),
    nextReviewDate: finiteNumber(memory.nextReviewDate, Date.now()),
    reviewCount: Math.max(0, Math.round(finiteNumber(memory.reviewCount, 0))),
    correctAnswers: Math.max(0, Math.round(finiteNumber(memory.correctAnswers, 0))),
    totalAttempts: Math.max(0, Math.round(finiteNumber(memory.totalAttempts, 0))),
    sessionLearned: finiteNumber(memory.sessionLearned, Date.now()),
    consolidationProgress: clamp(memory.consolidationProgress, 0),
    stabilityDays: Math.max(1, Math.round(finiteNumber(memory.stabilityDays, 1))),
  };
}

function cleanMemoryMap(memory = {}) {
  const result = {};
  for (const [conceptId, value] of Object.entries(memory && typeof memory === "object" ? memory : {})) {
    const entry = cleanMemoryEntry(value, conceptId);
    if (entry) result[entry.conceptId] = entry;
  }
  return result;
}

function cleanConcept(concept = {}) {
  const id = String(concept.id || "").trim();
  const name = compactText(concept.name || "", 120);
  if (!id || !name) return null;

  return {
    id,
    name,
    category: compactText(concept.category || "other", 80),
    difficulty: compactText(concept.difficulty || "beginner", 40),
    description: compactText(concept.description || "", 600),
    analogy: compactText(concept.analogy || "", 600),
    prerequisites: cleanStringList(concept.prerequisites, 12),
    relatedConcepts: cleanStringList(concept.relatedConcepts, 12),
    keyPoints: cleanStringList(concept.keyPoints, 12),
    commonMisconceptions: cleanStringList(concept.commonMisconceptions, 12),
    realWorldApplications: cleanStringList(concept.realWorldApplications, 12),
    custom: true,
  };
}

function cleanSource(source = {}) {
  return {
    id: String(source.id || "").trim(),
    chunkId: String(source.chunkId || "").trim(),
    documentId: String(source.documentId || "").trim(),
    title: compactText(source.title || "", 120),
    source: compactText(source.source || "", 120),
    section: compactText(source.section || "", 120),
    score: finiteNumber(source.score, 0),
  };
}

function cleanEvidenceTrace(trace = null) {
  if (!trace || typeof trace !== "object") return null;
  return {
    purpose: compactText(trace.purpose || "", 40),
    sourceCount: Math.max(0, Math.round(finiteNumber(trace.sourceCount, 0))),
    citedSourceCount: Math.max(0, Math.round(finiteNumber(trace.citedSourceCount, 0))),
    citationCoverage: finiteNumber(trace.citationCoverage, 0),
    labels: cleanStringList(trace.labels, 12),
    citedLabels: cleanStringList(trace.citedLabels, 12),
    missingLabels: cleanStringList(trace.missingLabels, 12),
    uncitedLabels: cleanStringList(trace.uncitedLabels, 12),
  };
}

function cleanTutorQuality(quality = null) {
  if (!quality || typeof quality !== "object") return null;
  const criteria = {};
  const entries = Object.entries(quality.criteria && typeof quality.criteria === "object" ? quality.criteria : {});
  for (const [name, value] of entries.slice(0, 10)) {
    criteria[String(name).trim()] = {
      score: finiteNumber(value?.score, 0),
      evidence: compactText(value?.evidence || "", 140),
    };
  }

  return {
    id: compactText(quality.id || "", 80),
    conceptId: String(quality.conceptId || "").trim(),
    mode: compactText(quality.mode || "", 40),
    total: clamp(quality.total, 0),
    passScore: clamp(quality.passScore, 70),
    pass: Boolean(quality.pass),
    provider: compactText(quality.provider || "", 40),
    criteria,
  };
}

function cleanMessage(message = {}) {
  const role = message.role === "user" ? "user" : "assistant";
  const content = compactText(message.content || "", MAX_MESSAGE_CHARS);
  if (!content) return null;

  return {
    id: String(message.id || `msg-${Date.now()}`).trim(),
    role,
    mode: compactText(message.mode || "", 40),
    conceptId: String(message.conceptId || "").trim(),
    content,
    provider: compactText(message.provider || "", 40),
    model: compactText(message.model || "", 120),
    fallbackReason: compactText(message.fallbackReason || "", 180),
    sources: (Array.isArray(message.sources) ? message.sources : []).map(cleanSource).slice(0, 8),
    evidenceTrace: cleanEvidenceTrace(message.evidenceTrace),
    quality: cleanTutorQuality(message.quality),
  };
}

function cleanMessages(messages = {}) {
  const result = {};
  const entries = Object.entries(messages && typeof messages === "object" ? messages : {});
  for (const [conceptId, values] of entries) {
    const clean = (Array.isArray(values) ? values : [])
      .map(cleanMessage)
      .filter(Boolean)
      .slice(-MAX_MESSAGES_PER_CONCEPT);
    if (clean.length) result[String(conceptId).trim()] = clean;
  }
  return result;
}

function cleanQuiz(quiz = null) {
  if (!quiz || typeof quiz !== "object") return null;
  const questions = (Array.isArray(quiz.questions) ? quiz.questions : [])
    .map((question) => ({
      id: String(question?.id || "").trim(),
      conceptId: String(question?.conceptId || quiz.conceptId || "").trim(),
      type: question?.type === "explain" ? "explain" : "multiple_choice",
      question: compactText(question?.question || "", 600),
      options: cleanStringList(question?.options, 8),
      correctAnswer: compactText(question?.correctAnswer || "", 360),
      explanation: compactText(question?.explanation || "", 900),
      difficulty: compactText(question?.difficulty || "", 80),
      relatedMisconceptions: cleanStringList(question?.relatedMisconceptions, 8),
    }))
    .filter((question) => question.id && question.question)
    .slice(0, 8);

  return {
    conceptId: String(quiz.conceptId || "").trim(),
    index: Math.max(0, Math.round(finiteNumber(quiz.index, 0))),
    checked: Boolean(quiz.checked),
    complete: Boolean(quiz.complete),
    loading: false,
    provider: compactText(quiz.provider || "", 40),
    model: compactText(quiz.model || "", 120),
    questionCount: questions.length,
    questions,
    answers: Object.fromEntries(
      Object.entries(quiz.answers && typeof quiz.answers === "object" ? quiz.answers : {})
        .slice(0, 30)
        .map(([key, value]) => [String(key).trim(), compactText(value, 220)]),
    ),
    sources: (Array.isArray(quiz.sources) ? quiz.sources : []).map(cleanSource).slice(0, 8),
    evidenceTrace: cleanEvidenceTrace(quiz.evidenceTrace),
  };
}

function cleanTeachBack(result = null) {
  if (!result || typeof result !== "object" || result.loading) return null;
  return {
    conceptId: String(result.conceptId || "").trim(),
    accuracy: clamp(result.accuracy, 0),
    missingPoints: cleanStringList(result.missingPoints, 8),
    misconceptions: cleanStringList(result.misconceptions, 8),
    suggestions: cleanStringList(result.suggestions, 8),
    refinedExplanation: compactText(result.refinedExplanation || "", 1200),
    provider: compactText(result.provider || "", 40),
    model: compactText(result.model || "", 120),
    sources: (Array.isArray(result.sources) ? result.sources : []).map(cleanSource).slice(0, 8),
    evidenceTrace: cleanEvidenceTrace(result.evidenceTrace),
  };
}

export function sanitizeLearnerState(raw = {}, options = {}) {
  const input = raw.state && typeof raw.state === "object" ? raw.state : raw;
  const now = finiteNumber(options.now, Date.now());

  return {
    version: STATE_VERSION,
    updatedAt: finiteNumber(input.updatedAt, now),
    selectedConceptId: String(input.selectedConceptId || "docker-containers").trim(),
    learningGoal: compactText(input.learningGoal || "Build durable understanding of the selected concept", 240),
    activeMode: ["explainer", "socratic", "student", "duck"].includes(input.activeMode) ? input.activeMode : "explainer",
    customConcepts: (Array.isArray(input.customConcepts) ? input.customConcepts : [])
      .map(cleanConcept)
      .filter(Boolean)
      .slice(0, 40),
    profile: cleanProfile(input.profile || {}),
    memory: cleanMemoryMap(input.memory || {}),
    messages: cleanMessages(input.messages || {}),
    quiz: cleanQuiz(input.quiz),
    lastTeachBack: cleanTeachBack(input.lastTeachBack),
  };
}

export function mergeLearnerState(localState = {}, serverState = {}) {
  const cleanLocal = sanitizeLearnerState(localState);
  const cleanServer = sanitizeLearnerState(serverState);
  return cleanServer.updatedAt > cleanLocal.updatedAt ? cleanServer : cleanLocal;
}

export function summarizeLearnerState(state = {}) {
  const clean = sanitizeLearnerState(state);
  const messageCount = Object.values(clean.messages).reduce((sum, list) => sum + list.length, 0);
  const memoryEntries = Object.values(clean.memory);
  const dueReviews = memoryEntries.filter((memory) => memory.nextReviewDate <= Date.now()).length;

  return {
    version: clean.version,
    updatedAt: clean.updatedAt,
    selectedConceptId: clean.selectedConceptId,
    learningGoal: clean.learningGoal,
    customConceptCount: clean.customConcepts.length,
    memoryCount: memoryEntries.length,
    messageCount,
    knownConceptCount: clean.profile.knownConcepts.length,
    strugglingConceptCount: clean.profile.strugglingConcepts.length,
    assessmentCount: clean.profile.assessmentHistory.length,
    dueReviews,
    hasActiveQuiz: Boolean(clean.quiz && !clean.quiz.complete),
    lastTeachBackConceptId: clean.lastTeachBack?.conceptId || "",
  };
}
