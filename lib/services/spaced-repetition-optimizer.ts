/**
 * Spaced Repetition Optimizer
 *
 * Implements a layered, research-backed spaced repetition system:
 *
 *   1. Half-Life Regression (HLR) — Settles & Meeder 2016 (arXiv:1605.06065)
 *      The Duolingo model. Predicts personalised concept "half-life" from the
 *      student's correct/total review ratio and time elapsed.
 *      h = 2^(θ · x)   where x is the feature vector, θ are learned weights.
 *      Simplified to: h = base × correctFraction × log₂(totalReviews + 2)
 *
 *   2. SM-2+ (SuperMemo 2, Wozniak 1987) — with personalised ease-factor decay.
 *      interval[0] = 1 day
 *      interval[1] = 6 days
 *      interval[n] = interval[n-1] × easeFactor
 *      easeFactor updated: EF' = EF + (0.1 − (5−q)×(0.08 + (5−q)×0.02))
 *      where q = quality of recall (0-5 scale).
 *
 *   3. Ebbinghaus Forgetting Curve — Ebbinghaus (1885)
 *      R(t) = e^(−t / h)   where h = half-life, t = days since last review.
 *
 *   4. Wilson et al. (2019) 85%-Rule (Nature Human Behaviour)
 *      Optimal learning occurs at ~85% accuracy.
 *      Below 60% → too hard → remediate.
 *      Above 95% → too easy → advance.
 *      60%–95% → optimal challenge zone → stay.
 *
 *   5. Bloom (1984) Mastery Gate: advance only when p_mastered ≥ MASTERY_THRESHOLD.
 */

import {
  HLRState,
  OptimalChallengeZone,
  ReviewSchedule,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Wilson et al. (2019) optimal accuracy band */
export const OPTIMAL_ACCURACY_MIN = 0.60;
export const OPTIMAL_ACCURACY_MAX = 0.95;
export const MASTERY_THRESHOLD = 0.85; // Bloom (1984) mastery gate

/** SM-2 ease-factor bounds */
export const EF_MIN = 1.3;
export const EF_MAX = 2.5;
export const EF_DEFAULT = 2.5;

/** HLR base half-life in days (unlearned concept) */
export const HLR_BASE_HALF_LIFE = 1.0;
export const HLR_MAX_HALF_LIFE = 180; // 6 months ceiling

// ---------------------------------------------------------------------------
// Ebbinghaus Forgetting Curve
// ---------------------------------------------------------------------------

/**
 * EbbinghausForgettingCurve
 *
 * R(t) = e^(−t / h)   (natural decay model)
 * Returns retention fraction in [0, 1].
 */
export class EbbinghausForgettingCurve {
  /**
   * Calculate retention after `daysSinceReview` days given `halfLifeDays`.
   */
  static retention(halfLifeDays: number, daysSinceReview: number): number {
    if (halfLifeDays <= 0) return 0;
    return Math.exp(-daysSinceReview / halfLifeDays);
  }

  /**
   * Days until retention drops below `targetRetention` (default 0.90 = 90%).
   */
  static daysUntilForgotten(halfLifeDays: number, targetRetention = 0.90): number {
    if (halfLifeDays <= 0 || targetRetention <= 0 || targetRetention >= 1) return 0;
    return -halfLifeDays * Math.log(targetRetention);
  }
}

// ---------------------------------------------------------------------------
// Half-Life Regression (HLR)
// ---------------------------------------------------------------------------

/**
 * HLREngine
 *
 * Simplified HLR model adapted from Settles & Meeder (2016).
 * Predicts personalised half-life and next review time.
 *
 * Full model: h = 2^(θ · φ(x)) where φ is a feature vector per lexeme.
 * Our simplified model: h = base × (correctFraction²) × log₂(reviews + 2)
 * This preserves the key behaviour:
 *   - More correct reviews → exponentially longer half-life
 *   - More total reviews → longer half-life (spacing effect)
 *   - Never trained → h = HLR_BASE_HALF_LIFE (1 day)
 */
export class HLREngine {
  /**
   * Estimate the current half-life for a concept in days.
   */
  static estimateHalfLife(
    correctFraction: number,
    totalReviews: number
  ): number {
    if (totalReviews === 0) return HLR_BASE_HALF_LIFE;
    const h =
      HLR_BASE_HALF_LIFE *
      Math.max(0.01, correctFraction) ** 2 *
      Math.log2(totalReviews + 2);
    return Math.min(HLR_MAX_HALF_LIFE, Math.max(HLR_BASE_HALF_LIFE, h));
  }

  /**
   * Create an initial HLRState for a brand-new concept.
   */
  static initState(conceptId: string): HLRState {
    const now = Date.now();
    return {
      conceptId,
      halfLifeDays: HLR_BASE_HALF_LIFE,
      easeFactor: EF_DEFAULT,
      intervalDays: 1,
      consecutiveCorrect: 0,
      lastReviewAt: now,
      nextReviewAt: now + msPerDay(1),
      predictedRetention: 1.0,
      totalReviews: 0,
      correctFraction: 0,
    };
  }

  /**
   * Update HLRState after a review attempt.
   * @param state     Current HLR state for the concept.
   * @param correct   Whether the recall was correct.
   * @param qualityQ  SM-2 quality of recall (0–5).  Default 4 for correct, 2 for wrong.
   */
  static update(state: HLRState, correct: boolean, qualityQ?: number): HLRState {
    const q = qualityQ ?? (correct ? 4 : 2);
    const now = Date.now();
    const daysSinceLast = (now - state.lastReviewAt) / 86_400_000;

    // Update totals
    const totalReviews = state.totalReviews + 1;
    const correctCount = Math.round(state.correctFraction * state.totalReviews) + (correct ? 1 : 0);
    const correctFraction = correctCount / totalReviews;

    // SM-2+ ease-factor update
    const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
    const newEF = Math.min(EF_MAX, Math.max(EF_MIN, state.easeFactor + efDelta));

    // SM-2 interval
    let newInterval: number;
    if (!correct) {
      newInterval = 1; // reset on failure
    } else if (state.consecutiveCorrect === 0) {
      newInterval = 1;
    } else if (state.consecutiveCorrect === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(state.intervalDays * newEF);
    }

    // HLR half-life
    const newHalfLife = HLREngine.estimateHalfLife(correctFraction, totalReviews);

    // Predicted retention at next review
    const predictedRetention = EbbinghausForgettingCurve.retention(
      newHalfLife,
      newInterval
    );

    const consecutiveCorrect = correct ? state.consecutiveCorrect + 1 : 0;

    return {
      conceptId: state.conceptId,
      halfLifeDays: newHalfLife,
      easeFactor: newEF,
      intervalDays: newInterval,
      consecutiveCorrect,
      lastReviewAt: now,
      nextReviewAt: now + msPerDay(newInterval),
      predictedRetention,
      totalReviews,
      correctFraction,
    };
  }

  /**
   * Compute current (live) predicted retention for a state, accounting for
   * time elapsed since last update.
   */
  static currentRetention(state: HLRState): number {
    const daysSinceLast = (Date.now() - state.lastReviewAt) / 86_400_000;
    return EbbinghausForgettingCurve.retention(state.halfLifeDays, daysSinceLast);
  }
}

// ---------------------------------------------------------------------------
// SM-2+ Scheduler
// ---------------------------------------------------------------------------

/**
 * SM2Scheduler
 *
 * Wraps HLREngine to expose a review-scheduling interface:
 * - isDue(state): boolean
 * - getSchedule(state): ReviewSchedule
 * - applyForgetting(state): HLRState (Ebbinghaus decay)
 */
export class SM2Scheduler {
  /** True if the concept's next review time has passed. */
  static isDue(state: HLRState, nowMs?: number): boolean {
    return (nowMs ?? Date.now()) >= state.nextReviewAt;
  }

  /** True if review is more than 1 day overdue. */
  static isOverdue(state: HLRState, nowMs?: number): boolean {
    return (nowMs ?? Date.now()) >= state.nextReviewAt + msPerDay(1);
  }

  /** Build a ReviewSchedule summary for UI rendering. */
  static getSchedule(state: HLRState, nowMs?: number): ReviewSchedule {
    const now = nowMs ?? Date.now();
    const msUntil = state.nextReviewAt - now;
    let priority: ReviewSchedule["priority"];
    if (msUntil < 0) {
      priority = msUntil < -msPerDay(1) ? "overdue" : "due_today";
    } else if (msUntil < msPerDay(1)) {
      priority = "due_today";
    } else {
      priority = "upcoming";
    }

    return {
      conceptId: state.conceptId,
      dueAt: state.nextReviewAt,
      priority,
      predictedRetention: SM2Scheduler.currentRetention(state, now),
      intervalDays: state.intervalDays,
    };
  }

  /** Current predicted retention (taking live elapsed time into account). */
  static currentRetention(state: HLRState, nowMs?: number): number {
    const daysSinceLast = ((nowMs ?? Date.now()) - state.lastReviewAt) / 86_400_000;
    return EbbinghausForgettingCurve.retention(state.halfLifeDays, daysSinceLast);
  }

  /**
   * Apply time-based forgetting decay to the HLR state without recording a
   * new review attempt (e.g. during a session warm-up to update stale states).
   */
  static applyForgettingDecay(state: HLRState, nowMs?: number): HLRState {
    const now = nowMs ?? Date.now();
    const retention = SM2Scheduler.currentRetention(state, now);
    // Decay correctFraction proportionally to Ebbinghaus retention
    const decayedCorrectFraction = state.correctFraction * retention;
    const newHalfLife = HLREngine.estimateHalfLife(
      decayedCorrectFraction,
      state.totalReviews
    );
    return { ...state, correctFraction: decayedCorrectFraction, halfLifeDays: newHalfLife };
  }
}

// ---------------------------------------------------------------------------
// Optimal Challenge Zone (85%-Rule)
// ---------------------------------------------------------------------------

/**
 * ChallengeZoneEvaluator
 *
 * Implements Wilson et al. (2019) 85%-Rule.
 * Determines whether the student's current performance is in the
 * optimal challenge zone for neuroplasticity-driven learning.
 */
export class ChallengeZoneEvaluator {
  /**
   * Evaluate whether a concept is in the optimal challenge zone.
   * @param accuracyRate Recent accuracy (0-1), e.g. last 5 attempts.
   * @param pMastered    BKT/IKT posterior mastery probability.
   */
  static evaluate(accuracyRate: number, pMastered: number): OptimalChallengeZone {
    const inOptimalZone =
      accuracyRate >= OPTIMAL_ACCURACY_MIN && accuracyRate <= OPTIMAL_ACCURACY_MAX;

    let recommendation: OptimalChallengeZone["recommendation"];
    if (pMastered >= MASTERY_THRESHOLD) {
      recommendation = "advance";
    } else if (accuracyRate < OPTIMAL_ACCURACY_MIN) {
      recommendation = "remediate";
    } else if (accuracyRate > OPTIMAL_ACCURACY_MAX) {
      recommendation = "review"; // surface again as a harder variant
    } else {
      recommendation = "stay";
    }

    return { inOptimalZone, currentAccuracy: accuracyRate, recommendation };
  }

  /**
   * Compute the "difficulty target" that keeps the student in the 85%-rule band.
   * Returns a suggested quiz difficulty (0-1) to yield ~85% correct answers.
   */
  static targetDifficulty(pMastered: number): number {
    // For a student with mastery p, a quiz that yields ~85% correctness
    // needs difficulty d such that: correctRate ≈ p×(1-slip) + (1-p)×guess = 0.85
    // Simplified without BKT: difficulty ≈ 1 − p (the gap left to master)
    return Math.max(0.05, Math.min(0.95, 1 - pMastered));
  }
}

// ---------------------------------------------------------------------------
// Review Session Builder
// ---------------------------------------------------------------------------

/**
 * ReviewSessionBuilder
 *
 * Given a map of HLR states, builds a prioritised review session:
 *   1. Overdue concepts (sorted by retention ASC — most forgotten first)
 *   2. Due-today concepts (sorted by predicted retention ASC)
 *   3. Warm-up concepts: surface 1-2 recently mastered items
 */
export class ReviewSessionBuilder {
  /**
   * Build an ordered review session from a map of concept HLR states.
   * @param states        Map<conceptId, HLRState>
   * @param maxItems      Max number of items to include (default 10).
   * @param nowMs         Current timestamp (injectable for tests).
   */
  static build(
    states: Map<string, HLRState>,
    maxItems = 10,
    nowMs?: number
  ): ReviewSchedule[] {
    const now = nowMs ?? Date.now();
    const schedules: ReviewSchedule[] = Array.from(states.values()).map((s) =>
      SM2Scheduler.getSchedule(s, now)
    );

    const overdue = schedules
      .filter((s) => s.priority === "overdue")
      .sort((a, b) => a.predictedRetention - b.predictedRetention);

    const dueToday = schedules
      .filter((s) => s.priority === "due_today")
      .sort((a, b) => a.predictedRetention - b.predictedRetention);

    const upcoming = schedules
      .filter((s) => s.priority === "upcoming")
      .sort((a, b) => a.dueAt - b.dueAt);

    const ordered = [...overdue, ...dueToday, ...upcoming];
    return ordered.slice(0, maxItems);
  }

  /**
   * Count how many concepts are currently due for review.
   */
  static dueCount(states: Map<string, HLRState>, nowMs?: number): number {
    const now = nowMs ?? Date.now();
    return Array.from(states.values()).filter((s) => SM2Scheduler.isDue(s, now)).length;
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function msPerDay(days: number): number {
  return days * 86_400_000;
}
