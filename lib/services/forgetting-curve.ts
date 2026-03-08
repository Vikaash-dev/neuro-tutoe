/**
 * Forgetting Curve & Cognitive Load Theory Service
 *
 * Two foundational cognitive science models for adaptive learning:
 *
 * 1. Ebbinghaus Forgetting Curve (1885)
 *    R(t) = e^(-t/S)  — exponential decay of memory retention
 *    Extended by Bahrick (1979) to power-law decay for long-term memory.
 *    Used here to predict when a concept will be forgotten and schedule
 *    pre-emptive reviews at the optimal moment.
 *
 * 2. Cognitive Load Theory (Sweller, 1988; arXiv:2303.09540)
 *    Total cognitive load = Intrinsic + Extraneous + Germane
 *    - Intrinsic: difficulty of the material itself
 *    - Extraneous: unnecessary complexity in presentation
 *    - Germane: effort spent building mental schemas (good load)
 *    Working memory capacity ≈ 4 ± 1 chunks (Miller's Law, 1956)
 *
 * Cross-reference:
 *  - "Personalized Learning Path Planning Based on Cognitive Load" arXiv:2303.09540
 *  - "Optimising Review Schedules for Long-Term Retention" Cepeda et al., 2006
 *  - "An Exponential Decay Model of Memory" Rubin & Wenzel, 1996
 */

// ============================================================================
// FORGETTING CURVE TYPES
// ============================================================================

export interface RetentionEstimate {
  conceptId: string;
  /** Estimated retention (0-1) at the current moment. */
  currentRetention: number;
  /** Stability S in days — time for retention to drop to 1/e ≈ 37%. */
  stabilityDays: number;
  /** Days elapsed since last review. */
  elapsedDays: number;
  /** Days until retention falls below `criticalThreshold`. */
  daysUntilForgotten: number;
  /** When to trigger the next review for optimal reinforcement. */
  optimalReviewDate: number;
  /** Whether urgent review is needed (retention < 0.5). */
  urgentReview: boolean;
}

export interface ForgettingCurveConfig {
  /** Retention threshold below which a review is considered critical (default 0.7). */
  criticalThreshold: number;
  /** Retention value at which to schedule the "ideal" next review (default 0.9). */
  optimalReviewThreshold: number;
  /** Use power-law decay for long-term memory (more accurate, slightly heavier). */
  usePowerLaw: boolean;
}

// ============================================================================
// COGNITIVE LOAD TYPES
// ============================================================================

export type CognitiveLoadLevel = "low" | "moderate" | "high" | "overload";

export interface CognitiveLoadEstimate {
  conceptId: string;
  /** Intrinsic load: inherent complexity of the material (0-10). */
  intrinsicLoad: number;
  /** Extraneous load: presentation complexity, distractors (0-10). */
  extraneousLoad: number;
  /** Germane load: schema-building effort (0-10) — desirable. */
  germaneLoad: number;
  /** Total cognitive load (0-30, but working memory caps around 15-20). */
  totalLoad: number;
  /** Qualitative classification. */
  level: CognitiveLoadLevel;
  /** Whether load exceeds estimated working memory capacity. */
  isOverloaded: boolean;
  /** Recommended action to reduce extraneous load. */
  recommendations: string[];
}

export interface WorkingMemoryState {
  /** Number of active chunks in working memory (4±1 limit). */
  activeChunks: number;
  /** Concepts currently being processed. */
  activeConcepts: string[];
  /** Whether capacity is near the limit. */
  nearCapacity: boolean;
  /** Estimated cognitive fatigue (0-1), increases during long sessions. */
  fatigue: number;
}

// ============================================================================
// FORGETTING CURVE ENGINE
// ============================================================================

/**
 * Computes retention estimates using the Ebbinghaus forgetting curve
 * and schedules optimal reviews.
 */
export class ForgettingCurveEngine {
  private config: ForgettingCurveConfig;

  constructor(config: Partial<ForgettingCurveConfig> = {}) {
    this.config = {
      criticalThreshold: 0.5,
      optimalReviewThreshold: 0.9,
      usePowerLaw: false,
      ...config,
    };
  }

  /**
   * Estimate current retention for a concept.
   *
   * Exponential model:  R(t) = e^(-t/S)
   * Power-law model:    R(t) = (1 + c*t)^(-b)  (Rubin & Wenzel, 1996)
   *
   * @param conceptId - Concept to estimate retention for.
   * @param lastReviewDate - Timestamp of last successful review.
   * @param stabilityDays - Memory stability (from FSRS or SM-2 schedule).
   */
  estimateRetention(
    conceptId: string,
    lastReviewDate: number,
    stabilityDays: number
  ): RetentionEstimate {
    const now = Date.now();
    const elapsedDays = (now - lastReviewDate) / 86400000;
    const S = Math.max(0.1, stabilityDays);

    const currentRetention = this.computeRetention(elapsedDays, S);

    // Days until retention falls below critical threshold
    const daysUntilForgotten = this.daysUntilThreshold(S, this.config.criticalThreshold);

    // Optimal review: when retention hits optimalReviewThreshold
    const optimalDays = this.daysUntilThreshold(S, this.config.optimalReviewThreshold);
    const optimalReviewDate = lastReviewDate + optimalDays * 86400000;

    return {
      conceptId,
      currentRetention,
      stabilityDays: S,
      elapsedDays,
      daysUntilForgotten: Math.max(0, daysUntilForgotten - elapsedDays),
      optimalReviewDate,
      urgentReview: currentRetention < this.config.criticalThreshold,
    };
  }

  /**
   * Compute retention at time `t` days with stability `S`.
   */
  computeRetention(elapsedDays: number, stabilityDays: number): number {
    if (stabilityDays <= 0) return 0;
    if (elapsedDays <= 0) return 1;

    if (this.config.usePowerLaw) {
      // Rubin & Wenzel (1996) power-law: R(t) = (1 + t)^(-0.5/S^0.5)
      const b = 0.5 / Math.sqrt(stabilityDays);
      return Math.pow(1 + elapsedDays, -b);
    }

    // Classic Ebbinghaus exponential: R(t) = e^(-t/S)
    return Math.exp(-elapsedDays / stabilityDays);
  }

  /**
   * Compute days elapsed until retention falls to `threshold`.
   */
  daysUntilThreshold(stabilityDays: number, threshold: number): number {
    if (this.config.usePowerLaw) {
      const b = 0.5 / Math.sqrt(stabilityDays);
      return Math.pow(threshold, -1 / b) - 1;
    }
    return -stabilityDays * Math.log(threshold);
  }

  /**
   * Prioritise a list of concepts for review based on urgency.
   * Returns concepts sorted by current retention (ascending — most forgotten first).
   *
   * @param concepts - Array of {conceptId, lastReviewDate, stabilityDays}.
   */
  prioritiseForReview(
    concepts: Array<{ conceptId: string; lastReviewDate: number; stabilityDays: number }>
  ): RetentionEstimate[] {
    return concepts
      .map(({ conceptId, lastReviewDate, stabilityDays }) =>
        this.estimateRetention(conceptId, lastReviewDate, stabilityDays)
      )
      .sort((a, b) => a.currentRetention - b.currentRetention);
  }

  /**
   * Compute the spacing factor multiplier for the nth review.
   * Based on the Cepeda et al. (2006) optimal spacing function:
   *   gap = lag * (0.2 + 0.08 * n)  where n = study count
   */
  optimalSpacingMultiplier(reviewCount: number): number {
    return 0.2 + 0.08 * Math.max(1, reviewCount);
  }
}

// ============================================================================
// COGNITIVE LOAD TRACKER
// ============================================================================

/**
 * Tracks and estimates cognitive load for each learning interaction.
 *
 * Based on Sweller's CLT (1988) with extensions for digital learning environments
 * and neuroscience-based attention modelling (arXiv:2303.09540).
 */
export class CognitiveLoadTracker {
  private sessionStartTime: number = Date.now();
  private interactionCount: number = 0;
  private workingMemory: WorkingMemoryState = {
    activeChunks: 0,
    activeConcepts: [],
    nearCapacity: false,
    fatigue: 0,
  };

  /**
   * Estimate cognitive load for presenting a given concept to a learner.
   *
   * @param conceptId - Concept being taught.
   * @param conceptComplexity - Inherent difficulty (1-10).
   * @param presentationClarity - How well-organised the material is (1-10, 10=clear).
   * @param priorKnowledge - How much prior knowledge the student has (0-1).
   */
  estimateLoad(
    conceptId: string,
    conceptComplexity: number,
    presentationClarity: number,
    priorKnowledge: number
  ): CognitiveLoadEstimate {
    // Intrinsic load: reduced by prior knowledge, set by complexity
    const intrinsicLoad = conceptComplexity * (1 - priorKnowledge * 0.6);

    // Extraneous load: inversely proportional to clarity
    const extraneousLoad = Math.max(0, 10 - presentationClarity) * 0.8;

    // Germane load: schema-building effort — positive, peaks at moderate difficulty
    const germaneLoad =
      intrinsicLoad > 8
        ? 2 // Overloaded — no schema-building
        : intrinsicLoad < 2
        ? 1 // Too easy — minimal schema-building
        : 5 * Math.sin((intrinsicLoad / 10) * Math.PI); // bell-curve peak around 5

    const totalLoad = intrinsicLoad + extraneousLoad + germaneLoad;

    // Cognitive load levels based on working memory limits (Miller, 1956)
    let level: CognitiveLoadLevel;
    if (totalLoad <= 8) level = "low";
    else if (totalLoad <= 13) level = "moderate";
    else if (totalLoad <= 17) level = "high";
    else level = "overload";

    const isOverloaded = totalLoad > 17;

    const recommendations: string[] = [];
    if (intrinsicLoad > 7) {
      recommendations.push("Break this concept into smaller sub-topics (chunk decomposition).");
    }
    if (extraneousLoad > 5) {
      recommendations.push("Simplify the presentation — remove unnecessary diagrams or text.");
    }
    if (isOverloaded) {
      recommendations.push("Take a short break before continuing (5-10 minutes recommended).");
      recommendations.push("Review prerequisite concepts before attempting this one.");
    }
    if (this.workingMemory.fatigue > 0.6) {
      recommendations.push("Session fatigue detected — learning efficiency is reduced.");
    }

    return {
      conceptId,
      intrinsicLoad: Math.round(intrinsicLoad * 10) / 10,
      extraneousLoad: Math.round(extraneousLoad * 10) / 10,
      germaneLoad: Math.round(germaneLoad * 10) / 10,
      totalLoad: Math.round(totalLoad * 10) / 10,
      level,
      isOverloaded,
      recommendations,
    };
  }

  /**
   * Update working memory state when the student starts working on a concept.
   *
   * @param conceptId - Concept being added to working memory.
   * @param chunks - Number of information chunks this concept introduces.
   */
  loadConcept(conceptId: string, chunks: number = 2): WorkingMemoryState {
    this.interactionCount++;

    if (!this.workingMemory.activeConcepts.includes(conceptId)) {
      this.workingMemory.activeConcepts.push(conceptId);
      this.workingMemory.activeChunks += chunks;
    }

    // Fatigue accumulates over time in session
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
    this.workingMemory.fatigue = Math.min(1, sessionMinutes / 90); // max fatigue at 90 min

    // Working memory cap: 4 ± 1 items (Cowan, 2001 update to Miller)
    this.workingMemory.nearCapacity = this.workingMemory.activeChunks >= 4;

    return { ...this.workingMemory };
  }

  /**
   * Mark a concept as consolidated (removed from active working memory).
   */
  consolidateConcept(conceptId: string, chunksFreed: number = 2): WorkingMemoryState {
    this.workingMemory.activeConcepts = this.workingMemory.activeConcepts.filter(
      (c) => c !== conceptId
    );
    this.workingMemory.activeChunks = Math.max(0, this.workingMemory.activeChunks - chunksFreed);
    this.workingMemory.nearCapacity = this.workingMemory.activeChunks >= 4;
    return { ...this.workingMemory };
  }

  /**
   * Reset working memory (e.g., after a break or session restart).
   */
  resetSession(): void {
    this.workingMemory = {
      activeChunks: 0,
      activeConcepts: [],
      nearCapacity: false,
      fatigue: 0,
    };
    this.sessionStartTime = Date.now();
    this.interactionCount = 0;
  }

  /** Get current working memory state. */
  getWorkingMemoryState(): WorkingMemoryState {
    return { ...this.workingMemory };
  }

  /**
   * Recommend optimal session length based on current fatigue and load.
   *
   * Based on Deci & Ryan self-determination theory + cognitive fatigue research.
   *
   * @returns Recommended minutes remaining in session before a break.
   */
  recommendedSessionMinutes(): number {
    const fatigue = this.workingMemory.fatigue;
    if (fatigue > 0.8) return 0; // Take a break now
    if (fatigue > 0.6) return 10;
    if (fatigue > 0.4) return 20;
    return 45 - this.interactionCount * 2; // Decrease with interactions
  }
}

// Singleton instances
export const forgettingCurveEngine = new ForgettingCurveEngine();
export const cognitiveLoadTracker = new CognitiveLoadTracker();
