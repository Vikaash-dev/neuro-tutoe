import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeLearnerState,
  summarizeLearnerState,
} from "../src/learner-state.js";

test("sanitizeLearnerState preserves restorable learner profile, memory, and messages", () => {
  const clean = sanitizeLearnerState(
    {
      updatedAt: 1000,
      selectedConceptId: "docker-containers",
      activeMode: "socratic",
      learningGoal: "Understand containers well enough to debug them",
      profile: {
        learningStyle: "visual",
        depth: "advanced",
        tone: "direct",
        knownConcepts: ["images", "images", "volumes"],
        strugglingConcepts: ["network namespaces"],
        confidenceLevel: 120,
        motivationLevel: -5,
        assessmentHistory: [
          {
            conceptId: "docker-containers",
            conceptName: "Docker Containers",
            score: 82,
            source: "teach-back",
            missingPoints: ["layer reuse"],
            calibration: {
              predictedConfidence: 95,
              actualScore: 82,
              gap: 13,
              label: "developing",
              feedback: "Close, but check evidence before deciding.",
            },
          },
        ],
      },
      memory: {
        "docker-containers": {
          memoryType: "long_term",
          masteryLevel: "proficient",
          retentionScore: 81,
          nextReviewDate: 900,
          reviewCount: 3,
          correctAnswers: 7,
          totalAttempts: 9,
        },
      },
      messages: {
        "docker-containers": [
          { role: "user", content: "Explain containers" },
          {
            role: "assistant",
            content: "Containers isolate processes and package runtime dependencies.",
            provider: "lmstudio",
            model: "local-4b",
            sources: [{ id: "S1", title: "Container notes", score: 0.71 }],
            evidenceTrace: { sourceCount: 2, citedSourceCount: 1, labels: ["S1", "S2"] },
            quality: {
              total: 84,
              passScore: 70,
              pass: true,
              criteria: {
                coverage: { score: 24, evidence: "80% key-point coverage" },
              },
            },
          },
        ],
      },
    },
    { now: 5000 },
  );

  assert.equal(clean.updatedAt, 1000);
  assert.equal(clean.activeMode, "socratic");
  assert.equal(clean.profile.confidenceLevel, 100);
  assert.equal(clean.profile.motivationLevel, 0);
  assert.deepEqual(clean.profile.knownConcepts, ["images", "volumes"]);
  assert.equal(clean.profile.assessmentHistory[0].calibration.predictedConfidence, 95);
  assert.equal(clean.profile.assessmentHistory[0].calibration.actualScore, 82);
  assert.equal(clean.profile.assessmentHistory[0].calibration.label, "developing");
  assert.equal(clean.memory["docker-containers"].memoryType, "long_term");
  assert.equal(clean.memory["docker-containers"].masteryLevel, "proficient");
  assert.equal(clean.messages["docker-containers"].length, 2);
  assert.equal(clean.messages["docker-containers"][1].provider, "lmstudio");
  assert.equal(clean.messages["docker-containers"][1].sources[0].id, "S1");
  assert.equal(clean.messages["docker-containers"][1].evidenceTrace.sourceCount, 2);
  assert.equal(clean.messages["docker-containers"][1].quality.total, 84);
  assert.equal(clean.messages["docker-containers"][1].quality.criteria.coverage.score, 24);
});

test("sanitizeLearnerState keeps active quiz questions for server restore", () => {
  const clean = sanitizeLearnerState({
    selectedConceptId: "kubernetes-deployments",
    quiz: {
      conceptId: "kubernetes-deployments",
      index: 1,
      checked: true,
      complete: false,
      loading: true,
      provider: "lmstudio",
      questions: [
        {
          id: "q1",
          conceptId: "kubernetes-deployments",
          type: "multiple_choice",
          question: "What does a Deployment reconcile?",
          options: ["ReplicaSets", "Images", "Volumes"],
          correctAnswer: "ReplicaSets",
          explanation: "A Deployment manages ReplicaSets to converge pods.",
          relatedMisconceptions: ["Deployment is a pod"],
        },
      ],
      answers: { q1: "ReplicaSets" },
    },
  });

  assert.equal(clean.quiz.loading, false);
  assert.equal(clean.quiz.questionCount, 1);
  assert.equal(clean.quiz.questions[0].question, "What does a Deployment reconcile?");
  assert.equal(clean.quiz.answers.q1, "ReplicaSets");
});

test("summarizeLearnerState reports restore-relevant counts and due reviews", () => {
  const summary = summarizeLearnerState({
    updatedAt: 100,
    selectedConceptId: "docker-containers",
    memory: {
      a: { conceptId: "a", nextReviewDate: 1 },
      b: { conceptId: "b", nextReviewDate: Date.now() + 86400000 },
    },
    messages: {
      a: [{ role: "user", content: "one" }],
      b: [{ role: "assistant", content: "two" }, { role: "user", content: "three" }],
    },
    profile: {
      knownConcepts: ["a"],
      strugglingConcepts: ["b", "c"],
      assessmentHistory: [{ conceptId: "a", score: 70 }],
    },
    quiz: {
      conceptId: "a",
      complete: false,
      questions: [{ id: "q1", question: "Q?", correctAnswer: "A" }],
    },
  });

  assert.equal(summary.memoryCount, 2);
  assert.equal(summary.messageCount, 3);
  assert.equal(summary.knownConceptCount, 1);
  assert.equal(summary.strugglingConceptCount, 2);
  assert.equal(summary.assessmentCount, 1);
  assert.equal(summary.dueReviews, 1);
  assert.equal(summary.hasActiveQuiz, true);
});
