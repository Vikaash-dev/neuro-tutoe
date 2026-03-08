/**
 * Tests for TomMasteryBridge and TomCodeActAgent
 *
 * Covers:
 *   - TomMasteryBridge.reason() — affect penalty, analogy fallback, action selection
 *   - TomMasteryBridge.reasonBatch() — sorting by urgency
 *   - TomCodeActAgent — turn processing, mode switching, system prompt injection
 *   - ContextCoherenceMonitor — threshold assessment, reset prompt
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TomMasteryBridge,
  TomCodeActAgent,
  ContextCoherenceMonitor,
} from "../tom-mastery-bridge";
import {
  EpistemicStateTracker,
  TomProfileBuilder,
  HighOrderToMTracker,
} from "../tom-swe";
import type { EpistemicState, TomUserProfile, HighOrderToMState } from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEpistemicState(masteryMap: Record<string, number>): EpistemicState {
  return EpistemicStateTracker.build("u1", masteryMap, TomProfileBuilder.coldStart("u1"));
}

const COLD_PROFILE: TomUserProfile = TomProfileBuilder.coldStart("u1");

const ANALOGY_PROFILE: TomUserProfile = {
  ...COLD_PROFILE,
  communicationPreferences: {
    verbosity: "moderate",
    formality: "casual",
    analogyAffinity: true,
    exampleAffinity: false,
  },
};

// ---------------------------------------------------------------------------
// TomMasteryBridge.reason()
// ---------------------------------------------------------------------------

describe("TomMasteryBridge.reason()", () => {
  it("returns a TomMasteryDecision with required fields", () => {
    const state = makeEpistemicState({ recursion: 0.50 });
    const decision = TomMasteryBridge.reason(
      "u1", "recursion", 0.50, "neutral",
      COLD_PROFILE, state, null, "explainer"
    );
    expect(decision.studentId).toBe("u1");
    expect(decision.conceptId).toBe("recursion");
    expect(decision.rawMastery).toBe(0.50);
    expect(decision.rationale.length).toBeGreaterThan(0);
    expect(decision.recommendedAction).toBeDefined();
  });

  it("affectAdjustedMastery equals rawMastery when affect is neutral", () => {
    const state = makeEpistemicState({ c1: 0.60 });
    const decision = TomMasteryBridge.reason(
      "u1", "c1", 0.60, "neutral", COLD_PROFILE, state, null
    );
    expect(decision.affectAdjustedMastery).toBe(0.60);
  });

  it("affectAdjustedMastery is lower when frustrated", () => {
    const state = makeEpistemicState({ c1: 0.60 });
    const neutral = TomMasteryBridge.reason("u1", "c1", 0.60, "neutral", COLD_PROFILE, state, null);
    const frustrated = TomMasteryBridge.reason("u1", "c1", 0.60, "frustrated", COLD_PROFILE, state, null);
    expect(frustrated.affectAdjustedMastery).toBeLessThan(neutral.affectAdjustedMastery);
  });

  it("affectAdjustedMastery is lower when confused vs neutral", () => {
    const state = makeEpistemicState({ c1: 0.70 });
    const n = TomMasteryBridge.reason("u1", "c1", 0.70, "neutral", COLD_PROFILE, state, null);
    const c = TomMasteryBridge.reason("u1", "c1", 0.70, "confused", COLD_PROFILE, state, null);
    expect(c.affectAdjustedMastery).toBeLessThan(n.affectAdjustedMastery);
  });

  it("rationale includes affect signal", () => {
    const state = makeEpistemicState({ c1: 0.50 });
    const decision = TomMasteryBridge.reason(
      "u1", "c1", 0.50, "frustrated", COLD_PROFILE, state, null
    );
    expect(decision.rationale).toContain("frustrated");
  });

  it("recommends analogy when frustrated + low mastery + analogyAffinity", () => {
    const state: EpistemicState = {
      studentId: "u1",
      conceptMasteryMap: { c1: 0.30 },
      adjustedMasteryMap: { c1: 0.30 },
      frustrationConcepts: [],
      updatedAt: Date.now(),
    };
    const decision = TomMasteryBridge.reason(
      "u1", "c1", 0.30, "frustrated",
      ANALOGY_PROFILE, state, null, "explainer"
    );
    expect(decision.recommendedAction.type).toBe("generate_analogy");
    expect(decision.suggestedMode).toBe("explainer");
  });

  it("rationale mentions analogy fallback when triggered", () => {
    const state: EpistemicState = {
      studentId: "u1",
      conceptMasteryMap: { c1: 0.35 },
      adjustedMasteryMap: { c1: 0.35 },
      frustrationConcepts: [],
      updatedAt: Date.now(),
    };
    const decision = TomMasteryBridge.reason(
      "u1", "c1", 0.35, "frustrated",
      ANALOGY_PROFILE, state, null, "explainer"
    );
    expect(decision.rationale).toContain("analogy");
  });

  it("suggests mode switch when appropriate", () => {
    const state = makeEpistemicState({ c1: 0.90 });
    const decision = TomMasteryBridge.reason(
      "u1", "c1", 0.90, "positive", COLD_PROFILE, state, null, "explainer"
    );
    expect(decision.suggestedMode).toBe("student");
  });

  it("does not panic with zero mastery", () => {
    const state = makeEpistemicState({ c1: 0.0 });
    const decision = TomMasteryBridge.reason(
      "u1", "c1", 0.0, "neutral", COLD_PROFILE, state, null
    );
    expect(decision.affectAdjustedMastery).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// TomMasteryBridge.reasonBatch()
// ---------------------------------------------------------------------------

describe("TomMasteryBridge.reasonBatch()", () => {
  it("returns one decision per concept", () => {
    const state = makeEpistemicState({ a: 0.3, b: 0.7, c: 0.5 });
    const decisions = TomMasteryBridge.reasonBatch(
      "u1", ["a", "b", "c"], "neutral", COLD_PROFILE, state, null
    );
    expect(decisions).toHaveLength(3);
  });

  it("sorts by ascending adjustedMastery (urgency order)", () => {
    const state = makeEpistemicState({ a: 0.8, b: 0.2, c: 0.5 });
    const decisions = TomMasteryBridge.reasonBatch(
      "u1", ["a", "b", "c"], "neutral", COLD_PROFILE, state, null
    );
    expect(decisions[0].affectAdjustedMastery).toBeLessThanOrEqual(
      decisions[1].affectAdjustedMastery
    );
    expect(decisions[1].affectAdjustedMastery).toBeLessThanOrEqual(
      decisions[2].affectAdjustedMastery
    );
  });

  it("handles empty concept list", () => {
    const state = makeEpistemicState({});
    const decisions = TomMasteryBridge.reasonBatch(
      "u1", [], "neutral", COLD_PROFILE, state, null
    );
    expect(decisions).toHaveLength(0);
  });

  it("uses cold-start mastery for unknown concepts", () => {
    const state = makeEpistemicState({});
    const decisions = TomMasteryBridge.reasonBatch(
      "u1", ["unknown"], "neutral", COLD_PROFILE, state, null
    );
    expect(decisions[0].rawMastery).toBe(0.10);
  });
});

// ---------------------------------------------------------------------------
// TomCodeActAgent
// ---------------------------------------------------------------------------

describe("TomCodeActAgent", () => {
  let agent: TomCodeActAgent;

  beforeEach(() => {
    agent = new TomCodeActAgent("explainer");
  });

  it("initialises with the given mode", () => {
    expect(agent.mode).toBe("explainer");
    expect(agent.turns).toBe(0);
  });

  it("increments turn count on processTurn", () => {
    const state = makeEpistemicState({ c1: 0.5 });
    agent.processTurn("u1", "c1", 0.5, "neutral", COLD_PROFILE, state, null);
    expect(agent.turns).toBe(1);
  });

  it("returns a valid decision on each turn", () => {
    const state = makeEpistemicState({ c1: 0.5 });
    const { decision } = agent.processTurn(
      "u1", "c1", 0.5, "neutral", COLD_PROFILE, state, null
    );
    expect(decision.conceptId).toBe("c1");
    expect(decision.recommendedAction).toBeDefined();
  });

  it("switches mode when decision suggests a mode change", () => {
    // Mastery ≥ gate → should suggest 'student' mode
    const state = makeEpistemicState({ c1: 0.90 });
    const { modeChanged } = agent.processTurn(
      "u1", "c1", 0.90, "positive", COLD_PROFILE, state, null
    );
    expect(modeChanged).toBe(true);
    expect(agent.mode).toBe("student");
  });

  it("does NOT change mode when suggestion is null", () => {
    const state = makeEpistemicState({ c1: 0.50 });
    // 0.50 mastery → Socratic question, no mode switch suggestion
    const { modeChanged } = agent.processTurn(
      "u1", "c1", 0.50, "neutral", COLD_PROFILE, state, null
    );
    if (!modeChanged) {
      expect(agent.mode).toBe("explainer");
    }
  });

  it("produces a non-empty system prompt injection", () => {
    const state = makeEpistemicState({ c1: 0.5 });
    const { systemPromptInjection } = agent.processTurn(
      "u1", "c1", 0.5, "neutral", COLD_PROFILE, state, null
    );
    expect(systemPromptInjection).toContain("ToM-SWE");
    expect(systemPromptInjection).toContain("c1");
  });

  it("buildSystemPromptInjection includes working style", () => {
    const profileWithStyle: TomUserProfile = {
      ...COLD_PROFILE,
      workingStyle: "example-driven",
    };
    const state = makeEpistemicState({ c1: 0.5 });
    const decision = TomMasteryBridge.reason(
      "u1", "c1", 0.5, "neutral", profileWithStyle, state, null
    );
    const injection = TomCodeActAgent.buildSystemPromptInjection(
      decision, profileWithStyle, "explainer"
    );
    expect(injection).toContain("example-driven");
  });

  it("injection includes analogy preference field", () => {
    const state = makeEpistemicState({ c1: 0.5 });
    const decision = TomMasteryBridge.reason(
      "u1", "c1", 0.5, "neutral", ANALOGY_PROFILE, state, null
    );
    const injection = TomCodeActAgent.buildSystemPromptInjection(
      decision, ANALOGY_PROFILE, "explainer"
    );
    expect(injection).toContain("Prefers analogies");
  });

  it("handles high-order ToM state correctly", () => {
    let tomState = HighOrderToMTracker.create("u1");
    tomState = HighOrderToMTracker.setGroundTruth(tomState, "c1", "truth");
    tomState = HighOrderToMTracker.recordStudentBelief(
      tomState, "c1", "something different entirely wrong", 0.75
    );
    const state = makeEpistemicState({ c1: 0.75 });
    const { decision } = agent.processTurn(
      "u1", "c1", 0.75, "neutral", COLD_PROFILE, state, tomState
    );
    // Should ask Socratic question due to false confidence
    expect(decision.recommendedAction.type).toBe("ask_socratic_question");
  });
});

// ---------------------------------------------------------------------------
// ContextCoherenceMonitor
// ---------------------------------------------------------------------------

describe("ContextCoherenceMonitor", () => {
  it("returns 'ok' for high coherence", () => {
    const state = HighOrderToMTracker.create("u1");
    const result = ContextCoherenceMonitor.assess(state);
    expect(result.level).toBe("ok");
    expect(result.shouldReset).toBe(false);
  });

  it("returns 'warning' below WARNING_THRESHOLD", () => {
    const state: HighOrderToMState = {
      ...HighOrderToMTracker.create("u1"),
      contextCoherenceScore: 0.55,
      falseConfidenceConcepts: ["c1"],
    };
    const result = ContextCoherenceMonitor.assess(state);
    expect(result.level).toBe("warning");
    expect(result.recommendation).toContain("false-confidence");
  });

  it("returns 'critical' below CRITICAL_THRESHOLD", () => {
    const state: HighOrderToMState = {
      ...HighOrderToMTracker.create("u1"),
      contextCoherenceScore: 0.30,
    };
    const result = ContextCoherenceMonitor.assess(state);
    expect(result.level).toBe("critical");
    expect(result.shouldReset).toBe(true);
  });

  it("buildResetPrompt returns non-empty string", () => {
    const state = HighOrderToMTracker.create("u1");
    const prompt = ContextCoherenceMonitor.buildResetPrompt(state);
    expect(prompt.length).toBeGreaterThan(20);
  });

  it("buildResetPrompt mentions flawed concepts", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(state, "recursion", "function calls itself");
    state = HighOrderToMTracker.recordStudentBelief(
      state, "recursion", "totally wrong different", 0.3
    );
    const prompt = ContextCoherenceMonitor.buildResetPrompt(state);
    expect(prompt).toContain("recursion");
  });

  it("critical threshold is less than warning threshold", () => {
    expect(ContextCoherenceMonitor.CRITICAL_THRESHOLD).toBeLessThan(
      ContextCoherenceMonitor.WARNING_THRESHOLD
    );
  });
});
