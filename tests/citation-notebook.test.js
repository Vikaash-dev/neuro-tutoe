import test from "node:test";
import assert from "node:assert/strict";
import { buildCitationNotebook } from "../src/citation-notebook.js";
import { createLearnerEvent } from "../src/learner-records.js";

test("buildCitationNotebook groups cited and uncited source history", () => {
  const events = [
    createLearnerEvent(
      "tutor_reply",
      {
        conceptId: "docker-containers",
        conceptName: "Docker Containers",
        provider: "fallback",
        evidenceTrace: {
          sourceCount: 2,
          citedSourceCount: 1,
          citationCoverage: 0.5,
          labels: ["S1", "S2"],
          citedLabels: ["S1"],
          uncitedLabels: ["S2"],
          citedSources: [{
            id: "S1",
            chunkId: "docker::core",
            documentId: "docker",
            title: "Docker notes",
            source: "manual",
            section: "Core",
            snippet: "Containers package apps with dependencies.",
          }],
          uncitedSources: [{
            id: "S2",
            chunkId: "docker::volumes",
            documentId: "docker",
            title: "Docker notes",
            source: "manual",
            section: "Volumes",
            snippet: "Volumes persist data outside the container lifecycle.",
          }],
        },
      },
      { now: 1, id: "event-1" },
    ),
    createLearnerEvent(
      "teach_back_assessment",
      {
        conceptId: "docker-containers",
        conceptName: "Docker Containers",
        score: 82,
        evidenceTrace: {
          sourceCount: 1,
          citedSourceCount: 1,
          citationCoverage: 1,
          labels: ["S1"],
          citedLabels: ["S1"],
          citedSources: [{
            id: "S1",
            chunkId: "docker::core",
            documentId: "docker",
            title: "Docker notes",
            source: "manual",
            section: "Core",
            snippet: "Containers package apps with dependencies.",
          }],
        },
      },
      { now: 2, id: "event-2" },
    ),
  ];

  const notebook = buildCitationNotebook(events, { conceptId: "docker-containers" });

  assert.equal(notebook.eventCount, 2);
  assert.equal(notebook.sourceCount, 2);
  assert.equal(notebook.citedSourceCount, 1);
  assert.equal(notebook.totalCitations, 2);
  assert.equal(notebook.averageCitationCoverage, 0.75);
  assert.equal(notebook.sources[0].chunkId, "docker::core");
  assert.equal(notebook.sources[0].citedCount, 2);
  assert.equal(notebook.sources[0].events[0].type, "teach_back_assessment");
});

test("buildCitationNotebook filters by concept", () => {
  const events = [
    createLearnerEvent("tutor_reply", { conceptId: "a", evidenceTrace: { sourceCount: 0 } }, { now: 1 }),
    createLearnerEvent("tutor_reply", {
      conceptId: "b",
      evidenceTrace: {
        sourceCount: 1,
        citedSourceCount: 1,
        citationCoverage: 1,
        citedSources: [{ id: "S1", title: "B", snippet: "Useful." }],
      },
    }, { now: 2 }),
  ];

  assert.equal(buildCitationNotebook(events, { conceptId: "a" }).sourceCount, 0);
  assert.equal(buildCitationNotebook(events, { conceptId: "b" }).sourceCount, 1);
});
