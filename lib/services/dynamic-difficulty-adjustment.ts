/**
 * Dynamic Difficulty Adjustment (DDA) Engine
 * Implements a Dual-Reward system and AdaRFT-style adaptive curriculum loop.
 *
 * Research basis:
 *  - Huang et al. (2025) "DualReward: Dynamic RL for Cloze Tests Distractor Generation"
 *  - Shi et al. (2025) "Efficient Reinforcement Finetuning via Adaptive Curriculum Learning"
 *  - Zhang et al. (2025) "CLPO: Curriculum Learning meets Policy Optimization"
 *  - Lopes et al. (2025) "Systematic Review of Experience-Driven Game Adaptation"
 */

import type {
  DDARewardSignal,
  CurriculumTask,
  DDAState,
  OverloadState,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Vygotsky's Zone of Proximal Development width around current mastery */
const ZPD_HALF_WIDTH = 1.5; // ±1.5 difficulty points

/** Minimum difficulty level */
const DIFFICULTY_MIN = 1;

/** Maximum difficulty level */
const DIFFICULTY_MAX = 10;

/** Rolling window size for reward signals (AdaRFT "recent reward" window) */
const REWARD_WINDOW = 5;

/** Overload penalty magnitude applied to composite reward */
const OVERLOAD_PENALTY_MAP: Record<string, number> = {
  none: 0.0,
  mild: 0.2,
  moderate: 0.5,
  severe: 1.0,
};

// ---------------------------------------------------------------------------
// DualRewardCalculator
// ---------------------------------------------------------------------------

/**
 * Computes the Dual Reward signal for a single student-task interaction.
 *
 * Huang et al. (2025): RL optimises for *both* correctness and optimal
 * difficulty (maintaining the ZPD), adjusted via textual overload cues.
 * Reward = correctness_reward × difficulty_optimality_reward × (1 – overload_penalty).
 */
export class DualRewardCalculator {
  /**
   * Compute correctness reward from student answer score (0-1).
   */
  static correctnessReward(score: number): number {
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Compute how well task difficulty sits inside the student's ZPD.
   * Peak reward at the centre of the ZPD; decays linearly toward the edges.
   *
   * @param taskDifficulty   The difficulty of the attempted task (1-10).
   * @param currentMastery   The student's estimated mastery (1-10).
   */
  static difficultyOptimalityReward(taskDifficulty: number, currentMastery: number): number {
    const zpd = {
      lower: currentMastery - ZPD_HALF_WIDTH,
      upper: currentMastery + ZPD_HALF_WIDTH,
    };
    const centre = (zpd.lower + zpd.upper) / 2;
    const distanceFromCentre = Math.abs(taskDifficulty - centre);
    const maxDistance = ZPD_HALF_WIDTH + 2; // tasks far outside ZPD get near-zero reward
    return Math.max(0, 1 - distanceFromCentre / maxDistance);
  }

  /**
   * Compute the full DDARewardSignal for one interaction.
   */
  static compute(
    answerScore: number,
    taskDifficulty: number,
    currentMastery: number,
    overloadState: OverloadState
  ): DDARewardSignal {
    const correctness = this.correctnessReward(answerScore);
    const difficultyOptimality = this.difficultyOptimalityReward(taskDifficulty, currentMastery);
    const overloadPenalty = OVERLOAD_PENALTY_MAP[overloadState.severity] ?? 0;
    const compositeReward = correctness * difficultyOptimality * (1 - overloadPenalty);

    return { correctness, difficultyOptimality, overloadPenalty, compositeReward };
  }
}

// ---------------------------------------------------------------------------
// AdaptiveCurriculumSelector
// ---------------------------------------------------------------------------

/**
 * AdaRFT-style adaptive curriculum selector.
 * Shi et al. (2025): adjusts task difficulty based on "recent reward signals"
 * (student success/failure and overload cues).
 *
 * The closed loop:
 *   Student Text → Overload Detection → Difficulty Adjustment → New Content
 */
export class AdaptiveCurriculumSelector {
  /**
   * Update ZPD bounds based on recent reward window.
   * If recent rewards are high → shift ZPD upward (advance difficulty).
   * If recent rewards are low  → shift ZPD downward (reduce difficulty).
   */
  static updateZPD(
    currentMastery: number,
    recentRewards: DDARewardSignal[]
  ): { lower: number; upper: number } {
    const window = recentRewards.slice(-REWARD_WINDOW);
    if (window.length === 0) {
      return {
        lower: Math.max(DIFFICULTY_MIN, currentMastery - ZPD_HALF_WIDTH),
        upper: Math.min(DIFFICULTY_MAX, currentMastery + ZPD_HALF_WIDTH),
      };
    }

    const avgReward = window.reduce((s, r) => s + r.compositeReward, 0) / window.length;
    // Shift mastery estimate: reward > 0.7 → mastery advances, < 0.3 → mastery recedes
    const masteryDelta = (avgReward - 0.5) * 2; // range -1 to +1
    const adjustedMastery = Math.min(
      DIFFICULTY_MAX,
      Math.max(DIFFICULTY_MIN, currentMastery + masteryDelta)
    );

    return {
      lower: Math.max(DIFFICULTY_MIN, adjustedMastery - ZPD_HALF_WIDTH),
      upper: Math.min(DIFFICULTY_MAX, adjustedMastery + ZPD_HALF_WIDTH),
    };
  }

  /**
   * Select the best next task from a candidate list based on ZPD and overload state.
   * Shi et al. (2025): "Select tasks where predicted success probability is in [0.2, 0.8]."
   */
  static selectNextTask(
    candidates: CurriculumTask[],
    zpd: { lower: number; upper: number },
    overloadState: OverloadState
  ): CurriculumTask | null {
    if (candidates.length === 0) return null;

    // Under overload, prefer the easiest available task
    if (overloadState.severity === "severe" || overloadState.severity === "moderate") {
      const sorted = [...candidates].sort((a, b) => a.difficulty - b.difficulty);
      return sorted[0] ?? null;
    }

    // Otherwise prefer tasks inside the ZPD, sorted by how close to the ZPD centre
    const centre = (zpd.lower + zpd.upper) / 2;
    const withinZPD = candidates.filter(
      (t) => t.difficulty >= zpd.lower && t.difficulty <= zpd.upper
    );
    const pool = withinZPD.length > 0 ? withinZPD : candidates;

    const sorted = [...pool].sort(
      (a, b) => Math.abs(a.difficulty - centre) - Math.abs(b.difficulty - centre)
    );
    return sorted[0] ?? null;
  }
}

// ---------------------------------------------------------------------------
// DDAController
// ---------------------------------------------------------------------------

/**
 * Top-level DDA controller integrating the Dual Reward system and
 * Adaptive Curriculum Selector into a single, stateful closed loop.
 */
export class DDAController {
  /**
   * Create an initial DDAState for a student starting a learning session.
   */
  static createInitialState(startingDifficulty: number = 5): DDAState {
    const clamped = Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, startingDifficulty));
    return {
      currentDifficulty: clamped,
      zpd: {
        lower: Math.max(DIFFICULTY_MIN, clamped - ZPD_HALF_WIDTH),
        upper: Math.min(DIFFICULTY_MAX, clamped + ZPD_HALF_WIDTH),
      },
      recentRewards: [],
      consecutiveOverloadCount: 0,
      adjustmentHistory: [],
    };
  }

  /**
   * Process one completed task interaction and update the DDA state.
   *
   * This is the "closing the loop" step described in Lopes et al. (2025):
   * lower difficulty (intrinsic load) or simplify presentation (extraneous load)
   * immediately upon detecting textual cues of overload.
   */
  static processInteraction(
    state: DDAState,
    answerScore: number,
    overloadState: OverloadState
  ): DDAState {
    const reward = DualRewardCalculator.compute(
      answerScore,
      state.currentDifficulty,
      (state.zpd.lower + state.zpd.upper) / 2,
      overloadState
    );

    const updatedRewards = [...state.recentRewards, reward].slice(-REWARD_WINDOW);

    const consecutiveOverloadCount =
      overloadState.severity !== "none"
        ? state.consecutiveOverloadCount + 1
        : 0;

    // Compute new ZPD
    const currentMastery = (state.zpd.lower + state.zpd.upper) / 2;
    const newZPD = AdaptiveCurriculumSelector.updateZPD(currentMastery, updatedRewards);

    // Determine new target difficulty
    let newDifficulty = (newZPD.lower + newZPD.upper) / 2;

    // Hard override: consecutive overload → force difficulty reduction
    if (consecutiveOverloadCount >= 2) {
      newDifficulty = Math.max(DIFFICULTY_MIN, state.currentDifficulty - 2);
    }
    newDifficulty = Math.round(Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, newDifficulty)));

    const adjustmentHistory = [...state.adjustmentHistory];
    if (newDifficulty !== state.currentDifficulty) {
      adjustmentHistory.push({
        from: state.currentDifficulty,
        to: newDifficulty,
        reason: consecutiveOverloadCount >= 2
          ? "Consecutive overload detected — reducing difficulty"
          : reward.compositeReward > 0.7
          ? "High reward — advancing difficulty"
          : "Low reward — reducing difficulty",
        timestamp: Date.now(),
      });
    }

    return {
      currentDifficulty: newDifficulty,
      zpd: newZPD,
      recentRewards: updatedRewards,
      consecutiveOverloadCount,
      adjustmentHistory,
    };
  }

  /**
   * Select the next task for the student given the current DDA state.
   */
  static selectNextTask(
    state: DDAState,
    candidates: CurriculumTask[],
    overloadState: OverloadState
  ): CurriculumTask | null {
    return AdaptiveCurriculumSelector.selectNextTask(candidates, state.zpd, overloadState);
  }

  /**
   * Generate a human-readable summary of the current DDA state.
   */
  static summarize(state: DDAState): {
    currentDifficulty: number;
    zpd: { lower: number; upper: number };
    averageReward: number;
    trend: "advancing" | "stable" | "retreating";
    consecutiveOverloadCount: number;
  } {
    const recentRewards = state.recentRewards.slice(-REWARD_WINDOW);
    const averageReward =
      recentRewards.length > 0
        ? recentRewards.reduce((s, r) => s + r.compositeReward, 0) / recentRewards.length
        : 0;

    let trend: "advancing" | "stable" | "retreating" = "stable";
    if (state.adjustmentHistory.length > 0) {
      const last = state.adjustmentHistory[state.adjustmentHistory.length - 1];
      if (last.to > last.from) trend = "advancing";
      else if (last.to < last.from) trend = "retreating";
    }

    return {
      currentDifficulty: state.currentDifficulty,
      zpd: state.zpd,
      averageReward,
      trend,
      consecutiveOverloadCount: state.consecutiveOverloadCount,
    };
  }
}
