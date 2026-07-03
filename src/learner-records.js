export const LEARNER_EVENT_TYPES = new Set([
  "tutor_reply",
  "teach_back_assessment",
  "quiz_generated",
  "quiz_completed",
  "knowledge_document_added",
]);

const MAX_TEXT = 260;

function compactText(value = "", max = MAX_TEXT) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function conceptInfo(data = {}) {
  const concept = data.concept || {};
  return {
    conceptId: String(data.conceptId || concept.id || "").trim(),
    conceptName: String(data.conceptName || concept.name || "").trim(),
  };
}

function labelsFromSources(sources = []) {
  return (Array.isArray(sources) ? sources : [])
    .map((source) => String(source?.id || "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function evidenceFields(data = {}) {
  const trace = data.evidenceTrace || {};
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const sourceSummary = (source = {}, cited = false) => ({
    id: String(source?.id || "").trim(),
    chunkId: String(source?.chunkId || "").trim(),
    documentId: String(source?.documentId || "").trim(),
    title: compactText(source?.title || "", 80),
    source: compactText(source?.source || "", 80),
    section: compactText(source?.section || "", 80),
    snippet: compactText(source?.snippet || "", 180),
    guardrailRiskLevel: compactText(source?.guardrail?.riskLevel || source?.guardrailRiskLevel || "none", 40),
    cited,
  });

  return {
    sourceCount: finiteNumber(trace.sourceCount, sources.length),
    citedSourceCount: finiteNumber(trace.citedSourceCount, 0),
    citationCoverage: finiteNumber(trace.citationCoverage, 0),
    sourceLabels: Array.isArray(trace.labels) ? trace.labels.slice(0, 12) : labelsFromSources(sources),
    citedLabels: Array.isArray(trace.citedLabels) ? trace.citedLabels.slice(0, 12) : [],
    missingCitationLabels: Array.isArray(trace.missingLabels) ? trace.missingLabels.slice(0, 12) : [],
    uncitedLabels: Array.isArray(trace.uncitedLabels) ? trace.uncitedLabels.slice(0, 12) : [],
    evidenceSnippets: [
      ...(Array.isArray(trace.citedSources) ? trace.citedSources.map((source) => sourceSummary(source, true)) : []),
      ...(Array.isArray(trace.uncitedSources) ? trace.uncitedSources.map((source) => sourceSummary(source, false)) : []),
    ]
      .filter((source) => source.id)
      .slice(0, 6),
  };
}

function cleanList(values = [], limit = 8) {
  return (Array.isArray(values) ? values : [])
    .map((value) => compactText(value, 160))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanQualityCriteria(criteria = {}) {
  const result = {};
  const entries = Object.entries(criteria && typeof criteria === "object" ? criteria : {});
  for (const [name, value] of entries.slice(0, 10)) {
    result[String(name).trim()] = {
      score: finiteNumber(value?.score, 0),
      evidence: compactText(value?.evidence || "", 140),
    };
  }
  return result;
}

export function createLearnerEvent(type, data = {}, options = {}) {
  const eventType = String(type || data.type || "").trim();
  if (!LEARNER_EVENT_TYPES.has(eventType)) {
    throw new Error(`Unsupported learner event type: ${eventType || "missing"}`);
  }

  const now = finiteNumber(options.now, Date.now());
  const { conceptId, conceptName } = conceptInfo(data);
  const evidence = evidenceFields(data);
  const quality = data.quality && typeof data.quality === "object" ? data.quality : {};
  const qualityScore = finiteNumber(data.qualityScore ?? quality.total);
  const qualityPassScore = finiteNumber(data.qualityPassScore ?? quality.passScore);

  return {
    id: String(options.id || `event-${now}-${Math.random().toString(16).slice(2, 8)}`),
    type: eventType,
    createdAt: now,
    conceptId,
    conceptName,
    mode: String(data.mode || "").trim(),
    provider: String(data.provider || "").trim(),
    model: String(data.model || "").trim(),
    score: finiteNumber(data.score ?? data.accuracy),
    questionCount: finiteNumber(data.questionCount),
    qualityScore,
    qualityPassScore,
    qualityPass: typeof data.qualityPass === "boolean"
      ? data.qualityPass
      : typeof quality.pass === "boolean"
        ? quality.pass
        : null,
    qualityCriteria: cleanQualityCriteria(data.qualityCriteria || quality.criteria),
    source: String(data.source || "").trim(),
    fallbackReason: compactText(data.fallbackReason || "", 180),
    note: compactText(data.note || data.message || data.explanation || data.summary || ""),
    missingPoints: cleanList(data.missingPoints),
    misconceptions: cleanList(data.misconceptions),
    ...evidence,
  };
}

export function appendLearnerEvent(events = [], event, limit = 500) {
  const next = [...(Array.isArray(events) ? events : []), event]
    .filter((item) => item && typeof item === "object")
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

  return next.slice(Math.max(0, next.length - Math.max(1, limit)));
}

export function summarizeLearnerEvents(events = [], recentLimit = 12) {
  const sorted = [...(Array.isArray(events) ? events : [])]
    .filter((event) => event && typeof event === "object")
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  const eventCounts = Object.create(null);
  const concepts = Object.create(null);
  let coverageTotal = 0;
  let coverageCount = 0;
  let qualityTotal = 0;
  let qualityCount = 0;

  for (const event of sorted) {
    eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    if (event.conceptId) {
      const existing = concepts[event.conceptId] || {
        conceptId: event.conceptId,
        conceptName: event.conceptName || event.conceptId,
        eventCount: 0,
        lastEventAt: 0,
        latestScore: null,
        latestTutorQuality: null,
      };
      existing.eventCount += 1;
      existing.lastEventAt = Math.max(existing.lastEventAt, Number(event.createdAt || 0));
      if (Number.isFinite(Number(event.score))) existing.latestScore = Number(event.score);
      if (Number.isFinite(Number(event.qualityScore))) existing.latestTutorQuality = Number(event.qualityScore);
      concepts[event.conceptId] = existing;
    }
    if (Number.isFinite(Number(event.citationCoverage))) {
      coverageTotal += Number(event.citationCoverage);
      coverageCount += 1;
    }
    if (Number.isFinite(Number(event.qualityScore))) {
      qualityTotal += Number(event.qualityScore);
      qualityCount += 1;
    }
  }

  return {
    totalEvents: sorted.length,
    eventCounts,
    conceptCount: Object.keys(concepts).length,
    concepts: Object.values(concepts)
      .sort((a, b) => b.lastEventAt - a.lastEventAt)
      .slice(0, 20),
    averageCitationCoverage: coverageCount ? Number((coverageTotal / coverageCount).toFixed(3)) : 0,
    averageTutorQuality: qualityCount ? Number((qualityTotal / qualityCount).toFixed(1)) : null,
    lastEventAt: sorted.length ? sorted[sorted.length - 1].createdAt : null,
    recentEvents: sorted.slice(-recentLimit).reverse(),
  };
}
