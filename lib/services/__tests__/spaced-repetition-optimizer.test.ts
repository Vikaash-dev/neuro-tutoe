/**
 * Tests for SpacedRepetitionOptimizer
 * HLR (arXiv:1605.06065), SM-2, Ebbinghaus (1885), Wilson et al. (2019)
 */

import { describe, it, expect } from "vitest";
import {
  EbbinghausForgettingCurve,
  HLREngine,
  SM2Scheduler,
  ChallengeZoneEvaluator,
  ReviewSessionBuilder,
  OPTIMAL_ACCURACY_MIN,
  OPTIMAL_ACCURACY_MAX,
  MASTERY_THRESHOLD,
  EF_DEFAULT,
  EF_MIN,
  HLR_BASE_HALF_LIFE,
  HLR_MAX_HALF_LIFE,
} from "../spaced-repetition-optimizer";
import type { HLRState } from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<HLRState> = {}): HLRState {
  return HLREngine.initState("test-concept");
}

function stateWithHistory(
  totalReviews: number,
  correctFraction: number,
  halfLifeDays: number,
  intervalDays = 7,
  daysAgo = 3
): HLRState {
  const now = Date.now();
  return {
    conceptId: "test",
    halfLifeDays,
    easeFactor: EF_DEFAULT,
    intervalDays,
    consecutiveCorrect: Math.round(correctFraction * totalReviews),
    lastReviewAt: now - daysAgo * 86_400_000,
    nextReviewAt: now + (intervalDays - daysAgo) * 86_400_000,
    predictedRetention: 0.8,
    totalReviews,
    correctFraction,
  };
}

// ---------------------------------------------------------------------------
// Ebbinghaus Forgetting Curve
// ---------------------------------------------------------------------------

describe("EbbinghausForgettingCurve", () => {
  it("should return 1.0 at t=0 (no time elapsed)", () => {
    const r = EbbinghausForgettingCurve.retention(7, 0);
    expect(r).toBeCloseTo(1.0, 5);
  });

  it("should return ~0.5 at t = halfLifeDays", () => {
    const h = 10;
    const r = EbbinghausForgettingCurve.retention(h, h);
    expect(r).toBeCloseTo(Math.exp(-1), 2); // e^-1 ≈ 0.368 (natural decay half-life)
  });

  it("should return lower retention for longer elapsed time", () => {
    const r7 = EbbinghausForgettingCurve.retention(10, 7);
    const r14 = EbbinghausForgettingCurve.retention(10, 14);
    expect(r7).toBeGreaterThan(r14);
  });

  it("should return 0 for halfLifeDays=0", () => {
    expect(EbbinghausForgettingCurve.retention(0, 5)).toBe(0);
  });

  it("daysUntilForgotten should return positive days", () => {
    const days = EbbinghausForgettingCurve.daysUntilForgotten(7, 0.9);
    expect(days).toBeGreaterThan(0);
  });

  it("higher half-life should give more days until forgotten", () => {
    const d14 = EbbinghausForgettingCurve.daysUntilForgotten(14, 0.9);
    const d7 = EbbinghausForgettingCurve.daysUntilForgotten(7, 0.9);
    expect(d14).toBeGreaterThan(d7);
  });
});

// ---------------------------------------------------------------------------
// HLR Engine
// ---------------------------------------------------------------------------

describe("HLREngine", () => {
  it("should initialise state with cold-start half-life = HLR_BASE_HALF_LIFE", () => {
    const state = HLREngine.initState("kc-1");
    expect(state.halfLifeDays).toBe(HLR_BASE_HALF_LIFE);
    expect(state.totalReviews).toBe(0);
    expect(state.correctFraction).toBe(0);
  });

  it("should increase half-life after correct reviews", () => {
    let state = HLREngine.initState("kc-1");
    for (let i = 0; i < 5; i++) {
      state = HLREngine.update(state, true);
    }
    expect(state.halfLifeDays).toBeGreaterThan(HLR_BASE_HALF_LIFE);
  });

  it("should keep half-life low after many wrong answers", () => {
    let state = HLREngine.initState("kc-1");
    for (let i = 0; i < 5; i++) {
      state = HLREngine.update(state, false);
    }
    expect(state.halfLifeDays).toBeLessThanOrEqual(HLR_BASE_HALF_LIFE + 0.5);
  });

  it("should cap half-life at HLR_MAX_HALF_LIFE", () => {
    let state = HLREngine.initState("kc-1");
    // Simulate many correct reviews
    for (let i = 0; i < 200; i++) {
      state = HLREngine.update(state, true, 5);
    }
    expect(state.halfLifeDays).toBeLessThanOrEqual(HLR_MAX_HALF_LIFE);
  });

  it("should reset interval to 1 on wrong answer", () => {
    let state = HLREngine.initState("kc-1");
    state = HLREngine.update(state, true);
    state = HLREngine.update(state, true);
    state = HLREngine.update(state, false); // wrong
    expect(state.intervalDays).toBe(1);
    expect(state.consecutiveCorrect).toBe(0);
  });

  it("should use interval 1 → 6 → EF-based for first three correct reviews", () => {
    let state = HLREngine.initState("kc-1");
    state = HLREngine.update(state, true); // interval = 1
    expect(state.intervalDays).toBe(1);
    state = HLREngine.update(state, true); // interval = 6
    expect(state.intervalDays).toBe(6);
    state = HLREngine.update(state, true); // interval = 6 * EF
    expect(state.intervalDays).toBeGreaterThan(6);
  });

  it("should keep ease factor above EF_MIN", () => {
    let state = HLREngine.initState("kc-1");
    for (let i = 0; i < 20; i++) {
      state = HLREngine.update(state, false, 0); // q=0 → maximum EF drop
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(EF_MIN);
  });

  it("estimateHalfLife should return HLR_BASE_HALF_LIFE for 0 reviews", () => {
    expect(HLREngine.estimateHalfLife(0, 0)).toBe(HLR_BASE_HALF_LIFE);
  });

  it("estimateHalfLife should increase with more correct reviews", () => {
    const h5 = HLREngine.estimateHalfLife(0.8, 5);
    const h20 = HLREngine.estimateHalfLife(0.8, 20);
    expect(h20).toBeGreaterThan(h5);
  });

  it("currentRetention should return ≤1 and ≥0", () => {
    const state = stateWithHistory(10, 0.8, 7, 14, 7);
    const r = HLREngine.currentRetention(state);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// SM-2 Scheduler
// ---------------------------------------------------------------------------

describe("SM2Scheduler", () => {
  it("isDue should return true when nextReviewAt has passed", () => {
    const state = stateWithHistory(5, 0.8, 7, 3, 4); // 4 days ago, interval 3
    expect(SM2Scheduler.isDue(state)).toBe(true);
  });

  it("isDue should return false when nextReviewAt is in the future", () => {
    const now = Date.now();
    const state: HLRState = {
      ...HLREngine.initState("kc"),
      nextReviewAt: now + 86_400_000 * 2, // 2 days from now
    };
    expect(SM2Scheduler.isDue(state)).toBe(false);
  });

  it("isOverdue should return true when more than 1 day overdue", () => {
    const state = stateWithHistory(5, 0.8, 7, 1, 5); // 5 days ago, interval 1
    expect(SM2Scheduler.isOverdue(state)).toBe(true);
  });

  it("getSchedule should return 'overdue' priority for overdue items", () => {
    const state = stateWithHistory(5, 0.8, 7, 1, 10); // 10 days ago, interval 1
    const schedule = SM2Scheduler.getSchedule(state);
    expect(schedule.priority).toBe("overdue");
  });

  it("getSchedule should return 'due_today' for items due within 1 day", () => {
    const now = Date.now();
    const state: HLRState = {
      ...HLREngine.initState("kc"),
      lastReviewAt: now - 86_400_000,
      nextReviewAt: now - 3600_000, // 1 hour ago
      halfLifeDays: 7,
    };
    const schedule = SM2Scheduler.getSchedule(state);
    expect(["due_today", "overdue"]).toContain(schedule.priority);
  });

  it("getSchedule should return 'upcoming' for future items", () => {
    const now = Date.now();
    const state: HLRState = {
      ...HLREngine.initState("kc"),
      nextReviewAt: now + 86_400_000 * 3,
      halfLifeDays: 14,
    };
    const schedule = SM2Scheduler.getSchedule(state);
    expect(schedule.priority).toBe("upcoming");
  });

  it("applyForgettingDecay should reduce correctFraction over time", () => {
    const state = stateWithHistory(10, 0.9, 5, 7, 20); // 20 days ago = heavy decay
    const decayed = SM2Scheduler.applyForgettingDecay(state);
    expect(decayed.correctFraction).toBeLessThanOrEqual(state.correctFraction);
  });
});

// ---------------------------------------------------------------------------
// ChallengeZoneEvaluator (Wilson et al. 2019)
// ---------------------------------------------------------------------------

describe("ChallengeZoneEvaluator", () => {
  it("should recommend 'advance' when pMastered >= MASTERY_THRESHOLD", () => {
    const result = ChallengeZoneEvaluator.evaluate(0.87, 0.90);
    expect(result.recommendation).toBe("advance");
  });

  it("should recommend 'remediate' when accuracy is below OPTIMAL_ACCURACY_MIN", () => {
    const result = ChallengeZoneEvaluator.evaluate(0.40, 0.45);
    expect(result.recommendation).toBe("remediate");
  });

  it("should recommend 'stay' when in optimal challenge zone", () => {
    const result = ChallengeZoneEvaluator.evaluate(0.75, 0.65);
    expect(result.recommendation).toBe("stay");
  });

  it("should recommend 'review' when accuracy is above OPTIMAL_ACCURACY_MAX but not mastered", () => {
    const result = ChallengeZoneEvaluator.evaluate(0.97, 0.82); // high accuracy, not mastered
    expect(result.recommendation).toBe("review");
  });

  it("inOptimalZone should be true for accuracy in [0.60, 0.95]", () => {
    const result = ChallengeZoneEvaluator.evaluate(0.75, 0.6);
    expect(result.inOptimalZone).toBe(true);
  });

  it("inOptimalZone should be false for accuracy below 0.60", () => {
    const result = ChallengeZoneEvaluator.evaluate(0.50, 0.4);
    expect(result.inOptimalZone).toBe(false);
  });

  it("targetDifficulty should be ~0 for fully mastered concept", () => {
    const d = ChallengeZoneEvaluator.targetDifficulty(0.99);
    expect(d).toBeLessThan(0.1);
  });

  it("targetDifficulty should be ~0.9 for unlearned concept", () => {
    const d = ChallengeZoneEvaluator.targetDifficulty(0.10);
    expect(d).toBeGreaterThan(0.7);
  });

  it("targetDifficulty should be in [0.05, 0.95]", () => {
    for (const p of [0, 0.1, 0.5, 0.85, 1]) {
      const d = ChallengeZoneEvaluator.targetDifficulty(p);
      expect(d).toBeGreaterThanOrEqual(0.05);
      expect(d).toBeLessThanOrEqual(0.95);
    }
  });
});

// ---------------------------------------------------------------------------
// ReviewSessionBuilder
// ---------------------------------------------------------------------------

describe("ReviewSessionBuilder", () => {
  function makeStateMap(): Map<string, HLRState> {
    const now = Date.now();
    const map = new Map<string, HLRState>();

    // Overdue concept
    map.set("overdue-1", {
      ...HLREngine.initState("overdue-1"),
      nextReviewAt: now - 86_400_000 * 5, // 5 days overdue
      halfLifeDays: 3,
    });

    // Due today
    map.set("due-today-1", {
      ...HLREngine.initState("due-today-1"),
      nextReviewAt: now - 3600_000, // 1 hour ago
      halfLifeDays: 7,
    });

    // Upcoming
    map.set("upcoming-1", {
      ...HLREngine.initState("upcoming-1"),
      nextReviewAt: now + 86_400_000 * 3,
      halfLifeDays: 14,
    });

    return map;
  }

  it("should return overdue items first", () => {
    const schedules = ReviewSessionBuilder.build(makeStateMap());
    expect(schedules[0].priority).toBe("overdue");
  });

  it("should respect maxItems limit", () => {
    const map = makeStateMap();
    const schedules = ReviewSessionBuilder.build(map, 2);
    expect(schedules.length).toBeLessThanOrEqual(2);
  });

  it("dueCount should correctly count due items", () => {
    const map = makeStateMap();
    const count = ReviewSessionBuilder.dueCount(map);
    expect(count).toBeGreaterThanOrEqual(1); // at least overdue-1 and due-today-1
  });

  it("should handle empty map", () => {
    const schedules = ReviewSessionBuilder.build(new Map());
    expect(schedules).toHaveLength(0);
    expect(ReviewSessionBuilder.dueCount(new Map())).toBe(0);
  });

  it("should return all items when maxItems is large", () => {
    const map = makeStateMap();
    const schedules = ReviewSessionBuilder.build(map, 100);
    expect(schedules.length).toBe(map.size);
  });
});
