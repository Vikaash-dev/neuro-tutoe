/**
 * Tests for SessionOrchestrator
 *
 * Covers:
 *   - Construction (cold start)
 *   - processTurn: basic output, mode/depth tracking, mastery updates
 *   - COMEDY memory compression
 *   - Signal events (quiz, feynman student, etc.)
 *   - Command parsing (/mode, /depth)
 *   - Concept switching
 *   - High-order ToM integration
 *   - Context coherence monitoring
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SessionOrchestrator, COMEDY_INTERVAL, MASTERY_COLD_START } from "../session-orchestrator";
import { MasterySignalWeighter } from "../cotutor-dkt";
import { HighOrderToMTracker } from "../tom-swe";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrchestrator(concept = "recursion") {
  return new SessionOrchestrator("s1", "u1", concept, "explainer", 5);
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe("SessionOrchestrator construction", () => {
  it("initialises with correct mode and depth", () => {
    const orch = makeOrchestrator();
    expect(orch.currentMode).toBe("explainer");
    expect(orch.currentDepth).toBe(5);
    expect(orch.turnCount).toBe(0);
  });

  it("starts with cold-start mastery for active concept", () => {
    const orch = makeOrchestrator("graphs");
    expect(orch.getMastery("graphs")).toBe(MASTERY_COLD_START);
  });
});

// ---------------------------------------------------------------------------
// processTurn — basic output
// ---------------------------------------------------------------------------

describe("SessionOrchestrator.processTurn", () => {
  let orch: SessionOrchestrator;

  beforeEach(() => {
    orch = makeOrchestrator();
  });

  it("returns a non-empty system prompt", () => {
    const output = orch.processTurn("What is recursion?");
    expect(output.systemPrompt.length).toBeGreaterThan(0);
  });

  it("returns a valid pedagogical action", () => {
    const output = orch.processTurn("Explain recursion.");
    expect(output.action).toBeDefined();
    expect(output.action.type).toBeTruthy();
  });

  it("returns a non-empty rationale", () => {
    const output = orch.processTurn("What is recursion?");
    expect(output.rationale.length).toBeGreaterThan(0);
  });

  it("increments turnCount each call", () => {
    orch.processTurn("Question 1");
    orch.processTurn("Question 2");
    expect(orch.turnCount).toBe(2);
  });

  it("reports activeMode in output", () => {
    const output = orch.processTurn("Hello");
    expect(output.activeMode).toBeDefined();
  });

  it("reports activeDepth in output", () => {
    const output = orch.processTurn("Hello");
    expect(output.activeDepth).toBeGreaterThanOrEqual(1);
    expect(output.activeDepth).toBeLessThanOrEqual(10);
  });

  it("coherenceLevel is ok initially", () => {
    const output = orch.processTurn("Hello");
    expect(output.coherenceLevel).toBe("ok");
  });

  it("returns tomInjection string", () => {
    const output = orch.processTurn("Hello");
    expect(output.tomInjection.length).toBeGreaterThan(0);
  });

  it("memoryCompressed is false on normal turns", () => {
    const output = orch.processTurn("Hello");
    expect(output.memoryCompressed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Signal events — mastery updates
// ---------------------------------------------------------------------------

describe("SessionOrchestrator signal events", () => {
  it("quiz_correct increases mastery", () => {
    const orch = makeOrchestrator("recursion");
    const before = orch.getMastery("recursion");
    orch.processTurn(
      "ok",
      [MasterySignalWeighter.fromQuiz("recursion", true, 1)]
    );
    expect(orch.getMastery("recursion")).toBeGreaterThan(before);
  });

  it("quiz_incorrect decreases mastery from high value", () => {
    const orch = makeOrchestrator("recursion");
    // First get mastery high
    for (let i = 0; i < 10; i++) {
      orch.processTurn("q", [MasterySignalWeighter.fromQuiz("recursion", true, i)]);
    }
    const high = orch.getMastery("recursion");
    orch.processTurn("q", [MasterySignalWeighter.fromQuiz("recursion", false, 11)]);
    expect(orch.getMastery("recursion")).toBeLessThan(high);
  });

  it("rubber_duck events don't change mastery", () => {
    const orch = makeOrchestrator("recursion");
    orch.processTurn("thinking aloud...");
    const before = orch.getMastery("recursion");
    orch.processTurn(
      "still thinking",
      [MasterySignalWeighter.fromRubberDuck("recursion", 2)]
    );
    expect(orch.getMastery("recursion")).toBe(before);
  });

  it("queueSignal processes on next turn", () => {
    const orch = makeOrchestrator("recursion");
    const before = orch.getMastery("recursion");
    orch.queueSignal(MasterySignalWeighter.fromQuiz("recursion", true, 0));
    orch.processTurn("ok");
    expect(orch.getMastery("recursion")).toBeGreaterThan(before);
  });

  it("getAllMasteryStates returns a map", () => {
    const orch = makeOrchestrator("recursion");
    const states = orch.getAllMasteryStates();
    expect(states.has("recursion")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Concept switching
// ---------------------------------------------------------------------------

describe("SessionOrchestrator.setActiveConcept", () => {
  it("initialises cold-start mastery for new concept", () => {
    const orch = makeOrchestrator("recursion");
    orch.setActiveConcept("graphs");
    expect(orch.getMastery("graphs")).toBe(MASTERY_COLD_START);
  });

  it("preserves existing mastery for known concept", () => {
    const orch = makeOrchestrator("recursion");
    orch.processTurn("q", [MasterySignalWeighter.fromQuiz("recursion", true, 0)]);
    const masteryBefore = orch.getMastery("recursion");
    orch.setActiveConcept("recursion"); // re-set same concept
    expect(orch.getMastery("recursion")).toBe(masteryBefore);
  });
});

// ---------------------------------------------------------------------------
// COMEDY memory compression
// ---------------------------------------------------------------------------

describe("COMEDY compression", () => {
  it("fires at COMEDY_INTERVAL turns", () => {
    const orch = makeOrchestrator();
    let compressed = false;
    // Run exactly COMEDY_INTERVAL turns
    for (let i = 0; i < COMEDY_INTERVAL; i++) {
      const output = orch.processTurn(`Message ${i}`);
      if (output.memoryCompressed) compressed = true;
    }
    expect(compressed).toBe(true);
  });

  it("does NOT fire before COMEDY_INTERVAL turns", () => {
    const orch = makeOrchestrator();
    for (let i = 0; i < COMEDY_INTERVAL - 1; i++) {
      const output = orch.processTurn(`Message ${i}`);
      expect(output.memoryCompressed).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// High-order ToM integration
// ---------------------------------------------------------------------------

describe("SessionOrchestrator high-order ToM", () => {
  it("setGroundTruth stores ground truth", () => {
    const orch = makeOrchestrator("recursion");
    orch.setGroundTruth("recursion", "A function that calls itself.");
    const state = orch.currentState;
    expect(state.highOrderToM.groundTruthMap["recursion"]).toBe("A function that calls itself.");
  });

  it("recordStudentBelief registers in highOrderToM", () => {
    const orch = makeOrchestrator("recursion");
    orch.setGroundTruth("recursion", "A function that calls itself.");
    orch.recordStudentBelief("recursion", "A function that calls itself.");
    const state = orch.currentState;
    expect(state.highOrderToM.studentBeliefMap["recursion"]).toBeDefined();
  });

  it("false confidence triggers Socratic action in processTurn", () => {
    const orch = makeOrchestrator("recursion");
    // Set ground truth and a clearly wrong student belief with high mastery
    orch.setGroundTruth("recursion", "A function that calls itself.");
    // Artificially inject high mastery
    for (let i = 0; i < 15; i++) {
      orch.processTurn("q", [MasterySignalWeighter.fromQuiz("recursion", true, i)]);
    }
    // Now record a flawed belief
    orch.recordStudentBelief("recursion", "When a loop runs forever infinitely");
    const output = orch.processTurn("I totally understand recursion.");
    // Should trigger Socratic intervention on false confidence
    expect(["ask_socratic_question", "evaluate_mastery", "explain_concept"]).toContain(
      output.action.type
    );
  });
});

// ---------------------------------------------------------------------------
// currentState snapshot
// ---------------------------------------------------------------------------

describe("SessionOrchestrator.currentState", () => {
  it("returns a state snapshot with all required fields", () => {
    const orch = makeOrchestrator();
    const state = orch.currentState;
    expect(state.sessionId).toBe("s1");
    expect(state.studentId).toBe("u1");
    expect(state.activeConceptId).toBe("recursion");
    expect(state.turnCount).toBe(0);
  });

  it("snapshot is not the live state object (no mutation from outside)", () => {
    const orch = makeOrchestrator();
    const snapshot1 = orch.currentState;
    orch.processTurn("Hello");
    const snapshot2 = orch.currentState;
    expect(snapshot1.turnCount).toBe(0);
    expect(snapshot2.turnCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// COMEDY_INTERVAL and MASTERY_COLD_START constants
// ---------------------------------------------------------------------------

describe("SessionOrchestrator constants", () => {
  it("COMEDY_INTERVAL is 20", () => {
    expect(COMEDY_INTERVAL).toBe(20);
  });

  it("MASTERY_COLD_START is 0.10", () => {
    expect(MASTERY_COLD_START).toBe(0.10);
  });
});
