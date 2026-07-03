import test from "node:test";
import assert from "node:assert/strict";
import { getConceptById } from "../src/concepts.js";
import {
  analyzeTeachBack,
  assessTransferAttempt,
  buildTutorSessionState,
  buildCalibrationInsight,
  createInitialMemory,
  generateLearningPath,
  generateQuiz,
  generateTutorReply,
  generateWhiteboardArtifact,
  inferSkillGaps,
  updateLearnerProfileAfterAssessment,
  updateMemoryAfterTeachBack,
  updateMemoryAfterQuiz,
} from "../src/tutor-engine.js";

test("teach-back analysis rewards key-point coverage", () => {
  const concept = getConceptById("photosynthesis");
  const result = analyzeTeachBack({
    concept,
    explanation:
      "Photosynthesis happens in chloroplasts. Plants use light energy, water, and carbon dioxide to make glucose and oxygen.",
  });

  assert.ok(result.accuracy >= 65);
  assert.ok(result.coveredPoints.length >= 3);
});

test("teach-back analysis handles natural singular and plural wording", () => {
  const result = analyzeTeachBack({
    conceptId: "docker-containers",
    explanation:
      "A Docker image is the template and a container is the running instance made from it. A container packages the app with dependencies, shares the host OS kernel instead of being a full virtual machine, and a volume keeps important data outside the container lifecycle.",
  });

  assert.ok(result.accuracy >= 75);
  assert.ok(result.coveredPoints.includes("Images are templates and containers are running instances"));
  assert.ok(result.coveredPoints.includes("Volumes persist data outside the container lifecycle"));
});

test("teach-back analysis does not flag correct deployment-pod relationship as same-as misconception", () => {
  const result = analyzeTeachBack({
    conceptId: "kubernetes-deployments",
    explanation:
      "A Kubernetes Deployment declares desired state for a stateless app, such as three replicas of version 2. The Deployment manages a ReplicaSet, and the ReplicaSet keeps the right number of Pods running. During a rolling update, new Pods are added gradually and old Pods are removed gradually. Health checks help Kubernetes avoid routing traffic to unhealthy Pods and restart bad ones, while a Service gives users a stable network address even though individual Pods change.",
  });

  assert.ok(result.accuracy >= 85);
  assert.deepEqual(result.misconceptions, []);
});

test("partial known concept payloads are completed before tutor generation", () => {
  const reply = generateTutorReply({
    concept: {
      id: "docker-containers",
      name: "Docker Containers",
      description: "A lightweight way to package and run applications.",
      keyPoints: ["Images are templates and containers are running instances"],
      commonMisconceptions: ["Containers are the same as virtual machines"],
    },
    profile: {
      learningStyle: "visual",
      depth: "simple",
      strugglingConcepts: ["Docker Containers"],
    },
    message: "I think containers are tiny virtual machines.",
  });

  assert.equal(reply.content.includes("undefined"), false);
  assert.match(reply.content, /sealed lunchbox|Think of it/i);
});

test("quiz generation produces answerable multiple choice questions", () => {
  const concept = getConceptById("docker-containers");
  const questions = generateQuiz({ concept, count: 4 });

  assert.equal(questions.length, 4);
  for (const question of questions.filter((item) => item.type === "multiple_choice")) {
    assert.ok(question.options.includes(question.correctAnswer));
    assert.ok(question.explanation.length > 20);
  }
});

test("high quiz score advances memory state", () => {
  const memory = createInitialMemory("docker-containers");
  const updated = updateMemoryAfterQuiz(memory, 92, 5);

  assert.equal(updated.reviewCount, 1);
  assert.equal(updated.masteryLevel, "intermediate");
  assert.ok(updated.nextReviewDate > Date.now());
  assert.ok(updated.stabilityDays > memory.stabilityDays);
});

test("teach-back assessment updates memory scheduling", () => {
  const memory = createInitialMemory("docker-containers");
  const updated = updateMemoryAfterTeachBack(memory, 88);

  assert.equal(updated.reviewCount, 1);
  assert.equal(updated.masteryLevel, "intermediate");
  assert.ok(updated.retentionScore > memory.retentionScore);
  assert.ok(updated.nextReviewDate > Date.now());
});

test("strong assessment promotes a concept into the learner model", () => {
  const profile = {
    learningStyle: "verbal",
    depth: "detailed",
    tone: "neutral",
    knownConcepts: [],
    strugglingConcepts: ["Docker Containers"],
    confidenceLevel: 48,
    motivationLevel: 70,
  };

  const updated = updateLearnerProfileAfterAssessment(profile, {
    concept: getConceptById("docker-containers"),
    score: 92,
    source: "quiz",
    createdAt: 123,
  });

  assert.equal(updated.learningStyle, "verbal");
  assert.deepEqual(updated.knownConcepts, ["Docker Containers"]);
  assert.deepEqual(updated.strugglingConcepts, []);
  assert.ok(updated.confidenceLevel > profile.confidenceLevel);
  assert.equal(updated.assessmentHistory[0].status, "strengthening");
});

test("weak assessment marks a concept for review and removes false confidence", () => {
  const updated = updateLearnerProfileAfterAssessment(
    {
      knownConcepts: ["Photosynthesis"],
      strugglingConcepts: [],
      confidenceLevel: "99",
      motivationLevel: 50,
    },
    {
      conceptId: "photosynthesis",
      score: 42,
      missingPoints: ["Chloroplasts capture light energy", "Carbon dioxide and water become glucose"],
      misconceptions: ["Plants get all energy from soil nutrients"],
      source: "teach-back",
      createdAt: 456,
    },
  );

  assert.deepEqual(updated.knownConcepts, []);
  assert.deepEqual(updated.strugglingConcepts, ["Photosynthesis"]);
  assert.ok(updated.confidenceLevel < 99);
  assert.equal(updated.assessmentHistory[0].status, "needs_review");
  assert.equal(updated.assessmentHistory[0].source, "teach-back");
});

test("session state chooses learn, repair, and transfer phases", () => {
  const concept = getConceptById("docker-containers");
  const fresh = buildTutorSessionState({
    concept,
    memory: createInitialMemory("docker-containers"),
    profile: {},
    now: Date.now(),
  });

  const repair = buildTutorSessionState({
    concept,
    memory: { ...createInitialMemory("docker-containers"), reviewCount: 1, retentionScore: 30 },
    profile: {
      strugglingConcepts: ["Docker Containers"],
      assessmentHistory: [
        {
          conceptId: "docker-containers",
          status: "needs_review",
          missingPoints: ["Images are templates and containers are running instances"],
          misconceptions: [],
        },
      ],
    },
    now: Date.now(),
  });

  const transfer = buildTutorSessionState({
    concept,
    memory: { ...createInitialMemory("docker-containers"), reviewCount: 3, masteryLevel: "expert", retentionScore: 92 },
    profile: { knownConcepts: ["Docker Containers"] },
    now: Date.now() - 1,
  });

  assert.equal(fresh.phase, "learn");
  assert.equal(repair.phase, "repair");
  assert.equal(repair.focusPoints[0], "Images are templates and containers are running instances");
  assert.equal(transfer.phase, "transfer");
});

test("tutor reply returns useful content for each mode", () => {
  for (const mode of ["explainer", "socratic", "student", "duck"]) {
    const reply = generateTutorReply({
      conceptId: "kubernetes-deployments",
      mode,
      message: "I think deployments run pods and help with updates.",
    });

    assert.equal(reply.role, "assistant");
    assert.ok(reply.content.includes("Kubernetes") || reply.content.length > 40);
    assert.ok(reply.followUps.length >= 2);
  }
});

test("socratic tutor acknowledges correct anchors and contrasts misconceptions", () => {
  const reply = generateTutorReply({
    conceptId: "docker-containers",
    mode: "socratic",
    message:
      "The image is a template, the container is the running copy, and volumes hold data outside the container.",
  });

  assert.match(reply.content, /Good anchor|Start with the mechanism/);
  assert.match(reply.content, /trap to avoid/i);
  assert.match(reply.content, /virtual machines|misconception/i);
  assert.match(reply.content, /\?/);
});

test("skill gap analysis includes prerequisites and target concept", () => {
  const concept = getConceptById("photosynthesis");
  const gaps = inferSkillGaps({ concept, memoryByConcept: {} });

  assert.ok(gaps.some((gap) => gap.id === "photosynthesis"));
  assert.ok(gaps.some((gap) => gap.id === "light-energy"));
  assert.ok(gaps.every((gap) => typeof gap.reason === "string"));
});

test("learning path creates prerequisite repair and assessment sessions", () => {
  const concept = getConceptById("kubernetes-deployments");
  const path = generateLearningPath({ concept, memoryByConcept: {} });

  assert.equal(path.target, "Kubernetes Deployments");
  assert.ok(path.sessions.length >= 4);
  assert.ok(path.sessions.some((session) => session.title.includes("Repair prerequisite")));
  assert.ok(path.sessions.some((session) => session.status === "assessment"));
});

test("learning path includes learner-model repair when current concept is weak", () => {
  const concept = getConceptById("docker-containers");
  const path = generateLearningPath({
    concept,
    memoryByConcept: { "docker-containers": { ...createInitialMemory("docker-containers"), reviewCount: 1 } },
    profile: {
      strugglingConcepts: ["Docker Containers"],
      assessmentHistory: [
        {
          conceptId: "docker-containers",
          status: "needs_review",
          missingPoints: ["Volumes persist data outside the container lifecycle"],
        },
      ],
    },
  });

  assert.ok(path.sessions.some((session) => session.status === "repair"));
  assert.ok(path.sessions.some((session) => session.associatedSkills.includes("Volumes persist data outside the container lifecycle")));
});

test("quiz generation targets recent missing points from learner history", () => {
  const concept = getConceptById("docker-containers");
  const questions = generateQuiz({
    concept,
    count: 4,
    profile: {
      assessmentHistory: [
        {
          conceptId: "docker-containers",
          missingPoints: ["Volumes persist data outside the container lifecycle"],
          misconceptions: ["Deleting a container always deletes every piece of data"],
        },
      ],
    },
  });

  assert.ok(questions.some((question) => question.correctAnswer === "Volumes persist data outside the container lifecycle"));
  assert.ok(questions.some((question) => question.relatedMisconceptions.includes("Deleting a container always deletes every piece of data")));
});

test("transfer assessment rewards invariant reasoning across a new context", () => {
  const result = assessTransferAttempt({
    conceptId: "docker-containers",
    sourceExample: "Run a web API in a container on a laptop.",
    targetExample: "Move the same API to a cloud worker that needs persistent logs.",
    answer:
      "The invariant is that the image is still the template and the container is the running instance. What changes is the environment: in cloud deployment I must attach a volume for persistent logs because deleting a container should not delete the data.",
  });

  assert.equal(result.conceptId, "docker-containers");
  assert.equal(result.transferLevel, "far");
  assert.ok(result.score >= 80);
  assert.ok(result.invariantChecks.length >= 1);
  assert.ok(result.changedChecks.length >= 1);
  assert.deepEqual(result.misconceptions, []);
});

test("metacognitive calibration labels overconfidence and stores it in assessment history", () => {
  const calibration = buildCalibrationInsight({ predictedConfidence: 95, actualScore: 42 });

  assert.equal(calibration.label, "overconfident");
  assert.equal(calibration.gap, 53);
  assert.match(calibration.feedback, /slow down|evidence/i);

  const updated = updateLearnerProfileAfterAssessment(
    {
      knownConcepts: ["Docker Containers"],
      strugglingConcepts: [],
      confidenceLevel: 88,
      motivationLevel: 70,
    },
    {
      conceptId: "docker-containers",
      score: 42,
      predictedConfidence: 95,
      missingPoints: ["Volumes persist data outside the container lifecycle"],
      source: "transfer",
      createdAt: 789,
    },
  );

  assert.equal(updated.assessmentHistory[0].source, "transfer");
  assert.equal(updated.assessmentHistory[0].calibration.label, "overconfident");
  assert.equal(updated.assessmentHistory[0].calibration.gap, 53);
  assert.ok(updated.confidenceLevel < 80);
  assert.deepEqual(updated.strugglingConcepts, ["Docker Containers"]);
});

test("whiteboard artifact includes notes and graph edges", () => {
  const artifact = generateWhiteboardArtifact({ conceptId: "cellular-respiration" });

  assert.ok(artifact.notes.length >= 3);
  assert.ok(artifact.edges.length >= 1);
  assert.equal(artifact.diagram.centerId, "cellular-respiration");
  assert.equal(artifact.diagram.nodeCount, artifact.nodes.length);
  assert.ok(artifact.misconceptionContrast.misconception);
  assert.ok(artifact.workedExample.steps.length >= 3);
  assert.match(artifact.teachBackPrompt, /Cellular Respiration/);
  assert.equal(artifact.title, "Cellular Respiration whiteboard");
});
