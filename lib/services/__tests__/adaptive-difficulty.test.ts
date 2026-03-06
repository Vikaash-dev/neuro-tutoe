import { describe, it, expect } from "vitest";
import { AdaptiveDifficultyEngine, PerformanceMetrics } from "../adaptive-difficulty";

describe("AdaptiveDifficultyEngine", () => {
  describe("calculatePerformanceScore", () => {
    it("should calculate performance score correctly", () => {
      const metrics: PerformanceMetrics = {
        correctAnswers: 8,
        totalAttempts: 10,
        averageTimePerQuestion: 30,
        confidenceScore: 4,
        masteryLevel: "proficient",
      };

      const score = AdaptiveDifficultyEngine.calculatePerformanceScore(metrics);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should give higher scores for better performance", () => {
      const lowPerformance: PerformanceMetrics = {
        correctAnswers: 3,
        totalAttempts: 10,
        averageTimePerQuestion: 120,
        confidenceScore: 1,
        masteryLevel: "novice",
      };

      const highPerformance: PerformanceMetrics = {
        correctAnswers: 9,
        totalAttempts: 10,
        averageTimePerQuestion: 20,
        confidenceScore: 5,
        masteryLevel: "expert",
      };

      const lowScore = AdaptiveDifficultyEngine.calculatePerformanceScore(lowPerformance);
      const highScore = AdaptiveDifficultyEngine.calculatePerformanceScore(highPerformance);

      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe("determineDifficulty", () => {
    it("should recommend easy level for low performance", () => {
      const result = AdaptiveDifficultyEngine.determineDifficulty(35);
      expect(result.recommendedDifficulty).toBe("easy");
    });

    it("should recommend medium level for moderate performance", () => {
      const result = AdaptiveDifficultyEngine.determineDifficulty(50);
      expect(result.recommendedDifficulty).toBe("medium");
    });

    it("should recommend hard level for good performance", () => {
      const result = AdaptiveDifficultyEngine.determineDifficulty(70);
      expect(result.recommendedDifficulty).toBe("hard");
    });

    it("should recommend expert level for excellent performance", () => {
      const result = AdaptiveDifficultyEngine.determineDifficulty(92);
      expect(result.recommendedDifficulty).toBe("expert");
    });
  });

  describe("checkPrerequisiteMastery", () => {
    it("should return all prerequisites met", () => {
      const prerequisites = ["algebra", "geometry"];
      const masteryLevels = { algebra: 85, geometry: 90 };

      const result = AdaptiveDifficultyEngine.checkPrerequisiteMastery(
        prerequisites,
        masteryLevels
      );

      expect(result.allMet).toBe(true);
      expect(result.gaps).toHaveLength(0);
    });

    it("should identify missing prerequisites", () => {
      const prerequisites = ["algebra", "geometry"];
      const masteryLevels = { algebra: 50, geometry: 90 };

      const result = AdaptiveDifficultyEngine.checkPrerequisiteMastery(
        prerequisites,
        masteryLevels
      );

      expect(result.allMet).toBe(false);
      expect(result.gaps).toContain("algebra");
    });
  });

  describe("personalizeExplanationDepth", () => {
    it("should provide surface level for beginners with low performance", () => {
      const result = AdaptiveDifficultyEngine.personalizeExplanationDepth(
        "beginner",
        "novice",
        45
      );

      expect(result.depth).toBe("surface");
      expect(result.includeExamples).toBe(true);
      expect(result.includeAdvancedConcepts).toBe(false);
    });

    it("should provide deep level for advanced learners with high performance", () => {
      const result = AdaptiveDifficultyEngine.personalizeExplanationDepth(
        "advanced",
        "expert",
        92
      );

      expect(result.depth).toBe("deep");
      expect(result.includeAdvancedConcepts).toBe(true);
    });
  });

  describe("recommendNextAction", () => {
    it("should recommend break after 90 minutes", () => {
      const result = AdaptiveDifficultyEngine.recommendNextAction(75, "proficient", 5500);
      expect(result.action).toBe("break");
    });

    it("should recommend review for low performance", () => {
      const result = AdaptiveDifficultyEngine.recommendNextAction(40, "novice", 1800);
      expect(result.action).toBe("review");
    });

    it("should recommend advance for expert performance", () => {
      const result = AdaptiveDifficultyEngine.recommendNextAction(88, "expert", 1800);
      expect(result.action).toBe("advance");
    });

    it("should recommend continue for moderate performance", () => {
      const result = AdaptiveDifficultyEngine.recommendNextAction(65, "intermediate", 1800);
      expect(result.action).toBe("continue");
    });
  });

  describe("generateLearningPath", () => {
    it("should include missing prerequisites in path", () => {
      const result = AdaptiveDifficultyEngine.generateLearningPath(
        "calculus",
        ["algebra", "geometry"],
        { algebra: 50, geometry: 85 },
        []
      );

      expect(result.path).toContain("algebra");
      expect(result.path).toContain("calculus");
    });

    it("should skip already completed concepts", () => {
      const result = AdaptiveDifficultyEngine.generateLearningPath(
        "calculus",
        ["algebra", "geometry"],
        { algebra: 85, geometry: 85 },
        ["algebra", "geometry"]
      );

      expect(result.path).toContain("calculus");
      expect(result.path.filter((p) => p === "algebra" || p === "geometry")).toHaveLength(0);
    });

    it("should estimate reasonable time", () => {
      const result = AdaptiveDifficultyEngine.generateLearningPath(
        "calculus",
        ["algebra"],
        { algebra: 50 },
        []
      );

      expect(result.estimatedTime).toBeGreaterThan(0);
    });
  });
});
