/**
 * CoTutor — Control-Theoretic Dynamic Knowledge Tracing
 *
 * Implements the CoTutor DKT variant from arXiv:2509.23996 (2025).
 * CoTutor models knowledge state as a control system:
 *
 *   P(mastery_t) = P(mastery_{t-1}) + K × (score_t − P(mastery_{t-1}))
 *
 * where K is a Kalman-inspired gain that weights new evidence vs prior belief.
 * Reported accuracy: 84.3% vs DKT 78.9% vs classical BKT 72.5%.
 *
 * This module extends classical BKT with:
 *   1. CoTutor control-theoretic update (Kalman gain K)
 *   2. Mastery Signal Weighter — per-source reliability weights
 *      (from the DeepFeynman V2 plan: quiz=1.0, feynman=0.6,
 *       socratic_hint=-0.2, rubber_duck=0.0, organic=0.4)
 *   3. 85%-Rule Difficulty Adjuster (Wilson et al. 2019)
 *   4. Mastery Progression Tracker — history of mastery states
 *   5. COMEDY Memory Compression integration point
 *
 * Research basis:
 *   - arXiv:2509.23996 — CoTutor: control-theoretic DKT with feedback loop
 *   - Wilson et al. (2019) — "Humans learn better at 85% challenge rate"
 *   - Classical BKT (Corbett & Anderson 1994) — four-parameter model
 *   - DeepFeynman V2 plan (2026-03-08) — mastery signal table + difficulty rules
 */

import type { DepthLevel } from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants (from arXiv:2509.23996 + ASSISTments dataset benchmarks)
// ---------------------------------------------------------------------------

/** Kalman gain = P_LEARN / (P_LEARN + P_SLIP) — controls update speed. */
export const KALMAN_GAIN_DEFAULT = 0.30 / (0.30 + 0.10); // ≈ 0.75

/** Default BKT parameters (population-level priors). */
export const COTUTOR_BKT_PARAMS = {
  P_LEARN:  0.30,   // Probability of learning in one interaction
  P_GUESS:  0.20,   // Lucky guess probability
  P_SLIP:   0.10,   // Slip (knows but answers wrong)
  P_FORGET: 0.05,   // Forgetting probability
} as const;

/** 85%-Rule optimal mastery zone (Wilson et al. 2019). */
export const OPTIMAL_MASTERY_ZONE = { lower: 0.60, upper: 0.90 } as const;

/** Mastery gate threshold (Bloom 1984): must reach this before advancing. */
export const MASTERY_GATE_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Mastery Signal Sources
// ---------------------------------------------------------------------------

/**
 * Per-source mastery signal reliability weights.
 *
 * DeepFeynman V2 plan table:
 *   - Explicit quiz (correct/incorrect):              1.0 (High)
 *   - Feynman Student mode (LLM-scored explanation):  0.6 (Medium)
 *   - Socratic mode (hint needed = negative signal):  −0.2 (Low-negative)
 *   - Rubber Duck mode (diagnostic only):             0.0 (None)
 *   - Organic (unprompted correct concept use):       0.4 (Medium)
 */
export type MasterySignalSource =
  | "quiz_correct"
  | "quiz_incorrect"
  | "feynman_student"
  | "socratic_hint_needed"
  | "socratic_unprompted"
  | "rubber_duck"
  | "organic_correct"
  | "organic_incorrect";

export const MASTERY_SIGNAL_WEIGHTS: Record<MasterySignalSource, number> = {
  quiz_correct:          1.0,
  quiz_incorrect:       -0.8,   // stronger negative signal than a hint need
  feynman_student:       0.6,
  socratic_hint_needed: -0.2,
  socratic_unprompted:   0.5,
  rubber_duck:           0.0,
  organic_correct:       0.4,
  organic_incorrect:    -0.3,
};

/** Normalised score for a signal source: maps to [0, 1] for the CoTutor update. */
export type SignalEvent = {
  source: MasterySignalSource;
  /** Raw signal score 0-1 produced by the evaluator (e.g. LLM rubric score for feynman). */
  rawScore: number;
  conceptId: string;
  turnIndex: number;
};

// ---------------------------------------------------------------------------
// Mastery State
// ---------------------------------------------------------------------------

export interface CoTutorMasteryState {
  conceptId: string;
  /** Current mastery probability (0-1) */
  pMastered: number;
  /** Adaptive Kalman gain (personalised over time) */
  kalmanGain: number;
  /** Total signal events processed */
  totalEvents: number;
  /** Running weighted accuracy across events */
  weightedAccuracy: number;
  /** History of mastery values (for trend analysis) */
  history: Array<{ turn: number; pMastered: number; source: MasterySignalSource }>;
  /** Last update timestamp */
  lastUpdatedAt: number;
}

// ---------------------------------------------------------------------------
// CoTutor DKT Engine
// ---------------------------------------------------------------------------

/**
 * CoTutorDKT
 *
 * Implements the CoTutor control-theoretic update rule:
 *   P(mastery_t) = P(mastery_{t-1}) + K × (score_t − P(mastery_{t-1}))
 *
 * The score_t is a reliability-weighted signal (not raw 0/1 correctness).
 */
export class CoTutorDKT {
  /**
   * Create a cold-start mastery state for a new concept.
   */
  static createState(conceptId: string, pInit = 0.10): CoTutorMasteryState {
    return {
      conceptId,
      pMastered: pInit,
      kalmanGain: KALMAN_GAIN_DEFAULT,
      totalEvents: 0,
      weightedAccuracy: 0,
      history: [],
      lastUpdatedAt: Date.now(),
    };
  }

  /**
   * Process a signal event and return the updated mastery state.
   *
   * The reliability weight modulates how much the new evidence shifts the estimate.
   * A rubber-duck observation (weight=0) leaves mastery unchanged.
   * A quiz correct (weight=1.0) applies the full Kalman gain update.
   *
   * @param state   Current mastery state.
   * @param event   Signal event with source, rawScore, and conceptId.
   */
  static processEvent(
    state: CoTutorMasteryState,
    event: SignalEvent
  ): CoTutorMasteryState {
    const weight = MASTERY_SIGNAL_WEIGHTS[event.source];

    if (weight === 0) {
      // Rubber duck mode — no mastery update
      return {
        ...state,
        totalEvents: state.totalEvents + 1,
        lastUpdatedAt: Date.now(),
      };
    }

    // Weighted score: combines source reliability × raw score
    // For negative weights (quiz_incorrect, socratic_hint_needed),
    // the score_t is negative, pulling mastery down appropriately.
    const weightedScore = weight * event.rawScore;

    // CoTutor update: P_t = P_{t-1} + K * predictionError
    // where predictionError = (score_t - P_{t-1}) aligns with Kalman filter terminology
    const predictionError = weightedScore - state.pMastered;
    const newPMastered = Math.max(0, Math.min(1,
      state.pMastered + state.kalmanGain * predictionError
    ));

    // Adapt Kalman gain: if student has many events, trust the prior more
    // (reduce gain gradually — prevents overcorrection from single events)
    const adaptedGain = CoTutorDKT.adaptGain(state.kalmanGain, state.totalEvents);

    // Update running weighted accuracy
    const totalW = state.totalEvents + 1;
    const newWeightedAcc = (state.weightedAccuracy * state.totalEvents + weightedScore) / totalW;

    return {
      ...state,
      pMastered: newPMastered,
      kalmanGain: adaptedGain,
      totalEvents: totalW,
      weightedAccuracy: newWeightedAcc,
      history: [
        ...state.history,
        { turn: event.turnIndex, pMastered: newPMastered, source: event.source },
      ],
      lastUpdatedAt: Date.now(),
    };
  }

  /**
   * Adapt the Kalman gain over time.
   * Gain starts at KALMAN_GAIN_DEFAULT and decays toward a floor as
   * more evidence accumulates (information-theoretic stabilisation).
   */
  static adaptGain(currentGain: number, totalEvents: number): number {
    const FLOOR = 0.20; // minimum gain (always responsive to evidence)
    const DECAY_RATE = 0.02;
    const adapted = currentGain - DECAY_RATE * Math.max(0, totalEvents - 5);
    return Math.max(FLOOR, adapted);
  }

  /**
   * Predict mastery at a future time step using the forgetting curve.
   * Ebbinghaus R(t) = e^(−t/h), where h is the current estimate of half-life
   * derived from the mastery state's history.
   *
   * @param state         Current mastery state.
   * @param daysElapsed   Days since last review.
   */
  static predictRetention(state: CoTutorMasteryState, daysElapsed: number): number {
    // Estimate half-life from mastery level (higher mastery → longer half-life)
    const halfLifeDays = 1 + state.pMastered * 29; // range [1, 30] days
    const retention = Math.exp(-daysElapsed / halfLifeDays);
    return Math.max(0, Math.min(1, retention));
  }

  /**
   * Get the mastery trend: "improving", "stable", or "declining".
   * Uses the last N history entries.
   */
  static getTrend(
    state: CoTutorMasteryState,
    windowSize = 5
  ): "improving" | "stable" | "declining" {
    const recent = state.history.slice(-windowSize);
    if (recent.length < 2) return "stable";

    const first = recent[0].pMastered;
    const last = recent[recent.length - 1].pMastered;
    const delta = last - first;

    if (delta > 0.08) return "improving";
    if (delta < -0.08) return "declining";
    return "stable";
  }
}

// ---------------------------------------------------------------------------
// 85%-Rule Difficulty Adjuster
// ---------------------------------------------------------------------------

/**
 * DifficultyAdjuster
 *
 * Implements the 85%-Rule (Wilson et al. 2019, Nature Human Behaviour):
 * optimal learning occurs at ~85% accuracy = mastery zone [0.60, 0.90].
 *
 * Maps mastery probability to a DepthLevel adjustment (+1, 0, or -1).
 */
export class DifficultyAdjuster {
  /**
   * Recommend a depth adjustment based on current mastery.
   *
   * @param pMastered      Current mastery probability.
   * @param currentDepth   Current Ranedeer depth level (1-10).
   * @returns adjusted depth level, reason string
   */
  static recommend(
    pMastered: number,
    currentDepth: number
  ): { newDepth: DepthLevel; direction: "raise" | "lower" | "maintain"; reason: string } {
    if (pMastered > OPTIMAL_MASTERY_ZONE.upper) {
      // Too easy — student is above the optimal zone
      const newDepth = Math.min(10, currentDepth + 1) as DepthLevel;
      return {
        newDepth,
        direction: "raise",
        reason: `Mastery=${pMastered.toFixed(2)} > ${OPTIMAL_MASTERY_ZONE.upper} (above optimal zone) — raise difficulty`,
      };
    }

    if (pMastered < OPTIMAL_MASTERY_ZONE.lower) {
      // Too hard — student is below the optimal zone
      const newDepth = Math.max(1, currentDepth - 1) as DepthLevel;
      return {
        newDepth,
        direction: "lower",
        reason: `Mastery=${pMastered.toFixed(2)} < ${OPTIMAL_MASTERY_ZONE.lower} (below optimal zone) — lower difficulty`,
      };
    }

    // In optimal zone — maintain current depth
    return {
      newDepth: currentDepth as DepthLevel,
      direction: "maintain",
      reason: `Mastery=${pMastered.toFixed(2)} in optimal zone [${OPTIMAL_MASTERY_ZONE.lower}, ${OPTIMAL_MASTERY_ZONE.upper}] — maintain`,
    };
  }

  /**
   * Check whether a student is in the Bloom mastery gate zone.
   * Must reach MASTERY_GATE_THRESHOLD before advancing to next concept.
   */
  static hasPassedMasteryGate(pMastered: number): boolean {
    return pMastered >= MASTERY_GATE_THRESHOLD;
  }

  /**
   * Determine the optimal number of practice items for the current session.
   * Based on ZPD and 85%-rule: fewer items when too hard or too easy.
   */
  static recommendPracticeCount(pMastered: number): number {
    if (pMastered < 0.30) return 3;  // overwhelmed — small bites
    if (pMastered < 0.60) return 5;  // building up
    if (pMastered < 0.85) return 7;  // optimal zone — most practice
    return 4;                          // near-mastered — consolidation
  }
}

// ---------------------------------------------------------------------------
// Mastery Signal Weighter
// ---------------------------------------------------------------------------

/**
 * MasterySignalWeighter
 *
 * Converts raw interaction outcomes into weighted SignalEvents for CoTutor.
 * Bridges the gap between Feynman mode signals and the numerical DKT layer.
 */
export class MasterySignalWeighter {
  /**
   * Convert a quiz result into a SignalEvent.
   *
   * @param conceptId   Target concept.
   * @param correct     Whether the student answered correctly.
   * @param turnIndex   Conversation turn index.
   */
  static fromQuiz(conceptId: string, correct: boolean, turnIndex: number): SignalEvent {
    return {
      source: correct ? "quiz_correct" : "quiz_incorrect",
      rawScore: correct ? 1.0 : 0.0,
      conceptId,
      turnIndex,
    };
  }

  /**
   * Convert a Feynman Student mode evaluation score into a SignalEvent.
   * The LLM rates the student's explanation on a 0-1 scale.
   *
   * @param conceptId   Target concept.
   * @param llmScore    0-1 score from LLM rubric evaluation.
   * @param turnIndex   Conversation turn index.
   */
  static fromFeynmanStudent(conceptId: string, llmScore: number, turnIndex: number): SignalEvent {
    return {
      source: "feynman_student",
      rawScore: Math.max(0, Math.min(1, llmScore)),
      conceptId,
      turnIndex,
    };
  }

  /**
   * Convert a Socratic hint-needed event into a SignalEvent.
   * (Student asked for a hint → partial negative mastery signal.)
   */
  static fromSocraticHint(conceptId: string, turnIndex: number): SignalEvent {
    return {
      source: "socratic_hint_needed",
      rawScore: 1.0, // full weight for the negative signal
      conceptId,
      turnIndex,
    };
  }

  /**
   * Convert an unprompted correct concept usage into a SignalEvent.
   * (Student correctly uses a concept in a non-quiz context.)
   */
  static fromOrganicUsage(conceptId: string, correct: boolean, turnIndex: number): SignalEvent {
    return {
      source: correct ? "organic_correct" : "organic_incorrect",
      rawScore: correct ? 1.0 : 0.0,
      conceptId,
      turnIndex,
    };
  }

  /**
   * Convert a Rubber Duck mode turn into a no-op SignalEvent.
   */
  static fromRubberDuck(conceptId: string, turnIndex: number): SignalEvent {
    return {
      source: "rubber_duck",
      rawScore: 0,
      conceptId,
      turnIndex,
    };
  }

  /**
   * Compute the weighted mastery score for a batch of events.
   * Useful for summarising a session's overall mastery signal.
   */
  static batchWeightedScore(events: SignalEvent[]): number {
    if (events.length === 0) return 0;
    const total = events.reduce((sum, e) => {
      const weight = MASTERY_SIGNAL_WEIGHTS[e.source];
      return sum + weight * e.rawScore;
    }, 0);
    // Clamp to [-1, 1] then shift to [0, 1]
    const clamped = Math.max(-1, Math.min(1, total / events.length));
    return (clamped + 1) / 2;
  }
}
