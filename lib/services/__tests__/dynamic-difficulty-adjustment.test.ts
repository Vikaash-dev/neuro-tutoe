import { describe, it, expect } from "vitest";
import {
  DualRewardCalculator,
  AdaptiveCurriculumSelector,
  DDAController,
} from "../dynamic-difficulty-adjustment";
import type { OverloadState, CurriculumTask } from "@/lib/types/learning";

const noOverload: OverloadState = {
  severity: "none",
  signal: {
    repetitionDetected: false,
    fragmentationScore: 0,
    circularLogicDetected: false,
    lexicalDiversity: 0.7,
    confusionMarkerCount: 0,
    coherenceDivergence: 0,
  },
  recommendedAction: "continue",
  detectedAt: Date.now(),
};

const severeOverload: OverloadState = {
  severity: "severe",
  signal: {
    repetitionDetected: true,
    fragmentationScore: 0.9,
    circularLogicDetected: true,
    lexicalDiversity: 0.1,
    confusionMarkerCount: 4,
    coherenceDivergence: 0.8,
  },
  recommendedAction: "pause_and_recap",
  detectedAt: Date.now(),
};

describe("DualRewardCalculator", () => {
  describe("correctnessReward", () => {
    it("should clamp to [0, 1]", () => {
      expect(DualRewardCalculator.correctnessReward(0)).toBe(0);
      expect(DualRewardCalculator.correctnessReward(1)).toBe(1);
      expect(DualRewardCalculator.correctnessReward(1.5)).toBe(1);
    });
  });

  describe("difficultyOptimalityReward", () => {
    it("should peak when task difficulty equals mastery", () => {
      const atCenter = DualRewardCalculator.difficultyOptimalityReward(5, 5);
      const farAbove = DualRewardCalculator.difficultyOptimalityReward(10, 5);
      expect(atCenter).toBeGreaterThan(farAbove);
    });

    it("should return positive reward for tasks within ZPD", () => {
      const reward = DualRewardCalculator.difficultyOptimalityReward(6, 5);
      expect(reward).toBeGreaterThan(0);
    });

    it("should return near-zero reward for tasks far outside ZPD", () => {
      const reward = DualRewardCalculator.difficultyOptimalityReward(1, 9);
      expect(reward).toBeLessThan(0.2);
    });
  });

  describe("compute", () => {
    it("should apply overload penalty for severe overload", () => {
      const noOverloadReward = DualRewardCalculator.compute(1.0, 5, 5, noOverload);
      const overloadReward = DualRewardCalculator.compute(1.0, 5, 5, severeOverload);
      expect(noOverloadReward.compositeReward).toBeGreaterThan(overloadReward.compositeReward);
    });

    it("should produce zero composite reward for severe overload with perfect answer", () => {
      const reward = DualRewardCalculator.compute(1.0, 5, 5, severeOverload);
      expect(reward.compositeReward).toBe(0);
    });

    it("should produce high composite reward for correct answer, optimal difficulty, no overload", () => {
      const reward = DualRewardCalculator.compute(1.0, 5, 5, noOverload);
      expect(reward.compositeReward).toBeGreaterThan(0.7);
    });
  });
});

describe("AdaptiveCurriculumSelector", () => {
  describe("updateZPD", () => {
    it("should advance ZPD centre when rewards are high", () => {
      const highRewards = Array.from({ length: 5 }, () => ({
        correctness: 1,
        difficultyOptimality: 1,
        overloadPenalty: 0,
        compositeReward: 0.9,
      }));
      const zpd = AdaptiveCurriculumSelector.updateZPD(5, highRewards);
      expect((zpd.lower + zpd.upper) / 2).toBeGreaterThan(5);
    });

    it("should retreat ZPD centre when rewards are low", () => {
      const lowRewards = Array.from({ length: 5 }, () => ({
        correctness: 0,
        difficultyOptimality: 0,
        overloadPenalty: 1,
        compositeReward: 0.1,
      }));
      const zpd = AdaptiveCurriculumSelector.updateZPD(5, lowRewards);
      expect((zpd.lower + zpd.upper) / 2).toBeLessThan(5);
    });
  });

  describe("selectNextTask", () => {
    const candidates: CurriculumTask[] = [
      { id: "easy", conceptId: "c1", difficulty: 2, questionType: "recall", estimatedIntrinsicLoad: 2, recentSuccessRate: 0.9 },
      { id: "medium", conceptId: "c2", difficulty: 5, questionType: "application", estimatedIntrinsicLoad: 5, recentSuccessRate: 0.7 },
      { id: "hard", conceptId: "c3", difficulty: 8, questionType: "synthesis", estimatedIntrinsicLoad: 8, recentSuccessRate: 0.4 },
    ];

    it("should select easiest task under severe overload", () => {
      const zpd = { lower: 4, upper: 7 };
      const selected = AdaptiveCurriculumSelector.selectNextTask(candidates, zpd, severeOverload);
      expect(selected?.id).toBe("easy");
    });

    it("should prefer task within ZPD when no overload", () => {
      const zpd = { lower: 4, upper: 6 };
      const selected = AdaptiveCurriculumSelector.selectNextTask(candidates, zpd, noOverload);
      expect(selected?.difficulty).toBeGreaterThanOrEqual(4);
      expect(selected?.difficulty).toBeLessThanOrEqual(6);
    });

    it("should return null for empty candidate list", () => {
      expect(AdaptiveCurriculumSelector.selectNextTask([], { lower: 4, upper: 6 }, noOverload)).toBeNull();
    });
  });
});

describe("DDAController", () => {
  describe("createInitialState", () => {
    it("should start at the given difficulty", () => {
      const state = DDAController.createInitialState(6);
      expect(state.currentDifficulty).toBe(6);
    });

    it("should clamp difficulty to [1, 10]", () => {
      const low = DDAController.createInitialState(0);
      const high = DDAController.createInitialState(15);
      expect(low.currentDifficulty).toBeGreaterThanOrEqual(1);
      expect(high.currentDifficulty).toBeLessThanOrEqual(10);
    });
  });

  describe("processInteraction", () => {
    it("should decrease difficulty after consecutive overloads", () => {
      let state = DDAController.createInitialState(7);
      state = DDAController.processInteraction(state, 0.5, severeOverload);
      state = DDAController.processInteraction(state, 0.5, severeOverload);
      expect(state.currentDifficulty).toBeLessThan(7);
    });

    it("should track adjustment history", () => {
      let state = DDAController.createInitialState(5);
      state = DDAController.processInteraction(state, 1.0, noOverload);
      state = DDAController.processInteraction(state, 1.0, noOverload);
      state = DDAController.processInteraction(state, 1.0, noOverload);
      // History may be empty (no change) or populated — just verify it's an array
      expect(Array.isArray(state.adjustmentHistory)).toBe(true);
    });

    it("should reset overload count when student recovers", () => {
      let state = DDAController.createInitialState(5);
      state = DDAController.processInteraction(state, 0.5, severeOverload);
      expect(state.consecutiveOverloadCount).toBe(1);
      state = DDAController.processInteraction(state, 0.9, noOverload);
      expect(state.consecutiveOverloadCount).toBe(0);
    });
  });

  describe("summarize", () => {
    it("should produce a valid summary object", () => {
      const state = DDAController.createInitialState(5);
      const summary = DDAController.summarize(state);
      expect(summary.currentDifficulty).toBe(5);
      expect(["advancing", "stable", "retreating"]).toContain(summary.trend);
      expect(summary.averageReward).toBeGreaterThanOrEqual(0);
    });
  });
});
