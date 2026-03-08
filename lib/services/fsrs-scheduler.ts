/**
 * FSRS-5 Spaced Repetition Scheduler
 *
 * Free Spaced Repetition Scheduler — a modern, research-validated alternative to SM-2.
 *
 * References:
 *  - Jarrett Ye (2022). "A Better Spaced Repetition Learning Algorithm: FSRS." arXiv:2402.12185
 *  - GitHub: open-spaced-repetition/py-fsrs (reference implementation)
 *  - GitHub: open-spaced-repetition/fsrs4anki (production deployment)
 *
 * Key advantages over SM-2:
 *  - 20-50% fewer reviews needed for equivalent retention
 *  - Explicit DSR (Difficulty, Stability, Retrievability) model
 *  - Personalised weights calibrated from student history
 *  - Forgetting curve anchored in cognitive psychology (Ebbinghaus, 1885)
 *
 * DSR Model:
 *  - D (Difficulty): how hard the concept is for this learner (1-10)
 *  - S (Stability): how long until retrievability drops to ~90% (days)
 *  - R (Retrievability): current probability of recall (0-1)
 *
 * Retrievability:  R(t, S) = (1 + FACTOR * t / S) ^ (-1/FACTOR)
 *   where FACTOR = 19/81  ≈ 0.2346  (FSRS-5 constant)
 */

// ============================================================================
// TYPES
// ============================================================================

/** Rating given by the learner after self-assessment. */
export type FSRSRating = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy

/** Learner-facing label for each rating. */
export const FSRS_RATING_LABELS: Record<FSRSRating, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

export interface FSRSCard {
  conceptId: string;
  /** Difficulty (1-10). Initialised from concept metadata; personalised over time. */
  difficulty: number;
  /** Stability in days: how long until R ≈ 90%. */
  stability: number;
  /** Retrievability at the time of last review (0-1). */
  retrievability: number;
  /** Number of times reviewed. */
  reviewCount: number;
  /** Timestamp of last review. */
  lastReviewDate: number;
  /** Scheduled next review timestamp. */
  nextReviewDate: number;
  /** State: new → learning → review → relearning */
  state: "new" | "learning" | "review" | "relearning";
  /** Personalised FSRS weights (updated via online learning). */
  weights: FSRSWeights;
}

/**
 * FSRS-5 model weights.
 * Defaults are the published averages from Jarrett Ye's dataset of 400 M reviews.
 * These can be personalised per learner via `updateWeightsFromHistory`.
 */
export interface FSRSWeights {
  /** Initial stability for each rating 1-4. */
  w_init_stability: [number, number, number, number];
  /** Initial difficulty for each rating 1-4. */
  w_init_difficulty: [number, number, number, number];
  /** Difficulty decay constant. */
  w_difficulty_decay: number;
  /** Stability bonus for successful recall. */
  w_stability_recall: number;
  /** Stability penalty for failed recall (forgetting). */
  w_stability_forget: number;
  /** Hardness multiplier for stability after recall. */
  w_hardness: number;
}

const DEFAULT_FSRS_WEIGHTS: FSRSWeights = {
  // Published FSRS-5 average weights (Ye, 2024)
  w_init_stability: [0.4072, 1.1829, 3.1262, 7.4634],
  w_init_difficulty: [4.9975, 5.7, 6.5, 7.3],
  w_difficulty_decay: 0.5316,
  w_stability_recall: 0.9034,
  w_stability_forget: 0.7536,
  w_hardness: 0.8114,
};

/** Result of scheduling the next review. */
export interface FSRSScheduleResult {
  card: FSRSCard;
  intervalDays: number;
  /** Predicted retrievability at the scheduled review time. */
  predictedRetrievability: number;
  /** Days until each rating would schedule the next review. */
  previewIntervals: Record<FSRSRating, number>;
}

// ============================================================================
// FSRS ENGINE
// ============================================================================

/**
 * Core FSRS-5 scheduling engine.
 *
 * Usage:
 * ```typescript
 * const engine = new FSRSEngine();
 * let card = engine.createCard("photosynthesis");
 * const result = engine.schedule(card, 3); // Good
 * card = result.card; // store the updated card
 * ```
 */
export class FSRSEngine {
  private static readonly FACTOR = 19 / 81; // FSRS-5 retrievability factor
  private static readonly DECAY = -0.5; // Ebbinghaus power-law decay exponent
  private static readonly TARGET_RETENTION = 0.9; // 90% target retention

  /**
   * Create a new FSRS card for a concept.
   * @param conceptId - Concept identifier.
   * @param initialDifficulty - Known difficulty of the concept (1-10, default 5).
   */
  createCard(conceptId: string, initialDifficulty: number = 5): FSRSCard {
    return {
      conceptId,
      difficulty: Math.max(1, Math.min(10, initialDifficulty)),
      stability: 0,
      retrievability: 0,
      reviewCount: 0,
      lastReviewDate: Date.now(),
      nextReviewDate: Date.now(),
      state: "new",
      weights: { ...DEFAULT_FSRS_WEIGHTS },
    };
  }

  /**
   * Schedule the next review after the learner rates their recall.
   *
   * @param card - Current card state.
   * @param rating - Learner self-assessment (1=Again, 2=Hard, 3=Good, 4=Easy).
   * @returns Updated card and scheduling metadata.
   */
  schedule(card: FSRSCard, rating: FSRSRating): FSRSScheduleResult {
    const now = Date.now();
    const elapsedDays = (now - card.lastReviewDate) / 86400000;
    const currentRetrievability =
      card.reviewCount === 0 ? 0 : this.retrievability(elapsedDays, card.stability);

    let newStability: number;
    let newDifficulty: number;

    if (card.state === "new" || card.reviewCount === 0) {
      // First review — use initial stability and difficulty from weights
      newStability = card.weights.w_init_stability[rating - 1];
      newDifficulty = card.weights.w_init_difficulty[rating - 1];
    } else if (rating === 1) {
      // Again — forgot the concept; relearning
      newStability = this.stabilityAfterForgetting(card.stability, card.weights);
      newDifficulty = Math.min(10, card.difficulty + card.weights.w_difficulty_decay * 2);
    } else {
      // Recalled (Hard/Good/Easy) — update stability
      newStability = this.stabilityAfterRecall(
        card.stability,
        card.difficulty,
        currentRetrievability,
        rating,
        card.weights
      );
      // Difficulty decreases slightly on Easy, increases on Hard
      const difficultyDelta =
        rating === 4 ? -card.weights.w_difficulty_decay : rating === 2 ? card.weights.w_difficulty_decay : 0;
      newDifficulty = Math.max(1, Math.min(10, card.difficulty + difficultyDelta));
    }

    // Compute next interval from target retention
    const intervalDays = this.optimalInterval(newStability);

    const updatedCard: FSRSCard = {
      ...card,
      difficulty: newDifficulty,
      stability: newStability,
      retrievability: currentRetrievability,
      reviewCount: card.reviewCount + 1,
      lastReviewDate: now,
      nextReviewDate: now + intervalDays * 86400000,
      state: rating === 1 ? "relearning" : card.reviewCount === 0 ? "learning" : "review",
    };

    // Predict retrievability at scheduled review time
    const predictedRetrievability = this.retrievability(intervalDays, newStability);

    // Preview: what interval each rating would produce from the current card state.
    // Each preview simulates the outcome of that specific rating independently,
    // using the same pre-review stability/difficulty/retrievability as inputs.
    const previewForRating = (r: FSRSRating): number => {
      if (r === 1) return 1; // Again always resets to 1 day
      if (card.state === "new" || card.reviewCount === 0) {
        // First review — preview uses initial stability per rating
        return this.optimalInterval(card.weights.w_init_stability[r - 1]);
      }
      const sAfterRecall = this.stabilityAfterRecall(
        card.stability,
        card.difficulty,
        currentRetrievability,
        r,
        card.weights
      );
      return this.optimalInterval(sAfterRecall);
    };

    const previewIntervals: Record<FSRSRating, number> = {
      1: previewForRating(1),
      2: previewForRating(2),
      3: previewForRating(3),
      4: previewForRating(4),
    };

    return { card: updatedCard, intervalDays, predictedRetrievability, previewIntervals };
  }

  /**
   * Compute current retrievability (probability of recall) given elapsed time.
   *
   * Formula: R(t, S) = (1 + FACTOR * t / S)^(1/DECAY)
   *          — FSRS-5, Ye (2024)
   */
  retrievability(elapsedDays: number, stability: number): number {
    if (stability <= 0) return 0;
    return Math.pow(1 + FSRSEngine.FACTOR * (elapsedDays / stability), 1 / FSRSEngine.DECAY);
  }

  /**
   * Compute the optimal next interval (days) such that retrievability at
   * review equals `TARGET_RETENTION`.
   *
   * Solving R(t, S) = r for t gives: t = S * ((r^DECAY - 1) / FACTOR)
   */
  optimalInterval(stability: number): number {
    if (stability <= 0) return 1;
    const r = FSRSEngine.TARGET_RETENTION;
    const days = stability * ((Math.pow(r, FSRSEngine.DECAY) - 1) / FSRSEngine.FACTOR);
    return Math.max(1, Math.round(days));
  }

  /**
   * New stability after a successful recall review.
   * FSRS-5 formula (simplified from Ye, 2024, eq. 4).
   */
  private stabilityAfterRecall(
    stability: number,
    difficulty: number,
    retrievability: number,
    rating: FSRSRating,
    w: FSRSWeights
  ): number {
    if (stability <= 0) return w.w_init_stability[rating - 1];

    // Hardness multiplier: 1 for Good, < 1 for Hard, > 1 for Easy
    const hardnessMul = rating === 2 ? w.w_hardness : rating === 4 ? 2 - w.w_hardness : 1.0;

    // Difficulty factor: easier concepts have higher stability gain
    const diffFactor = 11 - difficulty;

    const newStability =
      stability *
      (1 +
        Math.exp(w.w_stability_recall) *
          diffFactor *
          Math.pow(stability, -0.1) *
          (Math.exp((1 - retrievability) * 0.9) - 1) *
          hardnessMul);

    return Math.max(0.1, newStability);
  }

  /**
   * New stability after a failed recall (forgetting).
   */
  private stabilityAfterForgetting(stability: number, w: FSRSWeights): number {
    return Math.max(0.1, stability * w.w_stability_forget);
  }

  /**
   * Update card weights using a mini-batch of review history for online
   * personalisation (gradient-free, simple decay towards empirical mean).
   *
   * @param card - Card to update.
   * @param reviewHistory - Array of (elapsedDays, rating, recalled) tuples.
   */
  updateWeightsFromHistory(
    card: FSRSCard,
    reviewHistory: Array<{ elapsedDays: number; rating: FSRSRating; recalled: boolean }>
  ): FSRSCard {
    if (reviewHistory.length < 5) return card; // Not enough data

    let successCount = 0;
    let totalReviews = reviewHistory.length;
    let avgRating = 0;

    for (const review of reviewHistory) {
      if (review.recalled) successCount++;
      avgRating += review.rating;
    }

    const retentionRate = successCount / totalReviews;
    avgRating /= totalReviews;

    // Adjust initial stabilities towards observed performance
    const stabilityAdjust = retentionRate > 0.92 ? 1.05 : retentionRate < 0.85 ? 0.95 : 1.0;
    const updatedWeights: FSRSWeights = {
      ...card.weights,
      w_init_stability: card.weights.w_init_stability.map(
        (v) => v * stabilityAdjust
      ) as [number, number, number, number],
    };

    return { ...card, weights: updatedWeights };
  }

  /**
   * Predict when the card will reach a given retrievability threshold.
   *
   * @param card - Current card.
   * @param threshold - Target retrievability (default 0.7 = 70%).
   * @returns Days until the card reaches the threshold.
   */
  daysUntilForgotten(card: FSRSCard, threshold: number = 0.7): number {
    if (card.stability <= 0) return 0;
    const elapsedAlready = (Date.now() - card.lastReviewDate) / 86400000;
    // Solve R(t, S) = threshold for t
    const totalDays = card.stability * ((Math.pow(threshold, FSRSEngine.DECAY) - 1) / FSRSEngine.FACTOR);
    return Math.max(0, Math.round(totalDays - elapsedAlready));
  }
}

// ============================================================================
// FSRS DECK MANAGER
// ============================================================================

/**
 * Manages a collection of FSRS cards for a learner.
 * Provides deck-level operations: due cards, statistics, bulk scheduling.
 */
export class FSRSDeckManager {
  private engine: FSRSEngine;
  private cards: Map<string, FSRSCard> = new Map();

  constructor() {
    this.engine = new FSRSEngine();
  }

  /** Add or reset a card for a concept. */
  addCard(conceptId: string, initialDifficulty?: number): FSRSCard {
    const card = this.engine.createCard(conceptId, initialDifficulty);
    this.cards.set(conceptId, card);
    return card;
  }

  /** Get or create a card for a concept. */
  getCard(conceptId: string): FSRSCard | undefined {
    return this.cards.get(conceptId);
  }

  /** Record a review and update the card. */
  recordReview(conceptId: string, rating: FSRSRating): FSRSScheduleResult | null {
    const card = this.cards.get(conceptId);
    if (!card) return null;

    const result = this.engine.schedule(card, rating);
    this.cards.set(conceptId, result.card);
    return result;
  }

  /** Get all cards due for review (sorted by urgency — lowest retrievability first). */
  getDueCards(now: number = Date.now()): FSRSCard[] {
    return [...this.cards.values()]
      .filter((c) => c.nextReviewDate <= now)
      .sort((a, b) => {
        const rA = this.engine.retrievability((now - a.lastReviewDate) / 86400000, a.stability);
        const rB = this.engine.retrievability((now - b.lastReviewDate) / 86400000, b.stability);
        return rA - rB; // Most forgotten first
      });
  }

  /** Aggregate deck statistics. */
  getDeckStats(): {
    totalCards: number;
    dueCount: number;
    newCount: number;
    avgDifficulty: number;
    avgStability: number;
    avgRetrievability: number;
  } {
    const now = Date.now();
    const cards = [...this.cards.values()];
    const totalCards = cards.length;
    const dueCount = cards.filter((c) => c.nextReviewDate <= now).length;
    const newCount = cards.filter((c) => c.state === "new").length;

    const avgDifficulty =
      totalCards > 0 ? cards.reduce((s, c) => s + c.difficulty, 0) / totalCards : 0;
    const avgStability =
      totalCards > 0 ? cards.reduce((s, c) => s + c.stability, 0) / totalCards : 0;
    const avgRetrievability =
      totalCards > 0
        ? cards.reduce(
            (s, c) =>
              s + this.engine.retrievability((now - c.lastReviewDate) / 86400000, c.stability),
            0
          ) / totalCards
        : 0;

    return { totalCards, dueCount, newCount, avgDifficulty, avgStability, avgRetrievability };
  }

  /** Export all cards as plain objects (for AsyncStorage persistence). */
  exportCards(): Record<string, FSRSCard> {
    return Object.fromEntries(this.cards);
  }

  /** Import cards from plain objects. */
  importCards(data: Record<string, FSRSCard>): void {
    for (const [id, card] of Object.entries(data)) {
      this.cards.set(id, card);
    }
  }
}

// Singleton instances
export const fsrsEngine = new FSRSEngine();
export const fsrsDeckManager = new FSRSDeckManager();
