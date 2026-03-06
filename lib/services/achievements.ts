/**
 * Achievements & Gamification System
 * Badges, milestones, and reward tracking for NeuroTutor AI
 */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "milestone" | "streak" | "mastery" | "challenge" | "social";
  requirement: number;
  unlockedAt?: Date;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export interface UserAchievements {
  totalPoints: number;
  unlockedAchievements: string[];
  currentStreak: number;
  longestStreak: number;
  level: number;
  nextLevelProgress: number;
}

export const ACHIEVEMENTS_CATALOG: Record<string, Achievement> = {
  // Milestone Achievements
  "first-concept": {
    id: "first-concept",
    title: "First Steps",
    description: "Master your first concept",
    icon: "school",
    category: "milestone",
    requirement: 1,
    rarity: "common",
  },
  "five-concepts": {
    id: "five-concepts",
    title: "Knowledge Seeker",
    description: "Master 5 concepts",
    icon: "library-books",
    category: "milestone",
    requirement: 5,
    rarity: "rare",
  },
  "ten-concepts": {
    id: "ten-concepts",
    title: "Scholar",
    description: "Master 10 concepts",
    icon: "emoji-events",
    category: "milestone",
    requirement: 10,
    rarity: "epic",
  },
  "twenty-concepts": {
    id: "twenty-concepts",
    title: "Polymath",
    description: "Master 20 concepts",
    icon: "psychology",
    category: "milestone",
    requirement: 20,
    rarity: "legendary",
  },

  // Streak Achievements
  "three-day-streak": {
    id: "three-day-streak",
    title: "On Fire",
    description: "Maintain a 3-day learning streak",
    icon: "local-fire-department",
    category: "streak",
    requirement: 3,
    rarity: "common",
  },
  "seven-day-streak": {
    id: "seven-day-streak",
    title: "Week Warrior",
    description: "Maintain a 7-day learning streak",
    icon: "trending-up",
    category: "streak",
    requirement: 7,
    rarity: "rare",
  },
  "thirty-day-streak": {
    id: "thirty-day-streak",
    title: "Unstoppable",
    description: "Maintain a 30-day learning streak",
    icon: "military-tech",
    category: "streak",
    requirement: 30,
    rarity: "legendary",
  },

  // Mastery Achievements
  "first-expert": {
    id: "first-expert",
    title: "Expert",
    description: "Reach expert level in a concept",
    icon: "grade",
    category: "mastery",
    requirement: 1,
    rarity: "rare",
  },
  "five-experts": {
    id: "five-experts",
    title: "Master of Many",
    description: "Reach expert level in 5 concepts",
    icon: "verified",
    category: "mastery",
    requirement: 5,
    rarity: "epic",
  },

  // Challenge Achievements
  "perfect-quiz": {
    id: "perfect-quiz",
    title: "Perfect Score",
    description: "Score 100% on a quiz",
    icon: "check-circle",
    category: "challenge",
    requirement: 1,
    rarity: "rare",
  },
  "speed-learner": {
    id: "speed-learner",
    title: "Speed Learner",
    description: "Complete a concept in under 30 minutes",
    icon: "flash-on",
    category: "challenge",
    requirement: 1,
    rarity: "rare",
  },
  "teach-back-master": {
    id: "teach-back-master",
    title: "Great Explainer",
    description: "Get 90%+ accuracy on 5 teach-back sessions",
    icon: "record-voice-over",
    category: "challenge",
    requirement: 5,
    rarity: "epic",
  },

  // Engagement Achievements
  "early-bird": {
    id: "early-bird",
    title: "Early Bird",
    description: "Complete a learning session before 8 AM",
    icon: "wb-sunny",
    category: "social",
    requirement: 1,
    rarity: "common",
  },
  "night-owl": {
    id: "night-owl",
    title: "Night Owl",
    description: "Complete a learning session after 10 PM",
    icon: "nights-stay",
    category: "social",
    requirement: 1,
    rarity: "common",
  },
};

export class AchievementsService {
  /**
   * Check if achievement should be unlocked
   */
  static checkAchievementUnlock(
    achievementId: string,
    userStats: {
      masteredConcepts: number;
      currentStreak: number;
      quizAttempts: number;
      perfectScores: number;
      teachBackAccuracy: number;
    }
  ): boolean {
    const achievement = ACHIEVEMENTS_CATALOG[achievementId];
    if (!achievement) return false;

    switch (achievement.category) {
      case "milestone":
        return userStats.masteredConcepts >= achievement.requirement;
      case "streak":
        return userStats.currentStreak >= achievement.requirement;
      case "mastery":
        // Simplified check - would need more detailed data
        return userStats.masteredConcepts >= achievement.requirement;
      case "challenge":
        return userStats.perfectScores >= achievement.requirement;
      default:
        return false;
    }
  }

  /**
   * Calculate user level based on points
   */
  static calculateLevel(totalPoints: number): number {
    // Level progression: 100 points per level
    return Math.floor(totalPoints / 100) + 1;
  }

  /**
   * Get points for an achievement based on rarity
   */
  static getAchievementPoints(rarity: "common" | "rare" | "epic" | "legendary"): number {
    const pointsMap = {
      common: 10,
      rare: 25,
      epic: 50,
      legendary: 100,
    };
    return pointsMap[rarity];
  }

  /**
   * Generate achievement notification
   */
  static generateNotification(achievement: Achievement): {
    title: string;
    message: string;
    points: number;
  } {
    const points = this.getAchievementPoints(achievement.rarity);
    return {
      title: `🎉 Achievement Unlocked!`,
      message: `${achievement.title} - ${achievement.description}`,
      points,
    };
  }

  /**
   * Get all unlocked achievements with details
   */
  static getUnlockedAchievements(unlockedIds: string[]): Achievement[] {
    return unlockedIds
      .map((id) => ACHIEVEMENTS_CATALOG[id])
      .filter((a) => a !== undefined);
  }

  /**
   * Get next achievable milestones
   */
  static getNextMilestones(
    unlockedIds: string[],
    masteredConcepts: number
  ): { achievement: Achievement; progress: number }[] {
    const milestones = Object.values(ACHIEVEMENTS_CATALOG).filter(
      (a) => a.category === "milestone" && !unlockedIds.includes(a.id)
    );

    return milestones
      .map((milestone) => ({
        achievement: milestone,
        progress: Math.min((masteredConcepts / milestone.requirement) * 100, 100),
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3); // Top 3 next milestones
  }

  /**
   * Calculate total points from achievements
   */
  static calculateTotalPoints(unlockedIds: string[]): number {
    return unlockedIds.reduce((total, id) => {
      const achievement = ACHIEVEMENTS_CATALOG[id];
      return total + (achievement ? this.getAchievementPoints(achievement.rarity) : 0);
    }, 0);
  }

  /**
   * Get achievement statistics
   */
  static getAchievementStats(unlockedIds: string[]): {
    totalUnlocked: number;
    byRarity: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const achievements = this.getUnlockedAchievements(unlockedIds);

    const byRarity = {
      common: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };

    const byCategory = {
      milestone: 0,
      streak: 0,
      mastery: 0,
      challenge: 0,
      social: 0,
    };

    achievements.forEach((a) => {
      byRarity[a.rarity]++;
      byCategory[a.category]++;
    });

    return {
      totalUnlocked: achievements.length,
      byRarity,
      byCategory,
    };
  }
}
