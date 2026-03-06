import { describe, it, expect } from "vitest";
import { AchievementsService, ACHIEVEMENTS_CATALOG } from "../achievements";

describe("AchievementsService", () => {
  describe("checkAchievementUnlock", () => {
    it("should unlock first-concept achievement", () => {
      const userStats = {
        masteredConcepts: 1,
        currentStreak: 0,
        quizAttempts: 1,
        perfectScores: 0,
        teachBackAccuracy: 0,
      };

      const result = AchievementsService.checkAchievementUnlock("first-concept", userStats);
      expect(result).toBe(true);
    });

    it("should not unlock achievement without meeting requirement", () => {
      const userStats = {
        masteredConcepts: 0,
        currentStreak: 0,
        quizAttempts: 0,
        perfectScores: 0,
        teachBackAccuracy: 0,
      };

      const result = AchievementsService.checkAchievementUnlock("first-concept", userStats);
      expect(result).toBe(false);
    });

    it("should unlock streak achievements", () => {
      const userStats = {
        masteredConcepts: 0,
        currentStreak: 7,
        quizAttempts: 0,
        perfectScores: 0,
        teachBackAccuracy: 0,
      };

      const result = AchievementsService.checkAchievementUnlock("seven-day-streak", userStats);
      expect(result).toBe(true);
    });
  });

  describe("calculateLevel", () => {
    it("should calculate level 1 for 0 points", () => {
      const level = AchievementsService.calculateLevel(0);
      expect(level).toBe(1);
    });

    it("should calculate level 2 for 100 points", () => {
      const level = AchievementsService.calculateLevel(100);
      expect(level).toBe(2);
    });

    it("should calculate level 5 for 400 points", () => {
      const level = AchievementsService.calculateLevel(400);
      expect(level).toBe(5);
    });
  });

  describe("getAchievementPoints", () => {
    it("should return correct points for common rarity", () => {
      const points = AchievementsService.getAchievementPoints("common");
      expect(points).toBe(10);
    });

    it("should return correct points for rare rarity", () => {
      const points = AchievementsService.getAchievementPoints("rare");
      expect(points).toBe(25);
    });

    it("should return correct points for epic rarity", () => {
      const points = AchievementsService.getAchievementPoints("epic");
      expect(points).toBe(50);
    });

    it("should return correct points for legendary rarity", () => {
      const points = AchievementsService.getAchievementPoints("legendary");
      expect(points).toBe(100);
    });
  });

  describe("generateNotification", () => {
    it("should generate notification with correct structure", () => {
      const achievement = ACHIEVEMENTS_CATALOG["first-concept"];
      const notification = AchievementsService.generateNotification(achievement);

      expect(notification.title).toContain("Achievement Unlocked");
      expect(notification.message).toContain(achievement.title);
      expect(notification.points).toBeGreaterThan(0);
    });
  });

  describe("getUnlockedAchievements", () => {
    it("should return unlocked achievements", () => {
      const unlockedIds = ["first-concept", "three-day-streak"];
      const achievements = AchievementsService.getUnlockedAchievements(unlockedIds);

      expect(achievements).toHaveLength(2);
      expect(achievements[0].id).toBe("first-concept");
    });

    it("should filter out invalid IDs", () => {
      const unlockedIds = ["first-concept", "invalid-id"];
      const achievements = AchievementsService.getUnlockedAchievements(unlockedIds);

      expect(achievements).toHaveLength(1);
    });
  });

  describe("getNextMilestones", () => {
    it("should return next achievable milestones", () => {
      const unlockedIds = ["first-concept"];
      const milestones = AchievementsService.getNextMilestones(unlockedIds, 3);

      expect(milestones.length).toBeGreaterThan(0);
      expect(milestones[0].progress).toBeGreaterThan(0);
    });

    it("should return top 3 milestones", () => {
      const unlockedIds: string[] = [];
      const milestones = AchievementsService.getNextMilestones(unlockedIds, 5);

      expect(milestones.length).toBeLessThanOrEqual(3);
    });
  });

  describe("calculateTotalPoints", () => {
    it("should calculate total points from achievements", () => {
      const unlockedIds = ["first-concept", "three-day-streak"];
      const totalPoints = AchievementsService.calculateTotalPoints(unlockedIds);

      expect(totalPoints).toBeGreaterThan(0);
    });

    it("should return 0 for empty achievements", () => {
      const totalPoints = AchievementsService.calculateTotalPoints([]);
      expect(totalPoints).toBe(0);
    });
  });

  describe("getAchievementStats", () => {
    it("should calculate achievement statistics", () => {
      const unlockedIds = ["first-concept", "three-day-streak", "perfect-quiz"];
      const stats = AchievementsService.getAchievementStats(unlockedIds);

      expect(stats.totalUnlocked).toBe(3);
      expect(stats.byRarity.common).toBeGreaterThanOrEqual(0);
      expect(stats.byCategory.milestone).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty achievements", () => {
      const stats = AchievementsService.getAchievementStats([]);

      expect(stats.totalUnlocked).toBe(0);
      expect(stats.byRarity.common).toBe(0);
    });
  });
});
