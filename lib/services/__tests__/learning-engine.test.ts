/**
 * Unit Tests for Learning Engine Service
 * Tests core learning logic: memory management, spaced repetition, mastery levels
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LearningEngineService } from "../learning-engine";
import { ConceptMemoryState, MasteryLevel } from "@/lib/types/learning";

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("LearningEngineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Memory State Management", () => {
    it("should create initial memory state for a new concept", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const memoryState = await LearningEngineService.getMemoryState("test-concept");
      expect(memoryState).toBeNull();
    });

    it("should update memory state correctly", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue("{}");

      const updated = await LearningEngineService.updateMemoryState("test-concept", {
        retentionScore: 85,
        masteryLevel: "intermediate" as MasteryLevel,
      });

      expect(updated.retentionScore).toBe(85);
      expect(updated.masteryLevel).toBe("intermediate");
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("Consolidation Progress Calculation", () => {
    it("should calculate consolidation progress correctly", () => {
      const progress = LearningEngineService.calculateConsolidationProgress(
        3, // 3 reviews
        8, // 8 correct answers
        10, // 10 total attempts
        14 // 14 days since first review
      );

      // Accuracy: 80%, Reviews: 60%, Time: 66.67%
      // Weighted: 80*0.4 + 60*0.35 + 66.67*0.25 = 69.67
      expect(progress).toBeGreaterThan(69);
      expect(progress).toBeLessThan(71);
    });

    it("should return 0 progress for no attempts", () => {
      const progress = LearningEngineService.calculateConsolidationProgress(0, 0, 0, 0);
      expect(progress).toBe(0);
    });

    it("should cap progress at 100", () => {
      const progress = LearningEngineService.calculateConsolidationProgress(
        10, // many reviews
        100, // perfect accuracy
        100,
        30 // 30+ days
      );

      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  describe("LTM Consolidation Criteria", () => {
    it("should consolidate to LTM when criteria are met", () => {
      const memoryState: ConceptMemoryState = {
        conceptId: "test",
        memoryType: "short_term",
        masteryLevel: "proficient",
        retentionScore: 85,
        lastReviewDate: Date.now(),
        nextReviewDate: Date.now() + 86400000,
        reviewCount: 3,
        correctAnswers: 8,
        totalAttempts: 10,
        sessionLearned: Date.now(),
        consolidationProgress: 75,
      };

      const shouldConsolidate = LearningEngineService.shouldConsolidateToLTM(memoryState);
      expect(shouldConsolidate).toBe(true);
    });

    it("should not consolidate with low consolidation progress", () => {
      const memoryState: ConceptMemoryState = {
        conceptId: "test",
        memoryType: "short_term",
        masteryLevel: "intermediate",
        retentionScore: 50,
        lastReviewDate: Date.now(),
        nextReviewDate: Date.now() + 86400000,
        reviewCount: 3,
        correctAnswers: 5,
        totalAttempts: 10,
        sessionLearned: Date.now(),
        consolidationProgress: 40, // Too low
      };

      const shouldConsolidate = LearningEngineService.shouldConsolidateToLTM(memoryState);
      expect(shouldConsolidate).toBe(false);
    });

    it("should not consolidate with insufficient reviews", () => {
      const memoryState: ConceptMemoryState = {
        conceptId: "test",
        memoryType: "short_term",
        masteryLevel: "intermediate",
        retentionScore: 85,
        lastReviewDate: Date.now(),
        nextReviewDate: Date.now() + 86400000,
        reviewCount: 1, // Only 1 review
        correctAnswers: 8,
        totalAttempts: 10,
        sessionLearned: Date.now(),
        consolidationProgress: 75,
      };

      const shouldConsolidate = LearningEngineService.shouldConsolidateToLTM(memoryState);
      expect(shouldConsolidate).toBe(false);
    });

    it("should not consolidate with low accuracy", () => {
      const memoryState: ConceptMemoryState = {
        conceptId: "test",
        memoryType: "short_term",
        masteryLevel: "intermediate",
        retentionScore: 70,
        lastReviewDate: Date.now(),
        nextReviewDate: Date.now() + 86400000,
        reviewCount: 3,
        correctAnswers: 6, // 60% accuracy, below 80% threshold
        totalAttempts: 10,
        sessionLearned: Date.now(),
        consolidationProgress: 75,
      };

      const shouldConsolidate = LearningEngineService.shouldConsolidateToLTM(memoryState);
      expect(shouldConsolidate).toBe(false);
    });
  });

  describe("Mastery Level Updates", () => {
    it("should progress from novice to intermediate", () => {
      const newMastery = LearningEngineService.updateMasteryLevel("novice", 75, 1);
      expect(newMastery).toBe("intermediate");
    });

    it("should progress from intermediate to proficient", () => {
      const newMastery = LearningEngineService.updateMasteryLevel("intermediate", 85, 2);
      expect(newMastery).toBe("proficient");
    });

    it("should progress from proficient to expert", () => {
      const newMastery = LearningEngineService.updateMasteryLevel("proficient", 92, 3);
      expect(newMastery).toBe("expert");
    });

    it("should not progress with low score", () => {
      const newMastery = LearningEngineService.updateMasteryLevel("novice", 60, 1);
      expect(newMastery).toBe("novice");
    });

    it("should not progress with insufficient reviews", () => {
      const newMastery = LearningEngineService.updateMasteryLevel("intermediate", 85, 1);
      expect(newMastery).toBe("intermediate");
    });
  });

  describe("Spaced Repetition Schedule (SM-2 Algorithm)", () => {
    it("should create default schedule for new concept", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue("{}");

      const schedule = await LearningEngineService.getSpacedRepetitionSchedule(
        "new-concept"
      );

      expect(schedule.conceptId).toBe("new-concept");
      expect(schedule.reviewIntervals).toHaveLength(4);
      expect(schedule.currentInterval).toBe(0);
      expect(schedule.easeFactor).toBe(2.5);
    });

    it("should update schedule on successful review (quality 5)", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue("{}");

      const updated = await LearningEngineService.updateSpacedRepetitionSchedule(
        "test-concept",
        5 // Perfect score
      );

      expect(updated.currentInterval).toBeGreaterThan(0);
      expect(updated.easeFactor).toBeGreaterThan(2.5);
      expect(updated.nextReviewDate).toBeGreaterThan(Date.now());
    });

    it("should reset schedule on failed review (quality < 3)", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue("{}");

      const updated = await LearningEngineService.updateSpacedRepetitionSchedule(
        "test-concept",
        2 // Failed
      );

      expect(updated.currentInterval).toBe(0);
      expect(updated.easeFactor).toBeLessThan(2.5);
    });
  });

  describe("Mental Model Management", () => {
    it("should create default mental model for new user", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const model = await LearningEngineService.getMentalModel("user-123");

      expect(model.studentId).toBe("user-123");
      expect(model.learningStyle).toBe("visual");
      expect(model.communicationPreference).toBe("encouraging");
      expect(model.explanationDepth).toBe("moderate");
    });

    it("should update mental model", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const updated = await LearningEngineService.updateMentalModel("user-123", {
        learningStyle: "kinesthetic",
        motivationLevel: 90,
      });

      expect(updated.learningStyle).toBe("kinesthetic");
      expect(updated.motivationLevel).toBe(90);
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("Quiz Attempt Processing", () => {
    it("should process correct quiz attempt", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue("{}");

      const memoryState: ConceptMemoryState = {
        conceptId: "test",
        memoryType: "short_term",
        masteryLevel: "novice",
        retentionScore: 50,
        lastReviewDate: Date.now(),
        nextReviewDate: Date.now() + 86400000,
        reviewCount: 1,
        correctAnswers: 0,
        totalAttempts: 0,
        sessionLearned: Date.now(),
        consolidationProgress: 20,
      };

      const attempt = {
        id: "attempt-1",
        questionId: "q1",
        userAnswer: "correct",
        isCorrect: true,
        timeSpent: 5000,
        confidence: 4,
        feedback: "Great!",
        conceptId: "test",
        timestamp: Date.now(),
      };

      const updated = await LearningEngineService.processQuizAttempt(
        "test",
        attempt,
        memoryState
      );

      expect(updated.correctAnswers).toBe(1);
      expect(updated.totalAttempts).toBe(1);
      expect(updated.retentionScore).toBeGreaterThan(50);
    });

    it("should process incorrect quiz attempt", async () => {
      const mockAsyncStorage = AsyncStorage as any;
      mockAsyncStorage.getItem.mockResolvedValue("{}");

      const memoryState: ConceptMemoryState = {
        conceptId: "test",
        memoryType: "short_term",
        masteryLevel: "novice",
        retentionScore: 75,
        lastReviewDate: Date.now(),
        nextReviewDate: Date.now() + 86400000,
        reviewCount: 1,
        correctAnswers: 1,
        totalAttempts: 1,
        sessionLearned: Date.now(),
        consolidationProgress: 20,
      };

      const attempt = {
        id: "attempt-2",
        questionId: "q2",
        userAnswer: "incorrect",
        isCorrect: false,
        timeSpent: 8000,
        confidence: 2,
        feedback: "Not quite. Try again.",
        conceptId: "test",
        timestamp: Date.now(),
      };

      const updated = await LearningEngineService.processQuizAttempt(
        "test",
        attempt,
        memoryState
      );

      expect(updated.correctAnswers).toBe(1); // No change
      expect(updated.totalAttempts).toBe(2);
      expect(updated.retentionScore).toBeLessThan(75);
    });
  });
});
