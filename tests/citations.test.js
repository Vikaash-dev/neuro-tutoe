import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCitationRegistry,
  buildEvidenceTrace,
  extractCitationLabels,
  validateCitations,
} from "../src/citations.js";

const sources = [
  {
    id: "S1",
    chunkId: "doc::1",
    documentId: "doc",
    title: "Docker notes",
    source: "manual",
    section: "Core ideas",
    score: 2.2,
    snippet: "Containers package dependencies.",
  },
  {
    id: "S2",
    chunkId: "doc::2",
    documentId: "doc",
    title: "Docker notes",
    source: "manual",
    section: "Volumes",
    score: 1.7,
    snippet: "Volumes persist data outside the container lifecycle.",
  },
];

test("extractCitationLabels returns unique bracket citations in order", () => {
  assert.deepEqual(extractCitationLabels("Use containers [S1], then volumes [S2]. Repeat [S1]."), ["S1", "S2"]);
});

test("validateCitations detects uncited and invalid source labels", () => {
  const validation = validateCitations("Containers package dependencies [S1]. Bad cite [S9].", sources);

  assert.deepEqual(validation.citedLabels, ["S1", "S9"]);
  assert.deepEqual(validation.missingLabels, ["S9"]);
  assert.deepEqual(validation.uncitedLabels, ["S2"]);
  assert.equal(validation.citedSourceCount, 1);
  assert.equal(validation.hasInvalidCitations, true);
});

test("buildEvidenceTrace keeps source snippets and citation coverage", () => {
  const trace = buildEvidenceTrace({
    purpose: "tutor",
    query: "docker volumes",
    outputText: "Containers package dependencies [S1].",
    sources,
  });

  assert.equal(trace.sourceCount, 2);
  assert.equal(trace.citationCoverage, 0.5);
  assert.equal(trace.citedSources[0].snippet, "Containers package dependencies.");
  assert.deepEqual(trace.uncitedLabels, ["S2"]);
});

test("buildCitationRegistry normalizes missing source IDs", () => {
  const registry = buildCitationRegistry([{ title: "A" }, { id: "s3", title: "B" }]);

  assert.deepEqual(registry.labels, ["S1", "S3"]);
});
