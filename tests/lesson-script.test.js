import test from "node:test";
import assert from "node:assert/strict";
import { buildLessonScript, summarizeLessonScripts } from "../src/lesson-script.js";

test("buildLessonScript creates a concrete guided session with core tutor steps", () => {
  const script = buildLessonScript({
    now: 1000,
    state: {
      selectedConceptId: "docker-containers",
      learningGoal: "Debug Docker containers confidently",
      profile: {
        learningStyle: "visual",
        strugglingConcepts: ["Docker Containers"],
        assessmentHistory: [
          {
            conceptId: "docker-containers",
            missingPoints: ["Images are templates and containers are running instances"],
            misconceptions: ["Containers are the same as virtual machines"],
          },
        ],
      },
    },
    events: [],
  });

  assert.equal(script.conceptId, "docker-containers");
  assert.equal(script.goal, "Debug Docker containers confidently");
  assert.ok(script.steps.some((step) => step.id === "orient" && step.view === "tutor"));
  assert.ok(script.steps.some((step) => step.id === "source-grounding" && step.view === "knowledge"));
  assert.ok(script.steps.some((step) => step.id === "teach-back" && step.view === "teachback"));
  assert.ok(script.steps.some((step) => step.id === "active-recall" && step.view === "quiz"));
  assert.ok(script.estimatedMinutes > 0);
});

test("buildLessonScript marks progress from learner events", () => {
  const script = buildLessonScript({
    now: 2000,
    state: {
      selectedConceptId: "docker-containers",
      memory: {
        "docker-containers": {
          conceptId: "docker-containers",
          reviewCount: 2,
          retentionScore: 82,
          lastReviewDate: 1000,
          nextReviewDate: 3000,
          masteryLevel: "intermediate",
          stabilityDays: 2,
        },
      },
    },
    events: [
      { type: "tutor_reply", conceptId: "docker-containers", createdAt: 1, sourceCount: 2 },
      { type: "teach_back_assessment", conceptId: "docker-containers", createdAt: 2, score: 82 },
      { type: "quiz_completed", conceptId: "docker-containers", createdAt: 3, score: 90 },
    ],
  });

  assert.equal(script.steps.find((step) => step.id === "orient").status, "done");
  assert.equal(script.steps.find((step) => step.id === "teach-back").status, "done");
  assert.equal(script.steps.find((step) => step.id === "active-recall").status, "done");
  assert.ok(script.progress.percent > 0);
  assert.equal(script.currentStep.id, "transfer");
});

test("buildLessonScript includes prerequisite repair for blocked concepts", () => {
  const script = buildLessonScript({
    now: 3000,
    conceptId: "kubernetes-deployments",
    state: {
      selectedConceptId: "kubernetes-deployments",
      memory: {},
    },
    events: [],
  });

  assert.equal(script.learnerSignals.blockedPrerequisites.includes("docker-containers"), true);
  assert.ok(script.steps[0].id.startsWith("repair-docker-containers"));
});

test("summarizeLessonScripts returns compact latest-first summaries", () => {
  const summaries = summarizeLessonScripts([
    { id: "old", conceptId: "a", conceptName: "A", title: "Old", status: "ready", generatedAt: 1, progress: { percent: 0 } },
    { id: "new", conceptId: "b", conceptName: "B", title: "New", status: "in_progress", generatedAt: 2, currentStep: { title: "Next" }, progress: { percent: 50 } },
  ]);

  assert.deepEqual(summaries.map((item) => item.id), ["new", "old"]);
  assert.equal(summaries[0].currentStepTitle, "Next");
});
