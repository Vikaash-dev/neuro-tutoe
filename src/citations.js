function normalizeLabel(value, fallback = "") {
  const raw = String(value || fallback).trim().toUpperCase();
  const match = raw.match(/^S(\d+)$/);
  return match ? `S${Number(match[1])}` : raw;
}

export function extractCitationLabels(text = "") {
  const labels = [];
  const seen = new Set();
  const pattern = /\[S(\d+)\]/gi;
  let match = pattern.exec(String(text || ""));

  while (match) {
    const label = `S${Number(match[1])}`;
    if (!seen.has(label)) {
      labels.push(label);
      seen.add(label);
    }
    match = pattern.exec(String(text || ""));
  }

  return labels;
}

export function buildCitationRegistry(sources = [], options = {}) {
  const normalizedSources = (Array.isArray(sources) ? sources : []).map((source, index) => {
    const id = normalizeLabel(source?.id, `S${index + 1}`);
    return {
      id,
      chunkId: String(source?.chunkId || ""),
      documentId: String(source?.documentId || ""),
      title: String(source?.title || "Source").trim(),
      source: String(source?.source || "").trim(),
      section: String(source?.section || "").trim(),
      score: Number(source?.score || 0),
      lexicalScore: Number(source?.lexicalScore || 0),
      semanticScore: Number(source?.semanticScore || 0),
      snippet: String(source?.snippet || "").replace(/\s+/g, " ").trim().slice(0, 280),
      guardrail: source?.guardrail || { riskLevel: "none", score: 0, findings: [] },
    };
  });

  return {
    query: String(options.query || ""),
    purpose: String(options.purpose || "tutor"),
    sourceCount: normalizedSources.length,
    labels: normalizedSources.map((source) => source.id),
    sources: normalizedSources,
  };
}

export function validateCitations(outputText = "", sources = []) {
  const registry = buildCitationRegistry(sources);
  const citedLabels = extractCitationLabels(outputText);
  const available = new Set(registry.labels);
  const cited = new Set(citedLabels);
  const missingLabels = citedLabels.filter((label) => !available.has(label));
  const uncitedLabels = registry.labels.filter((label) => !cited.has(label));

  return {
    citedLabels,
    missingLabels,
    uncitedLabels,
    citedSources: registry.sources.filter((source) => cited.has(source.id)),
    uncitedSources: registry.sources.filter((source) => !cited.has(source.id)),
    sourceCount: registry.sourceCount,
    citedSourceCount: registry.sources.filter((source) => cited.has(source.id)).length,
    citationCoverage: registry.sourceCount
      ? Number((registry.sources.filter((source) => cited.has(source.id)).length / registry.sourceCount).toFixed(3))
      : 0,
    hasInvalidCitations: missingLabels.length > 0,
  };
}

export function buildEvidenceTrace({ outputText = "", sources = [], query = "", purpose = "tutor" } = {}) {
  const registry = buildCitationRegistry(sources, { query, purpose });
  const validation = validateCitations(outputText, registry.sources);

  return {
    purpose,
    query,
    sourceCount: registry.sourceCount,
    labels: registry.labels,
    citedLabels: validation.citedLabels,
    missingLabels: validation.missingLabels,
    uncitedLabels: validation.uncitedLabels,
    citedSourceCount: validation.citedSourceCount,
    citationCoverage: validation.citationCoverage,
    hasInvalidCitations: validation.hasInvalidCitations,
    citedSources: validation.citedSources,
    uncitedSources: validation.uncitedSources,
  };
}
