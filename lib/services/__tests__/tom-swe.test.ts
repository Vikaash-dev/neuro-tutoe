/**
 * Tests for ToM-SWE: Three-Tier Memory Architecture
 *
 * Covers:
 *   - SessionCleaner (Tier 1)
 *   - SessionAnalyser (Tier 2)
 *   - TomProfileBuilder (Tier 3)
 *   - HighOrderToMTracker (nested beliefs)
 *   - EpistemicStateTracker
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SessionCleaner,
  SessionAnalyser,
  TomProfileBuilder,
  HighOrderToMTracker,
  EpistemicStateTracker,
  MIN_SESSIONS_FOR_PROFILE,
  COHERENCE_DECAY_PER_CONTRADICTION,
  FALSE_CONFIDENCE_MASTERY_THRESHOLD,
} from "../tom-swe";
import type {
  CleanedSession,
  SessionAnalysis,
  TomUserProfile,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRawMessages(count: number): Array<{ role: string; content: string }> {
  const msgs: Array<{ role: string; content: string }> = [];
  for (let i = 0; i < count; i++) {
    msgs.push({ role: i % 2 === 0 ? "user" : "assistant", content: `Message ${i}` });
  }
  return msgs;
}

// ---------------------------------------------------------------------------
// Tier 1 — SessionCleaner
// ---------------------------------------------------------------------------

describe("SessionCleaner (Tier 1)", () => {
  it("filters messages to user/assistant only", () => {
    const raw = [
      { role: "system",    content: "You are a tutor." },
      { role: "user",      content: "Hello" },
      { role: "assistant", content: "Hi!" },
      { role: "tool",      content: "bash output" },
    ];
    const cleaned = SessionCleaner.clean("s1", raw);
    expect(cleaned.messages).toHaveLength(2);
    expect(cleaned.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("strips emails from messages", () => {
    const raw = [{ role: "user", content: "My email is john@example.com, help me." }];
    const cleaned = SessionCleaner.clean("s1", raw);
    expect(cleaned.messages[0].content).not.toContain("john@example.com");
    expect(cleaned.messages[0].content).toContain("[REDACTED]");
  });

  it("strips phone numbers", () => {
    const raw = [{ role: "user", content: "Call me at 555-123-4567" }];
    const cleaned = SessionCleaner.clean("s1", raw);
    expect(cleaned.messages[0].content).not.toContain("555-123-4567");
    expect(cleaned.messages[0].content).toContain("[REDACTED]");
  });

  it("strips IP addresses", () => {
    const raw = [{ role: "user", content: "Server is at 192.168.1.1" }];
    const cleaned = SessionCleaner.clean("s1", raw);
    expect(cleaned.messages[0].content).not.toContain("192.168.1.1");
  });

  it("removes SWE tool events", () => {
    const tools = [
      { tool: "bash",       input: "ls -la", output: "...",    turnIndex: 1 },
      { tool: "quiz_check", input: "answer", output: "wrong", turnIndex: 2 },
    ];
    const cleaned = SessionCleaner.clean("s1", [], tools);
    expect(cleaned.toolEvents).toHaveLength(1);
    expect(cleaned.toolEvents[0].tool).toBe("quiz_check");
  });

  it("assigns sequential turnIndex to messages", () => {
    const raw = makeRawMessages(4);
    const cleaned = SessionCleaner.clean("s1", raw);
    cleaned.messages.forEach((m, i) => expect(m.turnIndex).toBe(i));
  });

  it("finalize sets endedAt", () => {
    const session = SessionCleaner.clean("s1", []);
    expect(session.endedAt).toBe(0);
    const finished = SessionCleaner.finalize(session, 9999);
    expect(finished.endedAt).toBe(9999);
  });

  it("sessionId is preserved", () => {
    const cleaned = SessionCleaner.clean("abc-123", []);
    expect(cleaned.sessionId).toBe("abc-123");
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — SessionAnalyser
// ---------------------------------------------------------------------------

function makeSession(userMessages: string[]): CleanedSession {
  let idx = 0;
  return {
    sessionId: "test",
    startedAt: 0,
    endedAt: 0,
    messages: userMessages.flatMap((content) => [
      { role: "user" as const, content, turnIndex: idx++ },
      { role: "assistant" as const, content: "Got it.", turnIndex: idx++ },
    ]),
    toolEvents: [],
  };
}

describe("SessionAnalyser (Tier 2)", () => {
  it("detects high frustration", () => {
    const session = makeSession([
      "i don't understand this at all",
      "i'm totally lost",
      "this doesn't make sense",
    ]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.frictionPoints.length).toBeGreaterThan(0);
    expect(
      analysis.frictionPoints.some((f) => f.severity === "high")
    ).toBe(true);
  });

  it("detects frustrated affect signal with multiple high-friction turns", () => {
    const session = makeSession([
      "i don't understand this",
      "i'm totally lost here",
      "i don't understand at all",
    ]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.affectSignal).toBe("frustrated");
  });

  it("detects positive affect", () => {
    const session = makeSession([
      "oh i get it now!",
      "that makes sense, thanks!",
      "got it, interesting approach",
    ]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.affectSignal).toBe("positive");
  });

  it("detects disengaged affect", () => {
    const session = makeSession([
      "ok whatever",
      "just tell me the answer",
      "whatever, idk",
    ]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.affectSignal).toBe("disengaged");
  });

  it("infers procedural intent from 'step by step'", () => {
    const session = makeSession(["Can you show me step by step how to solve this?"]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.inferredIntent).toBe("procedural practice");
  });

  it("infers conceptual intent from 'explain'", () => {
    const session = makeSession(["Can you explain how recursion works?"]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.inferredIntent).toBe("conceptual understanding");
  });

  it("infers causal intent from 'why'", () => {
    const session = makeSession(["Why does this algorithm have O(n²) complexity?"]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.inferredIntent).toBe("causal reasoning");
  });

  it("extracts immediate goals from questions", () => {
    const session = makeSession(["How does backpropagation work?"]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.immediateGoals.length).toBeGreaterThan(0);
  });

  it("quality score is 0-1", () => {
    const session = makeSession(["ok", "fine"]);
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.qualityScore).toBeGreaterThanOrEqual(0);
    expect(analysis.qualityScore).toBeLessThanOrEqual(1);
  });

  it("includes sessionId in result", () => {
    const session: CleanedSession = { ...makeSession([]), sessionId: "my-session" };
    const analysis = SessionAnalyser.analyse(session);
    expect(analysis.sessionId).toBe("my-session");
  });
});

// ---------------------------------------------------------------------------
// Tier 3 — TomProfileBuilder
// ---------------------------------------------------------------------------

function makeAnalysis(
  intent: string,
  affect: SessionAnalysis["affectSignal"],
  idx: number
): SessionAnalysis {
  return {
    sessionId: `s${idx}`,
    analyzedAt: Date.now(),
    inferredIntent: intent,
    frictionPoints: affect === "frustrated"
      ? [{ turnIndex: 0, description: "i don't understand", severity: "high" }]
      : [],
    immediateGoals: ["How does this work?"],
    activeConceptIds: ["Recursion", "Graphs"],
    affectSignal: affect,
    qualityScore: affect === "positive" ? 0.8 : 0.4,
  };
}

describe("TomProfileBuilder (Tier 3)", () => {
  it("cold start returns default profile", () => {
    const profile = TomProfileBuilder.coldStart("u1");
    expect(profile.workingStyle).toBe("mixed");
    expect(profile.profileConfidence).toBe(0);
    expect(profile.sessionIds).toHaveLength(0);
  });

  it("builds profile from analyses", () => {
    const analyses = [
      makeAnalysis("procedural practice", "positive", 1),
      makeAnalysis("procedural practice", "positive", 2),
    ];
    const profile = TomProfileBuilder.build("u1", analyses);
    expect(profile.workingStyle).toBe("example-driven");
    expect(profile.sessionIds).toHaveLength(2);
  });

  it("detects deep interest from repeated concepts", () => {
    const analyses = Array.from({ length: 4 }, (_, i) => makeAnalysis("conceptual understanding", "neutral", i));
    const profile = TomProfileBuilder.build("u1", analyses);
    // "Recursion" and "Graphs" appear in all 4 sessions
    expect(profile.deepInterestTopics.length).toBeGreaterThan(0);
  });

  it("adds frustration to implicit needs when frustration rate > 40%", () => {
    const analyses = [
      makeAnalysis("conceptual understanding", "frustrated", 1),
      makeAnalysis("conceptual understanding", "frustrated", 2),
      makeAnalysis("conceptual understanding", "positive", 3),
    ];
    const profile = TomProfileBuilder.build("u1", analyses);
    expect(profile.implicitNeeds.some((n) => n.includes("scaffolded"))).toBe(true);
  });

  it("confidence grows with more sessions", () => {
    const a1 = TomProfileBuilder.build("u1", [makeAnalysis("general learning", "neutral", 1)]);
    const a3 = TomProfileBuilder.build("u1", [
      makeAnalysis("general learning", "neutral", 1),
      makeAnalysis("general learning", "neutral", 2),
      makeAnalysis("general learning", "neutral", 3),
    ]);
    expect(a3.profileConfidence).toBeGreaterThan(a1.profileConfidence);
  });

  it("returns existing profile when analyses is empty", () => {
    const existing = TomProfileBuilder.coldStart("u1");
    const result = TomProfileBuilder.build("u1", [], existing);
    expect(result).toEqual(existing);
  });

  it("MIN_SESSIONS_FOR_PROFILE constant is exported", () => {
    expect(MIN_SESSIONS_FOR_PROFILE).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// HighOrderToMTracker
// ---------------------------------------------------------------------------

describe("HighOrderToMTracker", () => {
  it("creates empty state", () => {
    const state = HighOrderToMTracker.create("u1");
    expect(state.studentId).toBe("u1");
    expect(state.contextCoherenceScore).toBe(1.0);
    expect(state.falseConfidenceConcepts).toHaveLength(0);
  });

  it("sets ground truth for a concept", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(state, "recursion", "A function calls itself.");
    expect(state.groundTruthMap["recursion"]).toBe("A function calls itself.");
  });

  it("detects flawed belief (keyword mismatch)", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(
      state, "recursion", "function calls itself repeatedly until base case"
    );
    state = HighOrderToMTracker.recordStudentBelief(
      state, "recursion", "when a loop runs forever", 0.3
    );
    const belief = state.studentBeliefMap["recursion"];
    expect(belief.isFlawed).toBe(true);
  });

  it("accepts correct belief (keyword overlap)", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(
      state, "recursion", "function calls itself"
    );
    state = HighOrderToMTracker.recordStudentBelief(
      state, "recursion", "a function that calls itself", 0.3
    );
    const belief = state.studentBeliefMap["recursion"];
    expect(belief.isFlawed).toBe(false);
  });

  it("detects false confidence (flawed belief + high mastery)", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(
      state, "recursion", "function calls itself"
    );
    const highMastery = FALSE_CONFIDENCE_MASTERY_THRESHOLD + 0.1;
    state = HighOrderToMTracker.recordStudentBelief(
      state, "recursion", "when a loop runs forever", highMastery
    );
    expect(state.falseConfidenceConcepts).toContain("recursion");
  });

  it("does NOT flag false confidence for low mastery", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(
      state, "recursion", "function calls itself"
    );
    state = HighOrderToMTracker.recordStudentBelief(
      state, "recursion", "when a loop runs forever", 0.2
    );
    expect(state.falseConfidenceConcepts).not.toContain("recursion");
  });

  it("coherence decreases on flawed belief", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(state, "c1", "truth is here");
    state = HighOrderToMTracker.recordStudentBelief(state, "c1", "something else entirely different", 0.3);
    expect(state.contextCoherenceScore).toBeLessThan(1.0);
    expect(state.contextCoherenceScore).toBeCloseTo(1.0 - COHERENCE_DECAY_PER_CONTRADICTION, 5);
  });

  it("coherence increases on correct belief", () => {
    let state = HighOrderToMTracker.create("u1");
    state = { ...state, contextCoherenceScore: 0.7 };
    state = HighOrderToMTracker.setGroundTruth(state, "c1", "function calls itself");
    state = HighOrderToMTracker.recordStudentBelief(state, "c1", "a function calls itself", 0.5);
    expect(state.contextCoherenceScore).toBeGreaterThan(0.7);
  });

  it("markCorrected removes from falseConfidenceConcepts", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(state, "c1", "truth");
    state = HighOrderToMTracker.recordStudentBelief(
      state, "c1", "totally different wrong thing", FALSE_CONFIDENCE_MASTERY_THRESHOLD + 0.1
    );
    expect(state.falseConfidenceConcepts).toContain("c1");
    state = HighOrderToMTracker.markCorrected(state, "c1");
    expect(state.falseConfidenceConcepts).not.toContain("c1");
  });

  it("recommends Socratic question for false confidence", () => {
    let state = HighOrderToMTracker.create("u1");
    state = HighOrderToMTracker.setGroundTruth(state, "graphs", "nodes connected by edges");
    state = HighOrderToMTracker.recordStudentBelief(
      state, "graphs", "something totally wrong and different", FALSE_CONFIDENCE_MASTERY_THRESHOLD + 0.1
    );
    const intervention = HighOrderToMTracker.recommendIntervention(state, {});
    expect(intervention).not.toBeNull();
    expect(intervention?.action.type).toBe("ask_socratic_question");
  });
});

// ---------------------------------------------------------------------------
// EpistemicStateTracker
// ---------------------------------------------------------------------------

describe("EpistemicStateTracker", () => {
  const mockProfile = TomProfileBuilder.coldStart("u1");

  it("builds epistemic state from mastery map", () => {
    const state = EpistemicStateTracker.build(
      "u1",
      { recursion: 0.6, graphs: 0.3 },
      mockProfile
    );
    expect(state.conceptMasteryMap.recursion).toBe(0.6);
    expect(state.conceptMasteryMap.graphs).toBe(0.3);
  });

  it("applies frustration penalty to adjusted mastery", () => {
    const profileWithFrustration = {
      ...mockProfile,
      frustrationTriggers: ['Student expressed: "i don\'t understand" about recursion'],
    };
    const state = EpistemicStateTracker.build(
      "u1",
      { recursion: 0.6 },
      profileWithFrustration
    );
    // recursion is a frustration trigger — adjusted mastery should be lower
    expect(state.adjustedMasteryMap.recursion).toBeLessThanOrEqual(0.6);
  });

  it("no penalty for non-frustrating concepts", () => {
    const state = EpistemicStateTracker.build("u1", { graphs: 0.7 }, mockProfile);
    expect(state.adjustedMasteryMap.graphs).toBe(0.7);
  });

  it("updateAfterAttempt updates both maps", () => {
    let state = EpistemicStateTracker.build("u1", { c1: 0.4 }, mockProfile);
    state = EpistemicStateTracker.updateAfterAttempt(state, "c1", 0.65, false);
    expect(state.conceptMasteryMap.c1).toBe(0.65);
    expect(state.adjustedMasteryMap.c1).toBe(0.65);
  });

  it("updateAfterAttempt applies frustration penalty when frustrated", () => {
    let state = EpistemicStateTracker.build("u1", { c1: 0.4 }, mockProfile);
    state = EpistemicStateTracker.updateAfterAttempt(state, "c1", 0.60, true);
    expect(state.conceptMasteryMap.c1).toBe(0.60);
    expect(state.adjustedMasteryMap.c1).toBeLessThan(0.60);
  });

  it("getWeakestConcepts returns sorted ascending", () => {
    const state = EpistemicStateTracker.build(
      "u1",
      { a: 0.9, b: 0.2, c: 0.5 },
      mockProfile
    );
    const weakest = EpistemicStateTracker.getWeakestConcepts(state, 2);
    expect(weakest[0].conceptId).toBe("b");
    expect(weakest[0].pMastered).toBeLessThan(weakest[1].pMastered);
  });

  it("getWeakestConcepts respects topN", () => {
    const state = EpistemicStateTracker.build(
      "u1",
      { a: 0.1, b: 0.2, c: 0.3, d: 0.4 },
      mockProfile
    );
    expect(EpistemicStateTracker.getWeakestConcepts(state, 2)).toHaveLength(2);
  });
});
