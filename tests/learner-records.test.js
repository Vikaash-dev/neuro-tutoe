import test from "node:test";
import assert from "node:assert/strict";
import {
  appendLearnerEvent,
  createLearnerEvent,
  summarizeLearnerEvents,
} from "../src/learner-records.js";

test("createLearnerEvent captures concept, score, provider, and evidence fields", () => {
  const event = createLearnerEvent(
    "teach_back_assessment",
    {
      concept: { id: "docker-containers", name: "Docker Containers" },
      provider: "lmstudio",
      model: "local-4b",
      score: 82,
      evidenceTrace: {
        sourceCount: 3,
        citedSourceCount: 2,
        citationCoverage: 0.667,
        labels: ["S1", "S2", "S3"],
        citedLabels: ["S1", "S2"],
        missingLabels: [],
        uncitedLabels: ["S3"],
        citedSources: [{
          id: "S1",
          chunkId: "doc::1",
          documentId: "doc",
          title: "Docker",
          source: "manual",
          section: "Core",
          snippet: "Containers package apps.",
        }],
      },
      quality: {
        total: 86,
        passScore: 70,
        pass: true,
        criteria: {
          coverage: { score: 25, evidence: "covered key ideas" },
        },
      },
      missingPoints: ["Volumes persist data outside the container lifecycle"],
    },
    { now: 123, id: "event-test" },
  );

  assert.equal(event.id, "event-test");
  assert.equal(event.conceptId, "docker-containers");
  assert.equal(event.score, 82);
  assert.equal(event.provider, "lmstudio");
  assert.equal(event.qualityScore, 86);
  assert.equal(event.qualityPass, true);
  assert.equal(event.qualityCriteria.coverage.score, 25);
  assert.equal(event.sourceCount, 3);
  assert.equal(event.citedSourceCount, 2);
  assert.deepEqual(event.uncitedLabels, ["S3"]);
  assert.equal(event.evidenceSnippets[0].chunkId, "doc::1");
  assert.equal(event.evidenceSnippets[0].documentId, "doc");
  assert.equal(event.evidenceSnippets[0].cited, true);
  assert.equal(event.evidenceSnippets[0].snippet, "Containers package apps.");
});

test("appendLearnerEvent keeps the newest events within the configured limit", () => {
  const events = [
    createLearnerEvent("tutor_reply", { conceptId: "a" }, { now: 1, id: "old" }),
    createLearnerEvent("quiz_generated", { conceptId: "b" }, { now: 2, id: "middle" }),
  ];
  const next = appendLearnerEvent(
    events,
    createLearnerEvent("quiz_completed", { conceptId: "c", score: 90 }, { now: 3, id: "new" }),
    2,
  );

  assert.deepEqual(next.map((event) => event.id), ["middle", "new"]);
});

test("summarizeLearnerEvents reports counts, concepts, and citation coverage", () => {
  const events = [
    createLearnerEvent(
      "tutor_reply",
      { conceptId: "docker-containers", conceptName: "Docker Containers", evidenceTrace: { sourceCount: 2, citedSourceCount: 1, citationCoverage: 0.5 } },
      { now: 1, id: "a" },
    ),
    createLearnerEvent(
      "quiz_completed",
      { conceptId: "docker-containers", conceptName: "Docker Containers", score: 75, evidenceTrace: { sourceCount: 2, citedSourceCount: 2, citationCoverage: 1 } },
      { now: 2, id: "b" },
    ),
  ];
  const summary = summarizeLearnerEvents(events);

  assert.equal(summary.totalEvents, 2);
  assert.equal(summary.eventCounts.tutor_reply, 1);
  assert.equal(summary.eventCounts.quiz_completed, 1);
  assert.equal(summary.conceptCount, 1);
  assert.equal(summary.concepts[0].latestScore, 75);
  assert.equal(summary.averageCitationCoverage, 0.75);
  assert.deepEqual(summary.recentEvents.map((event) => event.id), ["b", "a"]);
});

test("summarizeLearnerEvents reports tutor self-evaluation quality", () => {
  const events = [
    createLearnerEvent("tutor_reply", { conceptId: "docker-containers", quality: { total: 82, passScore: 70, pass: true } }, { now: 1 }),
    createLearnerEvent("tutor_reply", { conceptId: "docker-containers", quality: { total: 92, passScore: 70, pass: true } }, { now: 2 }),
  ];
  const summary = summarizeLearnerEvents(events);

  assert.equal(summary.averageTutorQuality, 87);
  assert.equal(summary.concepts[0].latestTutorQuality, 92);
});

test("createLearnerEvent rejects unsupported event types", () => {
  assert.throws(() => createLearnerEvent("unknown_event"), /Unsupported learner event type/);
});
