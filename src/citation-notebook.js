function compactText(value = "", max = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableSourceKey(source = {}) {
  const chunkId = String(source.chunkId || "").trim();
  const documentId = String(source.documentId || "").trim();
  const title = compactText(source.title || "", 80).toLowerCase();
  const section = compactText(source.section || "", 80).toLowerCase();
  const snippet = compactText(source.snippet || "", 80).toLowerCase();

  if (chunkId) return `chunk:${chunkId}`;
  if (documentId && section) return `document-section:${documentId}:${section}`;
  if (documentId) return `document:${documentId}:${snippet}`;
  return `source:${title}:${section}:${snippet}`;
}

function eventPurpose(event = {}) {
  if (event.type === "teach_back_assessment") return "teach-back";
  if (event.type === "quiz_generated" || event.type === "quiz_completed") return "quiz";
  return event.mode || "tutor";
}

function citedFlag(source = {}, event = {}) {
  if (typeof source.cited === "boolean") return source.cited;
  const cited = new Set(Array.isArray(event.citedLabels) ? event.citedLabels : []);
  return cited.has(source.id);
}

function sourceEntry(source = {}, event = {}) {
  return {
    id: compactText(source.id || "", 20),
    chunkId: compactText(source.chunkId || "", 120),
    documentId: compactText(source.documentId || "", 120),
    title: compactText(source.title || "Source", 120),
    source: compactText(source.source || "", 120),
    section: compactText(source.section || "", 120),
    snippet: compactText(source.snippet || "", 260),
    guardrailRiskLevel: compactText(source.guardrailRiskLevel || source.guardrail?.riskLevel || "none", 40),
    cited: citedFlag(source, event),
  };
}

export function buildCitationNotebook(events = [], options = {}) {
  const conceptId = String(options.conceptId || "").trim();
  const limit = Math.max(1, Math.min(finiteNumber(options.limit, 80), 300));
  const relevantEvents = (Array.isArray(events) ? events : [])
    .filter((event) => event && typeof event === "object")
    .filter((event) => !conceptId || event.conceptId === conceptId)
    .filter((event) => Number(event.sourceCount || 0) > 0 || (event.evidenceSnippets || []).length > 0)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, limit);

  const sources = new Map();
  let coverageTotal = 0;
  let coverageCount = 0;
  let invalidCitationCount = 0;

  for (const event of relevantEvents) {
    if (Number.isFinite(Number(event.citationCoverage))) {
      coverageTotal += Number(event.citationCoverage);
      coverageCount += 1;
    }
    invalidCitationCount += (Array.isArray(event.missingCitationLabels) ? event.missingCitationLabels : []).length;

    const snippets = Array.isArray(event.evidenceSnippets) ? event.evidenceSnippets : [];
    for (const rawSource of snippets) {
      const source = sourceEntry(rawSource, event);
      const key = stableSourceKey(source);
      const existing = sources.get(key) || {
        key,
        id: source.id,
        chunkId: source.chunkId,
        documentId: source.documentId,
        title: source.title,
        source: source.source,
        section: source.section,
        snippet: source.snippet,
        guardrailRiskLevel: source.guardrailRiskLevel,
        retrievedCount: 0,
        citedCount: 0,
        uncitedCount: 0,
        firstSeenAt: Number(event.createdAt || 0),
        lastSeenAt: Number(event.createdAt || 0),
        events: [],
      };

      existing.retrievedCount += 1;
      existing.citedCount += source.cited ? 1 : 0;
      existing.uncitedCount += source.cited ? 0 : 1;
      existing.firstSeenAt = Math.min(existing.firstSeenAt, Number(event.createdAt || 0));
      existing.lastSeenAt = Math.max(existing.lastSeenAt, Number(event.createdAt || 0));
      existing.guardrailRiskLevel = existing.guardrailRiskLevel === "none"
        ? source.guardrailRiskLevel
        : existing.guardrailRiskLevel;
      existing.events.push({
        eventId: event.id,
        type: event.type,
        purpose: eventPurpose(event),
        conceptId: event.conceptId,
        conceptName: event.conceptName,
        createdAt: event.createdAt,
        provider: event.provider,
        model: event.model,
        score: event.score,
        qualityScore: event.qualityScore,
        citationCoverage: event.citationCoverage,
        cited: source.cited,
        label: source.id,
      });
      sources.set(key, existing);
    }
  }

  const sourceList = [...sources.values()]
    .map((source) => ({
      ...source,
      events: source.events
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        .slice(0, 8),
    }))
    .sort((a, b) => b.citedCount - a.citedCount || b.retrievedCount - a.retrievedCount || b.lastSeenAt - a.lastSeenAt);

  return {
    generatedAt: Date.now(),
    conceptId: conceptId || null,
    eventCount: relevantEvents.length,
    sourceCount: sourceList.length,
    citedSourceCount: sourceList.filter((source) => source.citedCount > 0).length,
    totalCitations: sourceList.reduce((sum, source) => sum + source.citedCount, 0),
    invalidCitationCount,
    averageCitationCoverage: coverageCount ? Number((coverageTotal / coverageCount).toFixed(3)) : 0,
    sources: sourceList,
    recentEvents: relevantEvents.slice(0, 12).map((event) => ({
      id: event.id,
      type: event.type,
      purpose: eventPurpose(event),
      conceptId: event.conceptId,
      conceptName: event.conceptName,
      createdAt: event.createdAt,
      sourceCount: event.sourceCount,
      citedSourceCount: event.citedSourceCount,
      citationCoverage: event.citationCoverage,
      missingCitationLabels: event.missingCitationLabels || [],
    })),
  };
}
