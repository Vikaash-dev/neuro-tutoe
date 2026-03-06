/**
 * Adaptive Difficulty Engine
 * Dynamically adjusts quiz difficulty based on student performance
 * Implements Theory of Mind for personalized learning paths
 */

export interface PerformanceMetrics {
  correctAnswers: number;
  totalAttempts: number;
  averageTimePerQuestion: number;
  confidenceScore: number; // 1-5
  masteryLevel: "novice" | "intermediate" | "proficient" | "expert";
}

export interface DifficultyAdjustment {
  currentDifficulty: "easy" | "medium" | "hard" | "expert";
  recommendedDifficulty: "easy" | "medium" | "hard" | "expert";
  adjustmentReason: string;
  confidenceThreshold: number;
}

export class AdaptiveDifficultyEngine {
  /**
   * Calculate performance score (0-100)
   */
  static calculatePerformanceScore(metrics: PerformanceMetrics): number {
    const accuracyScore = (metrics.correctAnswers / metrics.totalAttempts) * 100;
    const confidenceScore = (metrics.confidenceScore / 5) * 100;
    const speedBonus = Math.min(metrics.averageTimePerQuestion / 60, 1) * 20; // Bonus for speed

    // Weighted average: 60% accuracy, 30% confidence, 10% speed
    return accuracyScore * 0.6 + confidenceScore * 0.3 + speedBonus * 0.1;
  }

  /**
   * Determine optimal difficulty level based on performance
   */
  static determineDifficulty(performanceScore: number): DifficultyAdjustment {
    if (performanceScore < 40) {
      return {
        currentDifficulty: "easy",
        recommendedDifficulty: "easy",
        adjustmentReason: "Performance is below 40%. Staying at easy level to build confidence.",
        confidenceThreshold: 0.3,
      };
    }

    if (performanceScore < 60) {
      return {
        currentDifficulty: "easy",
        recommendedDifficulty: "medium",
        adjustmentReason:
          "Performance improved to 40-60%. Ready to progress to medium difficulty.",
        confidenceThreshold: 0.5,
      };
    }

    if (performanceScore < 75) {
      return {
        currentDifficulty: "medium",
        recommendedDifficulty: "hard",
        adjustmentReason: "Performance is 60-75%. Challenge yourself with harder questions.",
        confidenceThreshold: 0.65,
      };
    }

    if (performanceScore < 90) {
      return {
        currentDifficulty: "hard",
        recommendedDifficulty: "expert",
        adjustmentReason: "Excellent performance (75-90%). Time for expert-level challenges.",
        confidenceThreshold: 0.8,
      };
    }

    return {
      currentDifficulty: "expert",
      recommendedDifficulty: "expert",
      adjustmentReason: "Outstanding performance (90+%). Mastering this concept!",
      confidenceThreshold: 0.9,
    };
  }

  /**
   * Generate adaptive quiz questions based on difficulty and learning style
   */
  static generateAdaptiveQuestion(
    difficulty: "easy" | "medium" | "hard" | "expert",
    learningStyle: "visual" | "verbal" | "kinesthetic" | "reading_writing",
    conceptId: string
  ): { type: string; complexity: number } {
    const complexityMap = {
      easy: 1,
      medium: 2,
      hard: 3,
      expert: 4,
    };

    const questionTypeMap = {
      visual: "diagram",
      verbal: "explanation",
      kinesthetic: "application",
      reading_writing: "essay",
    };

    return {
      type: questionTypeMap[learningStyle],
      complexity: complexityMap[difficulty],
    };
  }

  /**
   * Calculate prerequisite mastery requirement
   */
  static checkPrerequisiteMastery(
    prerequisites: string[],
    masteryLevels: Record<string, number>
  ): { allMet: boolean; gaps: string[] } {
    const gaps: string[] = [];

    prerequisites.forEach((prereq) => {
      const masteryLevel = masteryLevels[prereq] || 0;
      // Require 70% mastery for prerequisites
      if (masteryLevel < 70) {
        gaps.push(prereq);
      }
    });

    return {
      allMet: gaps.length === 0,
      gaps,
    };
  }

  /**
   * Personalize explanation depth based on learning profile
   */
  static personalizeExplanationDepth(
    depthLevel: "beginner" | "intermediate" | "advanced",
    masteryLevel: "novice" | "intermediate" | "proficient" | "expert",
    performanceScore: number
  ): {
    depth: "surface" | "moderate" | "deep";
    includeExamples: boolean;
    includeVisualizations: boolean;
    includeAdvancedConcepts: boolean;
  } {
    // Combine user preference with performance
    const adjustedDepth = performanceScore > 75 ? "deep" : "moderate";

    if (depthLevel === "beginner" && performanceScore < 60) {
      return {
        depth: "surface",
        includeExamples: true,
        includeVisualizations: true,
        includeAdvancedConcepts: false,
      };
    }

    if (depthLevel === "intermediate" || (depthLevel === "beginner" && performanceScore > 70)) {
      return {
        depth: "moderate",
        includeExamples: true,
        includeVisualizations: true,
        includeAdvancedConcepts: false,
      };
    }

    return {
      depth: "deep",
      includeExamples: true,
      includeVisualizations: true,
      includeAdvancedConcepts: true,
    };
  }

  /**
   * Recommend next learning action based on performance
   */
  static recommendNextAction(
    performanceScore: number,
    masteryLevel: "novice" | "intermediate" | "proficient" | "expert",
    timeSpentToday: number
  ): {
    action: "continue" | "review" | "break" | "advance";
    message: string;
  } {
    // Recommend breaks after 90+ minutes
    if (timeSpentToday > 5400) {
      return {
        action: "break",
        message: "You've been studying for over 90 minutes. Take a break to consolidate learning!",
      };
    }

    // If performance is low, recommend review
    if (performanceScore < 50) {
      return {
        action: "review",
        message: "Let's review the concept again. Understanding fundamentals is key.",
      };
    }

    // If mastered, recommend advancing
    if (masteryLevel === "expert" && performanceScore > 85) {
      return {
        action: "advance",
        message: "Excellent! You've mastered this concept. Ready for the next challenge?",
      };
    }

    // Default: continue with current difficulty
    return {
      action: "continue",
      message: "Keep going! You're making great progress.",
    };
  }

  /**
   * Calculate learning path based on prerequisites and mastery
   */
  static generateLearningPath(
    targetConcept: string,
    prerequisites: string[],
    masteryLevels: Record<string, number>,
    completedConcepts: string[]
  ): {
    path: string[];
    estimatedTime: number;
    difficulty: string;
  } {
    const path: string[] = [];
    let estimatedTime = 0;

    // Add missing prerequisites
    prerequisites.forEach((prereq) => {
      if (!completedConcepts.includes(prereq) && masteryLevels[prereq] < 70) {
        path.push(prereq);
        estimatedTime += 45; // Estimate 45 min per concept
      }
    });

    // Add target concept
    path.push(targetConcept);
    estimatedTime += 60; // Estimate 60 min for target

    // Add related advanced concepts
    const advancedConcepts = ["application-1", "extension-1"];
    advancedConcepts.forEach((concept) => {
      if (!completedConcepts.includes(concept)) {
        path.push(concept);
        estimatedTime += 30;
      }
    });

    return {
      path,
      estimatedTime,
      difficulty: "adaptive",
    };
  }
}
