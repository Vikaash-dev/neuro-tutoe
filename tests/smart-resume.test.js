import test from "node:test";
import assert from "node:assert/strict";
import { buildSmartResume } from "../src/smart-resume.js";

test("buildSmartResume turns learner state into concrete next actions", () => {
  const now = 1_000_000;
  const resume = buildSmartResume({
    now,
    state: {
      updatedAt: now - 100,
      selectedConceptId: "docker-containers",
      profile: {
        strugglingConcepts: ["Docker Containers"],
        confidenceLevel: 42,
        motivationLevel: 70,
      },
      memory: {
        "docker-containers": {
          conceptId: "docker-containers",
          memoryType: "short_term",
          masteryLevel: "novice",
          retentionScore: 38,
          lastReviewDate: now - 86400000,
          nextReviewDate: now - 1,
          reviewCount: 2,
          correctAnswers: 3,
          totalAttempts: 8,
          sessionLearned: now - 172800000,
          consolidationProgress: 24,
          stabilityDays: 1,
        },
      },
      quiz: {
        conceptId: "docker-containers",
        complete: false,
        questions: [{ id: "q1", question: "What is isolated?", correctAnswer: "processes" }],
      },
      lastTeachBack: {
        conceptId: "docker-containers",
        accuracy: 58,
        missingPoints: ["Namespaces isolate process views"],
      },
    },
    events: [
      {
        id: "quiz-low",
        type: "quiz_completed",
        createdAt: now - 50,
        conceptId: "docker-containers",
        conceptName: "Docker Containers",
        score: 55,
      },
    ],
  });

  assert.equal(resume.currentConcept.id, "docker-containers");
  assert.equal(resume.learnerSignals.hasActiveQuiz, true);
  assert.equal(resume.learnerSignals.dueReviewCount, 1);
  assert.equal(resume.dueReviews[0].conceptName, "Docker Containers");
  assert.equal(resume.recentActivity[0].id, "quiz-low");
  assert.ok(resume.actions.some((item) => item.id === "continue-active-quiz"));
  assert.ok(resume.actions.some((item) => item.id === "repair-teach-back"));
  assert.ok(resume.actions.some((item) => item.id === "retry-low-quiz"));
});

test("buildSmartResume returns a usable default for a new learner", () => {
  const resume = buildSmartResume({ now: 2000, state: { updatedAt: 0 }, events: [] });

  assert.equal(resume.currentConcept.id, "docker-containers");
  assert.equal(resume.learnerSignals.phase, "learn");
  assert.equal(resume.actions.length >= 1, true);
  assert.equal(resume.actions[0].view, "tutor");
  assert.deepEqual(resume.recentActivity, []);
});
