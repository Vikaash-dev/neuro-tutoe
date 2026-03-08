/**
 * Learning Engine Service
 * Core logic for Feynman Technique, spaced repetition, active recall, and memory management
 * Based on DeepTutor architecture enhanced with neuroscience principles
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Concept,
  ConceptMemoryState,
  FeynmanSession,
  LearningSession,
  MasteryLevel,
  MemoryType,
  SpacedRepetitionSchedule,
  StudentMentalModel,
  QuizAttempt,
} from "@/lib/types/learning";

const STORAGE_KEYS = {
  CONCEPTS: "learning:concepts",
  MEMORY_STATES: "learning:memory_states",
  SESSIONS: "learning:sessions",
  SPACED_REPETITION: "learning:spaced_repetition",
  MENTAL_MODEL: "learning:mental_model",
};

/**
 * Learning Engine Service
 * Manages all learning-related operations including memory, spaced repetition, and Feynman technique
 */
export class LearningEngineService {
  /**
   * Initialize a new learning session for a concept
   */
  static async initializeSession(
    userId: string,
    conceptId: string,
    concept: Concept
  ): Promise<LearningSession> {
    const session: LearningSession = {
      id: `session_${Date.now()}`,
      userId,
      conceptId,
      startTime: Date.now(),
      interactions: [],
      initialMastery: await this.getMasteryLevel(conceptId),
      finalMastery: "novice",
      conceptsLearned: [conceptId],
      sessionNotes: "",
    };

    return session;
  }

  /**
   * Get current mastery level for a concept
   */
  static async getMasteryLevel(conceptId: string): Promise<MasteryLevel> {
    const memoryState = await this.getMemoryState(conceptId);
    return memoryState?.masteryLevel || "novice";
  }

  /**
   * Get memory state for a concept
   */
  static async getMemoryState(conceptId: string): Promise<ConceptMemoryState | null> {
    const states = await AsyncStorage.getItem(STORAGE_KEYS.MEMORY_STATES);
    if (!states) return null;

    const statesMap = JSON.parse(states) as Record<string, ConceptMemoryState>;
    return statesMap[conceptId] || null;
  }

  /**
   * Update memory state (STM to LTM consolidation)
   */
  static async updateMemoryState(
    conceptId: string,
    updates: Partial<ConceptMemoryState>
  ): Promise<ConceptMemoryState> {
    const states = await AsyncStorage.getItem(STORAGE_KEYS.MEMORY_STATES);
    const statesMap = JSON.parse(states || "{}") as Record<string, ConceptMemoryState>;

    const current = statesMap[conceptId] || {
      conceptId,
      memoryType: "short_term" as MemoryType,
      masteryLevel: "novice" as MasteryLevel,
      retentionScore: 0,
      lastReviewDate: Date.now(),
      nextReviewDate: Date.now() + 86400000, // 1 day
      reviewCount: 0,
      correctAnswers: 0,
      totalAttempts: 0,
      sessionLearned: Date.now(),
      consolidationProgress: 0,
    };

    const updated = { ...current, ...updates };
    statesMap[conceptId] = updated;

    await AsyncStorage.setItem(STORAGE_KEYS.MEMORY_STATES, JSON.stringify(statesMap));
    return updated;
  }

  /**
   * Calculate consolidation progress from STM to LTM
   * Based on spaced repetition performance and retention
   */
  static calculateConsolidationProgress(
    reviewCount: number,
    correctAnswers: number,
    totalAttempts: number,
    daysSinceFirstReview: number
  ): number {
    // Factors: review frequency, accuracy, time elapsed
    const accuracyScore = totalAttempts > 0 ? (correctAnswers / totalAttempts) * 100 : 0;
    const reviewScore = Math.min(reviewCount * 20, 100); // 5 reviews = 100%
    const timeScore = Math.min((daysSinceFirstReview / 21) * 100, 100); // 21 days = 100%

    // Weighted average: accuracy (40%), reviews (35%), time (25%)
    return accuracyScore * 0.4 + reviewScore * 0.35 + timeScore * 0.25;
  }

  /**
   * Determine if concept should move from STM to LTM
   */
  static shouldConsolidateToLTM(memoryState: ConceptMemoryState): boolean {
    // Criteria: 70%+ consolidation progress, 3+ reviews, 80%+ accuracy
    const consolidationReady = memoryState.consolidationProgress >= 70;
    const reviewsComplete = memoryState.reviewCount >= 3;
    const accuracyHigh =
      memoryState.totalAttempts > 0 &&
      (memoryState.correctAnswers / memoryState.totalAttempts) * 100 >= 80;

    return consolidationReady && reviewsComplete && accuracyHigh;
  }

  /**
   * Update mastery level based on performance
   */
  static updateMasteryLevel(
    currentMastery: MasteryLevel,
    quizScore: number,
    reviewCount: number
  ): MasteryLevel {
    // Progression: novice → intermediate → proficient → expert
    if (currentMastery === "novice" && quizScore >= 70 && reviewCount >= 1) {
      return "intermediate";
    }
    if (currentMastery === "intermediate" && quizScore >= 80 && reviewCount >= 2) {
      return "proficient";
    }
    if (currentMastery === "proficient" && quizScore >= 90 && reviewCount >= 3) {
      return "expert";
    }
    return currentMastery;
  }

  /**
   * Get spaced repetition schedule for a concept
   * Uses SM-2 algorithm for optimal review intervals
   */
  static async getSpacedRepetitionSchedule(
    conceptId: string
  ): Promise<SpacedRepetitionSchedule> {
    const schedules = await AsyncStorage.getItem(STORAGE_KEYS.SPACED_REPETITION);
    const schedulesMap = JSON.parse(schedules || "{}") as Record<
      string,
      SpacedRepetitionSchedule
    >;

    return (
      schedulesMap[conceptId] || {
        conceptId,
        reviewIntervals: [86400000, 259200000, 604800000, 1814400000], // 1, 3, 7, 21 days in ms
        currentInterval: 0,
        nextReviewDate: Date.now() + 86400000,
        quality: 0,
        easeFactor: 2.5,
      }
    );
  }

  /**
   * Update spaced repetition schedule based on quiz performance (SM-2 algorithm)
   */
  static async updateSpacedRepetitionSchedule(
    conceptId: string,
    quality: number // 0-5, where 5 is perfect
  ): Promise<SpacedRepetitionSchedule> {
    const schedule = await this.getSpacedRepetitionSchedule(conceptId);

    // SM-2 algorithm — currentInterval stores actual day count, not an array index.
    // Standard SM-2 schedule: 1 day → 6 days → interval × ease_factor (Wozniak, 1987).
    const DAY_MS = 86400000;
    if (quality < 3) {
      // Failed — reset to 0 days (review again in 1 day)
      schedule.currentInterval = 0;
      schedule.easeFactor = Math.max(1.3, schedule.easeFactor - 0.2);
    } else {
      // Passed
      if (schedule.currentInterval === 0) {
        schedule.currentInterval = 1; // first successful review → 1 day
      } else if (schedule.currentInterval === 1) {
        schedule.currentInterval = 6; // second review → 6 days (SM-2 standard)
      } else {
        schedule.currentInterval = Math.round(
          schedule.currentInterval * schedule.easeFactor
        );
      }
      // Ease factor update: better performance = easier future recalls
      schedule.easeFactor = Math.max(1.3, schedule.easeFactor + 0.1 - (5 - quality) * 0.08);
    }

    // Compute next review date directly from day count (no array-index confusion)
    const intervalDays = schedule.currentInterval === 0 ? 1 : schedule.currentInterval;
    schedule.nextReviewDate = Date.now() + intervalDays * DAY_MS;
    schedule.quality = quality;

    // Save updated schedule
    const schedules = await AsyncStorage.getItem(STORAGE_KEYS.SPACED_REPETITION);
    const schedulesMap = JSON.parse(schedules || "{}") as Record<
      string,
      SpacedRepetitionSchedule
    >;
    schedulesMap[conceptId] = schedule;
    await AsyncStorage.setItem(STORAGE_KEYS.SPACED_REPETITION, JSON.stringify(schedulesMap));

    return schedule;
  }

  /**
   * Get concepts ready for spaced repetition review
   */
  static async getConceptsReadyForReview(): Promise<ConceptMemoryState[]> {
    const states = await AsyncStorage.getItem(STORAGE_KEYS.MEMORY_STATES);
    if (!states) return [];

    const statesMap = JSON.parse(states) as Record<string, ConceptMemoryState>;
    const now = Date.now();

    return Object.values(statesMap).filter((state) => state.nextReviewDate <= now);
  }

  /**
   * Get all concepts in a specific memory type (STM or LTM)
   */
  static async getConceptsInMemory(memoryType: MemoryType): Promise<ConceptMemoryState[]> {
    const states = await AsyncStorage.getItem(STORAGE_KEYS.MEMORY_STATES);
    if (!states) return [];

    const statesMap = JSON.parse(states) as Record<string, ConceptMemoryState>;
    return Object.values(statesMap).filter((state) => state.memoryType === memoryType);
  }

  /**
   * Feynman Technique: Analyze student's simple explanation
   * Detects gaps, misconceptions, and areas for refinement
   */
  static analyzeFeynmanExplanation(
    studentExplanation: string,
    correctConcept: Concept,
    studentMentalModel: StudentMentalModel
  ): {
    accuracy: number;
    missingPoints: string[];
    misconceptions: string[];
    suggestions: string[];
  } {
    const explanationLower = studentExplanation.toLowerCase();

    // Check coverage of key points
    const coveredPoints = correctConcept.keyPoints.filter((kp) =>
      kp
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 4)
        .some((word) => explanationLower.includes(word))
    );
    const missingPoints = correctConcept.keyPoints.filter(
      (kp) => !coveredPoints.includes(kp)
    );

    // Check for known misconceptions mentioned without correction
    const misconceptions = correctConcept.commonMisconceptions.filter((m) =>
      m
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 4)
        .some((word) => explanationLower.includes(word))
    );

    // Accuracy: weighted by coverage and misconceptions
    const coverageRatio =
      correctConcept.keyPoints.length > 0
        ? coveredPoints.length / correctConcept.keyPoints.length
        : 1;
    const misconceptionPenalty = misconceptions.length * 0.1;
    const accuracy = Math.max(0, Math.round((coverageRatio - misconceptionPenalty) * 100));

    // Depth-adjusted suggestions based on student mental model
    const suggestions: string[] = [];
    if (missingPoints.length > 0) {
      suggestions.push(`Try to include: ${missingPoints.slice(0, 2).join("; ")}`);
    }
    if (studentMentalModel.explanationDepth === "simple" && accuracy < 60) {
      suggestions.push("Use a concrete everyday analogy to anchor the concept.");
    }
    if (studentMentalModel.explanationDepth === "detailed" && accuracy > 80) {
      suggestions.push("Good depth! Consider adding edge cases or formal definitions.");
    }
    if (explanationLower.length < 100) {
      suggestions.push("Your explanation is quite brief — try to expand with an example.");
    }

    return { accuracy, missingPoints, misconceptions, suggestions };
  }

  /**
   * Process quiz attempt and update memory state
   */
  static async processQuizAttempt(
    conceptId: string,
    attempt: QuizAttempt,
    currentMemoryState: ConceptMemoryState
  ): Promise<ConceptMemoryState> {
    const quality = attempt.isCorrect ? 5 : 2; // 5 = perfect, 2 = failed
    const newCorrectAnswers = currentMemoryState.correctAnswers + (attempt.isCorrect ? 1 : 0);
    const newTotalAttempts = currentMemoryState.totalAttempts + 1;
    const accuracy = (newCorrectAnswers / newTotalAttempts) * 100;

    // Update spaced repetition
    await this.updateSpacedRepetitionSchedule(conceptId, quality);

    // Calculate new consolidation progress
    const daysSinceFirstReview = Math.floor(
      (Date.now() - currentMemoryState.sessionLearned) / 86400000
    );
    const consolidationProgress = this.calculateConsolidationProgress(
      currentMemoryState.reviewCount + 1,
      newCorrectAnswers,
      newTotalAttempts,
      daysSinceFirstReview
    );

    // Update mastery level
    const newMastery = this.updateMasteryLevel(
      currentMemoryState.masteryLevel,
      accuracy,
      currentMemoryState.reviewCount + 1
    );

    // Determine if ready for LTM consolidation
    const updatedState = await this.updateMemoryState(conceptId, {
      retentionScore: Math.round(accuracy),
      lastReviewDate: Date.now(),
      reviewCount: currentMemoryState.reviewCount + 1,
      correctAnswers: newCorrectAnswers,
      totalAttempts: newTotalAttempts,
      consolidationProgress,
      masteryLevel: newMastery,
      memoryType: this.shouldConsolidateToLTM({
        ...currentMemoryState,
        consolidationProgress,
        masteryLevel: newMastery,
      })
        ? "long_term"
        : "short_term",
    });

    return updatedState;
  }

  /**
   * Get student's mental model (Theory of Mind)
   */
  static async getMentalModel(userId: string): Promise<StudentMentalModel> {
    const model = await AsyncStorage.getItem(STORAGE_KEYS.MENTAL_MODEL);
    return model
      ? JSON.parse(model)
      : {
          studentId: userId,
          learningStyle: "visual",
          communicationPreference: "encouraging",
          explanationDepth: "moderate",
          pacePreference: "moderate",
          knownConcepts: [],
          strugglingConcepts: [],
          preferredExamples: "mixed",
          motivationLevel: 75,
          confidenceLevel: 50,
          lastUpdated: Date.now(),
        };
  }

  /**
   * Update student's mental model based on interactions
   */
  static async updateMentalModel(
    userId: string,
    updates: Partial<StudentMentalModel>
  ): Promise<StudentMentalModel> {
    const current = await this.getMentalModel(userId);
    const updated = { ...current, ...updates, lastUpdated: Date.now() };
    await AsyncStorage.setItem(STORAGE_KEYS.MENTAL_MODEL, JSON.stringify(updated));
    return updated;
  }

  /**
   * Get recommended next topic based on knowledge graph and mental model
   */
  static async getRecommendedNextTopic(
    userId: string,
    allConcepts: Concept[]
  ): Promise<Concept | null> {
    const mentalModel = await this.getMentalModel(userId);
    const readyForReview = await this.getConceptsReadyForReview();

    // Priority 1: Concepts ready for spaced repetition review
    if (readyForReview.length > 0) {
      const conceptId = readyForReview[0].conceptId;
      return allConcepts.find((c) => c.id === conceptId) || null;
    }

    // Priority 2: Prerequisites for struggling concepts
    for (const conceptId of mentalModel.strugglingConcepts) {
      const concept = allConcepts.find((c) => c.id === conceptId);
      if (concept && concept.prerequisites.length > 0) {
        const unmetPrerequisite = concept.prerequisites.find(
          (p) => !mentalModel.knownConcepts.includes(p)
        );
        if (unmetPrerequisite) {
          return allConcepts.find((c) => c.id === unmetPrerequisite) || null;
        }
      }
    }

    // Priority 3: New concept with met prerequisites
    for (const concept of allConcepts) {
      if (
        !mentalModel.knownConcepts.includes(concept.id) &&
        concept.prerequisites.every((p) => mentalModel.knownConcepts.includes(p))
      ) {
        return concept;
      }
    }

    return null;
  }
}
