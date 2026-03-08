/**
 * Tests for CoTutor DKT (control-theoretic knowledge tracing)
 *
 * Covers:
 *   - CoTutorDKT.createState, processEvent, adaptGain, predictRetention, getTrend
 *   - DifficultyAdjuster.recommend, hasPassedMasteryGate, recommendPracticeCount
 *   - MasterySignalWeighter (all signal sources)
 *   - MASTERY_SIGNAL_WEIGHTS table integrity
 */

import { describe, it, expect } from "vitest";
import {
  CoTutorDKT,
  DifficultyAdjuster,
  MasterySignalWeighter,
  MASTERY_SIGNAL_WEIGHTS,
  KALMAN_GAIN_DEFAULT,
  COTUTOR_BKT_PARAMS,
  OPTIMAL_MASTERY_ZONE,
  MASTERY_GATE_THRESHOLD,
  type CoTutorMasteryState,
  type SignalEvent,
} from "../cotutor-dkt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function quizEvent(
  conceptId: string,
  correct: boolean,
  turnIndex = 1
): SignalEvent {
  return MasterySignalWeighter.fromQuiz(conceptId, correct, turnIndex);
}

// ---------------------------------------------------------------------------
// CoTutorDKT.createState
// ---------------------------------------------------------------------------

describe("CoTutorDKT.createState", () => {
  it("creates cold-start state with p=0.10", () => {
    const state = CoTutorDKT.createState("c1");
    expect(state.pMastered).toBe(0.10);
    expect(state.totalEvents).toBe(0);
    expect(state.history).toHaveLength(0);
  });

  it("accepts a custom pInit", () => {
    const state = CoTutorDKT.createState("c1", 0.5);
    expect(state.pMastered).toBe(0.5);
  });

  it("sets default Kalman gain", () => {
    const state = CoTutorDKT.createState("c1");
    expect(state.kalmanGain).toBeCloseTo(KALMAN_GAIN_DEFAULT);
  });
});

// ---------------------------------------------------------------------------
// CoTutorDKT.processEvent
// ---------------------------------------------------------------------------

describe("CoTutorDKT.processEvent", () => {
  it("increases mastery on quiz_correct", () => {
    let state = CoTutorDKT.createState("c1");
    state = CoTutorDKT.processEvent(state, quizEvent("c1", true));
    expect(state.pMastered).toBeGreaterThan(0.10);
  });

  it("decreases mastery on quiz_incorrect", () => {
    let state = CoTutorDKT.createState("c1", 0.70);
    state = CoTutorDKT.processEvent(state, quizEvent("c1", false));
    expect(state.pMastered).toBeLessThan(0.70);
  });

  it("no change for rubber_duck events", () => {
    let state = CoTutorDKT.createState("c1", 0.50);
    const before = state.pMastered;
    state = CoTutorDKT.processEvent(
      state,
      MasterySignalWeighter.fromRubberDuck("c1", 1)
    );
    expect(state.pMastered).toBe(before);
  });

  it("feynman_student event at score=1.0 increases mastery", () => {
    let state = CoTutorDKT.createState("c1", 0.30);
    state = CoTutorDKT.processEvent(
      state,
      MasterySignalWeighter.fromFeynmanStudent("c1", 1.0, 2)
    );
    expect(state.pMastered).toBeGreaterThan(0.30);
  });

  it("socratic_hint_needed decreases mastery", () => {
    let state = CoTutorDKT.createState("c1", 0.50);
    state = CoTutorDKT.processEvent(
      state,
      MasterySignalWeighter.fromSocraticHint("c1", 1)
    );
    expect(state.pMastered).toBeLessThan(0.50);
  });

  it("mastery never exceeds 1.0", () => {
    let state = CoTutorDKT.createState("c1", 0.99);
    for (let i = 0; i < 10; i++) {
      state = CoTutorDKT.processEvent(state, quizEvent("c1", true, i));
    }
    expect(state.pMastered).toBeLessThanOrEqual(1.0);
  });

  it("mastery never falls below 0", () => {
    let state = CoTutorDKT.createState("c1", 0.01);
    for (let i = 0; i < 10; i++) {
      state = CoTutorDKT.processEvent(state, quizEvent("c1", false, i));
    }
    expect(state.pMastered).toBeGreaterThanOrEqual(0);
  });

  it("increments totalEvents on each call", () => {
    let state = CoTutorDKT.createState("c1");
    state = CoTutorDKT.processEvent(state, quizEvent("c1", true, 1));
    state = CoTutorDKT.processEvent(state, quizEvent("c1", false, 2));
    expect(state.totalEvents).toBe(2);
  });

  it("appends to history on non-rubber-duck event", () => {
    let state = CoTutorDKT.createState("c1");
    state = CoTutorDKT.processEvent(state, quizEvent("c1", true, 1));
    expect(state.history).toHaveLength(1);
    expect(state.history[0].source).toBe("quiz_correct");
  });

  it("does NOT append to history on rubber_duck event", () => {
    let state = CoTutorDKT.createState("c1");
    state = CoTutorDKT.processEvent(
      state,
      MasterySignalWeighter.fromRubberDuck("c1", 1)
    );
    expect(state.history).toHaveLength(0);
  });

  it("multiple correct events converge toward 1.0", () => {
    let state = CoTutorDKT.createState("c1");
    for (let i = 0; i < 20; i++) {
      state = CoTutorDKT.processEvent(state, quizEvent("c1", true, i));
    }
    expect(state.pMastered).toBeGreaterThan(0.8);
  });
});

// ---------------------------------------------------------------------------
// CoTutorDKT.adaptGain
// ---------------------------------------------------------------------------

describe("CoTutorDKT.adaptGain", () => {
  it("returns default gain when totalEvents < 5", () => {
    expect(CoTutorDKT.adaptGain(KALMAN_GAIN_DEFAULT, 3)).toBeCloseTo(KALMAN_GAIN_DEFAULT);
  });

  it("decreases gain after many events", () => {
    const before = CoTutorDKT.adaptGain(KALMAN_GAIN_DEFAULT, 5);
    const after = CoTutorDKT.adaptGain(KALMAN_GAIN_DEFAULT, 20);
    expect(after).toBeLessThan(before);
  });

  it("never falls below 0.20 floor", () => {
    const floor = CoTutorDKT.adaptGain(KALMAN_GAIN_DEFAULT, 1000);
    expect(floor).toBeGreaterThanOrEqual(0.20);
  });
});

// ---------------------------------------------------------------------------
// CoTutorDKT.predictRetention
// ---------------------------------------------------------------------------

describe("CoTutorDKT.predictRetention", () => {
  it("returns 1.0 at t=0", () => {
    const state = CoTutorDKT.createState("c1", 0.8);
    expect(CoTutorDKT.predictRetention(state, 0)).toBeCloseTo(1.0);
  });

  it("decreases with elapsed days", () => {
    const state = CoTutorDKT.createState("c1", 0.5);
    const r1 = CoTutorDKT.predictRetention(state, 1);
    const r7 = CoTutorDKT.predictRetention(state, 7);
    expect(r7).toBeLessThan(r1);
  });

  it("higher mastery → slower forgetting (longer half-life)", () => {
    const low = CoTutorDKT.createState("c1", 0.2);
    const high = CoTutorDKT.createState("c1", 0.9);
    const rLow = CoTutorDKT.predictRetention(low, 5);
    const rHigh = CoTutorDKT.predictRetention(high, 5);
    expect(rHigh).toBeGreaterThan(rLow);
  });
});

// ---------------------------------------------------------------------------
// CoTutorDKT.getTrend
// ---------------------------------------------------------------------------

describe("CoTutorDKT.getTrend", () => {
  it("returns 'stable' with no history", () => {
    const state = CoTutorDKT.createState("c1");
    expect(CoTutorDKT.getTrend(state)).toBe("stable");
  });

  it("returns 'improving' after consistent correct answers", () => {
    // Start at 0.1 and do 3 correct events — mastery rises ~0.775 → 0.944 → 0.986
    // Delta within history window = 0.986 - 0.775 > 0.08 → "improving"
    let state = CoTutorDKT.createState("c1", 0.1);
    for (let i = 0; i < 3; i++) {
      state = CoTutorDKT.processEvent(state, quizEvent("c1", true, i));
    }
    expect(CoTutorDKT.getTrend(state)).toBe("improving");
  });

  it("returns 'declining' after consistent wrong answers", () => {
    // Start at 0.7 and do 3 incorrect events — mastery drops ~0.175 → 0.044 → 0.011
    // Delta within history window < -0.08 → "declining"
    let state = CoTutorDKT.createState("c1", 0.7);
    for (let i = 0; i < 3; i++) {
      state = CoTutorDKT.processEvent(state, quizEvent("c1", false, i));
    }
    expect(CoTutorDKT.getTrend(state)).toBe("declining");
  });
});

// ---------------------------------------------------------------------------
// DifficultyAdjuster
// ---------------------------------------------------------------------------

describe("DifficultyAdjuster.recommend", () => {
  it("raises difficulty when mastery > upper zone", () => {
    const { direction, newDepth } = DifficultyAdjuster.recommend(0.95, 5);
    expect(direction).toBe("raise");
    expect(newDepth).toBe(6);
  });

  it("lowers difficulty when mastery < lower zone", () => {
    const { direction, newDepth } = DifficultyAdjuster.recommend(0.40, 5);
    expect(direction).toBe("lower");
    expect(newDepth).toBe(4);
  });

  it("maintains difficulty in optimal zone", () => {
    const { direction, newDepth } = DifficultyAdjuster.recommend(0.75, 5);
    expect(direction).toBe("maintain");
    expect(newDepth).toBe(5);
  });

  it("does not exceed depth 10", () => {
    const { newDepth } = DifficultyAdjuster.recommend(0.99, 10);
    expect(newDepth).toBeLessThanOrEqual(10);
  });

  it("does not go below depth 1", () => {
    const { newDepth } = DifficultyAdjuster.recommend(0.01, 1);
    expect(newDepth).toBeGreaterThanOrEqual(1);
  });

  it("reason string is non-empty", () => {
    const { reason } = DifficultyAdjuster.recommend(0.5, 5);
    expect(reason.length).toBeGreaterThan(0);
  });
});

describe("DifficultyAdjuster.hasPassedMasteryGate", () => {
  it("true when mastery >= MASTERY_GATE_THRESHOLD", () => {
    expect(DifficultyAdjuster.hasPassedMasteryGate(0.85)).toBe(true);
    expect(DifficultyAdjuster.hasPassedMasteryGate(0.90)).toBe(true);
  });

  it("false when mastery < MASTERY_GATE_THRESHOLD", () => {
    expect(DifficultyAdjuster.hasPassedMasteryGate(0.84)).toBe(false);
    expect(DifficultyAdjuster.hasPassedMasteryGate(0.50)).toBe(false);
  });
});

describe("DifficultyAdjuster.recommendPracticeCount", () => {
  it("returns 3 for overwhelmed students (< 0.30)", () => {
    expect(DifficultyAdjuster.recommendPracticeCount(0.20)).toBe(3);
  });

  it("returns most practice in optimal zone", () => {
    const opt = DifficultyAdjuster.recommendPracticeCount(0.70);
    const easy = DifficultyAdjuster.recommendPracticeCount(0.95);
    expect(opt).toBeGreaterThan(easy);
  });
});

// ---------------------------------------------------------------------------
// MasterySignalWeighter
// ---------------------------------------------------------------------------

describe("MasterySignalWeighter", () => {
  it("fromQuiz correct → quiz_correct source", () => {
    const ev = MasterySignalWeighter.fromQuiz("c1", true, 1);
    expect(ev.source).toBe("quiz_correct");
    expect(ev.rawScore).toBe(1.0);
  });

  it("fromQuiz incorrect → quiz_incorrect source", () => {
    const ev = MasterySignalWeighter.fromQuiz("c1", false, 1);
    expect(ev.source).toBe("quiz_incorrect");
    expect(ev.rawScore).toBe(0.0);
  });

  it("fromFeynmanStudent → feynman_student source", () => {
    const ev = MasterySignalWeighter.fromFeynmanStudent("c1", 0.8, 1);
    expect(ev.source).toBe("feynman_student");
    expect(ev.rawScore).toBe(0.8);
  });

  it("fromFeynmanStudent clamps rawScore to [0,1]", () => {
    expect(MasterySignalWeighter.fromFeynmanStudent("c1", 1.5, 1).rawScore).toBe(1.0);
    expect(MasterySignalWeighter.fromFeynmanStudent("c1", -0.1, 1).rawScore).toBe(0.0);
  });

  it("fromSocraticHint → socratic_hint_needed source", () => {
    const ev = MasterySignalWeighter.fromSocraticHint("c1", 1);
    expect(ev.source).toBe("socratic_hint_needed");
  });

  it("fromRubberDuck → rubber_duck source with rawScore=0", () => {
    const ev = MasterySignalWeighter.fromRubberDuck("c1", 1);
    expect(ev.source).toBe("rubber_duck");
    expect(ev.rawScore).toBe(0);
  });

  it("fromOrganicUsage correct → organic_correct", () => {
    const ev = MasterySignalWeighter.fromOrganicUsage("c1", true, 1);
    expect(ev.source).toBe("organic_correct");
  });

  it("batchWeightedScore returns 0 for empty array", () => {
    expect(MasterySignalWeighter.batchWeightedScore([])).toBe(0);
  });

  it("batchWeightedScore for all-correct quiz events → > 0.5", () => {
    const events = [
      quizEvent("c1", true, 1),
      quizEvent("c1", true, 2),
    ];
    expect(MasterySignalWeighter.batchWeightedScore(events)).toBeGreaterThan(0.5);
  });

  it("batchWeightedScore for rubber_duck events → 0.5 (neutral)", () => {
    const events = [
      MasterySignalWeighter.fromRubberDuck("c1", 1),
      MasterySignalWeighter.fromRubberDuck("c1", 2),
    ];
    expect(MasterySignalWeighter.batchWeightedScore(events)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// MASTERY_SIGNAL_WEIGHTS integrity
// ---------------------------------------------------------------------------

describe("MASTERY_SIGNAL_WEIGHTS table", () => {
  it("quiz_correct has highest positive weight (1.0)", () => {
    expect(MASTERY_SIGNAL_WEIGHTS.quiz_correct).toBe(1.0);
  });

  it("rubber_duck has zero weight", () => {
    expect(MASTERY_SIGNAL_WEIGHTS.rubber_duck).toBe(0.0);
  });

  it("socratic_hint_needed has negative weight", () => {
    expect(MASTERY_SIGNAL_WEIGHTS.socratic_hint_needed).toBeLessThan(0);
  });

  it("feynman_student weight is between 0 and quiz weight", () => {
    const fWeight = MASTERY_SIGNAL_WEIGHTS.feynman_student;
    expect(fWeight).toBeGreaterThan(0);
    expect(fWeight).toBeLessThan(MASTERY_SIGNAL_WEIGHTS.quiz_correct);
  });

  it("all 8 signal sources are defined", () => {
    const expected: (keyof typeof MASTERY_SIGNAL_WEIGHTS)[] = [
      "quiz_correct", "quiz_incorrect", "feynman_student",
      "socratic_hint_needed", "socratic_unprompted",
      "rubber_duck", "organic_correct", "organic_incorrect",
    ];
    expected.forEach((key) => expect(MASTERY_SIGNAL_WEIGHTS).toHaveProperty(key));
  });

  it("OPTIMAL_MASTERY_ZONE lower < upper", () => {
    expect(OPTIMAL_MASTERY_ZONE.lower).toBeLessThan(OPTIMAL_MASTERY_ZONE.upper);
  });

  it("MASTERY_GATE_THRESHOLD equals 0.85 (Bloom)", () => {
    expect(MASTERY_GATE_THRESHOLD).toBe(0.85);
  });

  it("COTUTOR_BKT_PARAMS are valid probabilities", () => {
    const { P_LEARN, P_GUESS, P_SLIP, P_FORGET } = COTUTOR_BKT_PARAMS;
    [P_LEARN, P_GUESS, P_SLIP, P_FORGET].forEach((p) => {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    });
  });
});
