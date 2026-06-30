import test from "node:test";
import assert from "node:assert/strict";
import { buildCourseOutline } from "../src/course-outline.js";

const knowledgeSummary = {
  documentCount: 3,
  chunkCount: 18,
  documents: [
    { id: "concept-docker", title: "Docker card", conceptId: "docker-containers" },
    { id: "concept-k8s", title: "Kubernetes card", conceptId: "kubernetes-deployments" },
    { id: "global", title: "General DevOps notes", conceptId: "" },
  ],
};

test("buildCourseOutline creates modules from prerequisites, target, and related concepts", () => {
  const outline = buildCourseOutline({
    now: 1000,
    conceptId: "kubernetes-deployments",
    goal: "Deploy apps safely with Kubernetes",
    knowledgeSummary,
  });

  assert.equal(outline.conceptId, "kubernetes-deployments");
  assert.equal(outline.goal, "Deploy apps safely with Kubernetes");
  assert.ok(outline.modules.length >= 3);
  assert.equal(outline.modules[0].role, "prerequisite");
  assert.ok(outline.modules.some((module) => module.role === "core"));
  assert.ok(outline.modules.every((module) => module.checkpoints.length >= 4));
  assert.equal(outline.sourceCoverage.documentCount, 3);
});

test("buildCourseOutline marks completed modules from learner events", () => {
  const outline = buildCourseOutline({
    now: 2000,
    conceptId: "docker-containers",
    knowledgeSummary,
    events: [
      { type: "teach_back_assessment", conceptId: "docker-containers", score: 85, createdAt: 1 },
      { type: "quiz_completed", conceptId: "docker-containers", score: 90, createdAt: 2 },
    ],
  });

  const core = outline.modules.find((module) => module.conceptId === "docker-containers");
  assert.equal(core.status, "complete");
  assert.ok(outline.progress.percent > 0);
});

test("buildCourseOutline reports source gaps per module", () => {
  const outline = buildCourseOutline({
    now: 3000,
    conceptId: "photosynthesis",
    knowledgeSummary: { documentCount: 0, chunkCount: 0, documents: [] },
  });

  assert.equal(outline.sourceCoverage.readyModules, 0);
  assert.ok(outline.modules.every((module) => module.sourceCoverage.hasDedicatedSource === false));
});
