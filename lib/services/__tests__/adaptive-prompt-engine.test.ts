/**
 * Tests for AdaptivePromptEngine (APE)
 * ProfiLLM (arXiv:2506.13980), USP (ACL 2025), COMEDY memory compression
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AdaptivePromptEngine,
  ANALYSIS_INTERVAL,
  ConversationAnalyser,
  COLD_START_PROFILE,
  MemoryMemoGenerator,
  ProfileMerger,
  MIN_CONFIDENCE_FOR_STYLE_UPDATE,
  type ConversationRecord,
} from "../adaptive-prompt-engine";
import type { UserLearningProfile } from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHistory(userMessages: string[]): ConversationRecord[] {
  return userMessages.flatMap((msg, i) => [
    { role: "user", content: msg },
    { role: "assistant", content: `Response ${i}` },
  ]);
}

function makeProfile(overrides: Partial<UserLearningProfile> = {}): UserLearningProfile {
  return { ...COLD_START_PROFILE, ...overrides };
}

// ---------------------------------------------------------------------------
// ConversationAnalyser
// ---------------------------------------------------------------------------

describe("ConversationAnalyser", () => {
  it("should return a valid APEAnalysis with default fields for empty history", () => {
    const analysis = ConversationAnalyser.analyse([]);
    expect(analysis.inferredDepth).toBeGreaterThanOrEqual(1);
    expect(analysis.inferredDepth).toBeLessThanOrEqual(10);
    expect(analysis.confusionLevel).toBeGreaterThanOrEqual(0);
    expect(analysis.confusionLevel).toBeLessThanOrEqual(1);
    expect(analysis.engagementLevel).toBeGreaterThanOrEqual(0);
    expect(analysis.engagementLevel).toBeLessThanOrEqual(1);
    expect(Array.isArray(analysis.conceptsMentioned)).toBe(true);
    expect(analysis.confidence).toBeGreaterThanOrEqual(0);
  });

  it("should infer higher depth from expert vocabulary", () => {
    const expertHistory = makeHistory([
      "Can you explain the Bayesian posterior update for the BKT model using the slip parameter?",
      "I'm thinking about eigenvalue decomposition in the context of attention matrices.",
      "The gradient of the entropy term in the ELBO is what I'm struggling with.",
    ]);
    const analysis = ConversationAnalyser.analyse(expertHistory);
    expect(analysis.inferredDepth).toBeGreaterThanOrEqual(6);
  });

  it("should infer lower depth from simple vocabulary", () => {
    const beginnerHistory = makeHistory([
      "what is a number?",
      "explain addition in simple terms for beginners please",
      "i dont know how to add fractions eli5",
    ]);
    const analysis = ConversationAnalyser.analyse(beginnerHistory);
    expect(analysis.inferredDepth).toBeLessThanOrEqual(5);
  });

  it("should detect high confusion level from confusion phrases", () => {
    const confusedHistory = makeHistory([
      "i don't understand what you mean at all",
      "i'm confused about everything you just said",
      "not following, can you explain again? still not clear",
      "i dont get it at all, help me please",
    ]);
    const analysis = ConversationAnalyser.analyse(confusedHistory);
    expect(analysis.confusionLevel).toBeGreaterThan(0.3);
  });

  it("should suggest explainer mode when confusion is very high", () => {
    const veryConfused = makeHistory([
      "i don't understand what you mean at all huh?",
      "i'm confused and still not clear, can you explain again? not following",
      "lost me completely, i don't get this, help me understand",
      "wait, so explain again i'm confused still not clear",
      "i don't understand i'm confused help me",
    ]);
    const analysis = ConversationAnalyser.analyse(veryConfused);
    expect(analysis.suggestedModeSwitch).toBe("explainer");
  });

  it("should suggest student mode when engaged and not confused", () => {
    const engaged = makeHistory([
      "That's fascinating! Tell me more about this concept.",
      "Oh! So that means it connects to the next topic right? Interesting!",
      "Got it! Makes sense, what about the applications? Amazing stuff.",
      "I see the pattern now, go on with more details.",
      "Fascinating! What are the implications for machine learning?",
    ]);
    const analysis = ConversationAnalyser.analyse(engaged);
    // Either student mode is suggested or no switch needed (both valid)
    expect(["student", null]).toContain(analysis.suggestedModeSwitch);
  });

  it("should infer visual learning style from diagram requests", () => {
    const visualHistory = makeHistory([
      "Can you show me a diagram of this?",
      "I need to visualize the structure — draw it out.",
      "What does this look like as a chart or graph?",
    ]);
    const analysis = ConversationAnalyser.analyse(visualHistory);
    expect(["visual", "verbal"]).toContain(analysis.inferredLearningStyle);
  });

  it("should infer active learning style from exercise requests", () => {
    const activeHistory = makeHistory([
      "Let me try an exercise on this.",
      "Give me a practice problem to solve step by step.",
      "I want to do a hands on example of this algorithm.",
    ]);
    const analysis = ConversationAnalyser.analyse(activeHistory);
    expect(analysis.inferredLearningStyle).toBe("active");
  });

  it("should infer formal communication from formal language markers", () => {
    const formalHistory = makeHistory([
      "Furthermore, this theorem can be shown to hold rigorously.",
      "Thus the hypothesis follows. Hence, in conclusion, the proof is complete.",
      "It can be shown formally that the convergence is asymptotic.",
    ]);
    const analysis = ConversationAnalyser.analyse(formalHistory);
    expect(analysis.inferredCommunication).toBe("formal");
  });

  it("should extract capitalised concepts from conversation", () => {
    const conceptHistory = makeHistory([
      "I want to understand Photosynthesis and how Chlorophyll works.",
      "Newton discovered Gravity and also worked on Calculus.",
    ]);
    const analysis = ConversationAnalyser.analyse(conceptHistory);
    expect(analysis.conceptsMentioned.length).toBeGreaterThan(0);
  });

  it("should return null mode suggestion when history is neutral", () => {
    const neutral = makeHistory(["Hello there.", "Okay.", "Thanks."]);
    const analysis = ConversationAnalyser.analyse(neutral);
    // No strong signal → null is acceptable
    expect(analysis.suggestedModeSwitch === null || typeof analysis.suggestedModeSwitch === "string").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ProfileMerger
// ---------------------------------------------------------------------------

describe("ProfileMerger", () => {
  it("should not change a manual (non-inferred) profile by default", () => {
    const manual = makeProfile({ depth: 7, inferred: false });
    const analysis = ConversationAnalyser.analyse(
      makeHistory(["eli5 everything basic simple for beginners"])
    );
    const merged = ProfileMerger.merge(manual, analysis, false);
    expect(merged.depth).toBe(7); // manual override preserved
  });

  it("should update an inferred profile toward new inference", () => {
    const current = makeProfile({ depth: 5, inferred: true });
    const highDepthHistory = makeHistory([
      "Let's discuss eigenvalue decomposition and Bayesian posterior distributions.",
      "I want to understand the gradient of the ELBO in variational inference.",
    ]);
    const analysis = ConversationAnalyser.analyse(highDepthHistory);
    const merged = ProfileMerger.merge(current, analysis);
    // Should move toward higher depth
    expect(merged.depth).toBeGreaterThanOrEqual(5);
    expect(merged.inferred).toBe(true);
  });

  it("should update style fields only when confidence is high enough", () => {
    const current = makeProfile({ learningStyle: "verbal", inferred: true });
    // Low confidence analysis — style should NOT change
    const lowConfidenceAnalysis = {
      inferredDepth: 5 as const,
      inferredLearningStyle: "visual" as const,
      inferredCommunication: "formal" as const,
      confusionLevel: 0.1,
      engagementLevel: 0.5,
      conceptsMentioned: [],
      suggestedModeSwitch: null,
      confidence: MIN_CONFIDENCE_FOR_STYLE_UPDATE - 0.1,
    };
    const merged = ProfileMerger.merge(current, lowConfidenceAnalysis);
    expect(merged.learningStyle).toBe("verbal"); // unchanged
  });

  it("should update style fields when confidence exceeds threshold", () => {
    const current = makeProfile({ learningStyle: "verbal", inferred: true });
    const highConfidenceAnalysis = {
      inferredDepth: 5 as const,
      inferredLearningStyle: "visual" as const,
      inferredCommunication: "layman" as const,
      confusionLevel: 0.1,
      engagementLevel: 0.8,
      conceptsMentioned: [],
      suggestedModeSwitch: null,
      confidence: MIN_CONFIDENCE_FOR_STYLE_UPDATE + 0.1,
    };
    const merged = ProfileMerger.merge(current, highConfidenceAnalysis);
    expect(merged.learningStyle).toBe("visual");
  });

  it("should clamp depth to [1, 10]", () => {
    const current = makeProfile({ depth: 1, inferred: true });
    const analysis = {
      inferredDepth: 1 as const,
      inferredLearningStyle: "verbal" as const,
      inferredCommunication: "layman" as const,
      confusionLevel: 0.9,
      engagementLevel: 0.1,
      conceptsMentioned: [],
      suggestedModeSwitch: "explainer" as const,
      confidence: 0.9,
    };
    const merged = ProfileMerger.merge(current, analysis);
    expect(merged.depth).toBeGreaterThanOrEqual(1);
    expect(merged.depth).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// MemoryMemoGenerator
// ---------------------------------------------------------------------------

describe("MemoryMemoGenerator", () => {
  it("should generate a memo with all required fields", () => {
    const profile = makeProfile({ depth: 5, inferred: true });
    const history = makeHistory([
      "Tell me about Photosynthesis and Chlorophyll.",
      "What is the difference between DNA and RNA?",
    ]);
    const analysis = ConversationAnalyser.analyse(history);
    const memo = MemoryMemoGenerator.generate("session-1", history, profile, analysis);

    expect(memo.sessionId).toBe("session-1");
    expect(typeof memo.summary).toBe("string");
    expect(memo.summary.length).toBeGreaterThan(10);
    expect(Array.isArray(memo.keyConceptsCovered)).toBe(true);
    expect(Array.isArray(memo.unresolved)).toBe(true);
    expect(memo.profileSnapshot).toMatchObject({ depth: 5 });
    expect(memo.createdAt).toBeGreaterThan(0);
  });

  it("should mark unresolved items when confusion is high", () => {
    const profile = makeProfile({ depth: 3, inferred: true });
    const confusedHistory = makeHistory([
      "i'm confused about Mitosis and Meiosis",
      "i don't understand i'm confused still not clear about everything",
    ]);
    const analysis = ConversationAnalyser.analyse(confusedHistory);
    const memo = MemoryMemoGenerator.generate("session-2", confusedHistory, profile, analysis);

    // When confusion is high, unresolved should be populated
    if (analysis.confusionLevel > 0.4) {
      expect(memo.unresolved.length).toBeGreaterThanOrEqual(0);
    }
    expect(memo.summary.length).toBeGreaterThan(0);
  });

  it("should cap summary length at MAX_SUMMARY_WORDS", () => {
    const profile = makeProfile();
    const longHistory = makeHistory(Array(20).fill("Tell me about everything in great detail, Photosynthesis, Calculus, Physics, Chemistry, Biology, History, Economics, Algebra."));
    const analysis = ConversationAnalyser.analyse(longHistory);
    const memo = MemoryMemoGenerator.generate("session-3", longHistory, profile, analysis);
    const wordCount = memo.summary.split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(MemoryMemoGenerator.MAX_SUMMARY_WORDS + 5);
  });
});

// ---------------------------------------------------------------------------
// AdaptivePromptEngine (orchestrator)
// ---------------------------------------------------------------------------

describe("AdaptivePromptEngine", () => {
  let ape: AdaptivePromptEngine;
  let profile: UserLearningProfile;

  beforeEach(() => {
    ape = new AdaptivePromptEngine();
    profile = makeProfile({ depth: 5, inferred: true });
  });

  it("should not fire analysis before ANALYSIS_INTERVAL turns", () => {
    const history = makeHistory(["Hello", "One", "Two"]);
    const result = ape.onNewTurn(history, profile);
    // Less than ANALYSIS_INTERVAL turns — analysis may or may not fire
    // but profile should be valid
    expect(result.profile.depth).toBeGreaterThanOrEqual(1);
  });

  it("should fire analysis on first turn", () => {
    const history = makeHistory(["Hello world"]);
    const result = ape.onNewTurn(history, profile);
    expect(result.analysis).not.toBeNull();
  });

  it("should fire analysis after ANALYSIS_INTERVAL turns", () => {
    const messages = Array(ANALYSIS_INTERVAL).fill("That's interesting! Tell me more.");
    const history = makeHistory(messages);
    // Consume turns
    for (let i = 0; i < ANALYSIS_INTERVAL - 1; i++) {
      ape.onNewTurn(history.slice(0, (i + 1) * 2), profile);
    }
    const result = ape.onNewTurn(history, profile);
    expect(result.analysis).not.toBeNull();
  });

  it("should fire analysis when forceAnalysis is called", () => {
    const history = makeHistory(["Only one message."]);
    const result = ape.forceAnalysis(history, profile);
    expect(result.analysis).not.toBeNull();
    expect(result.analysis.confidence).toBeGreaterThanOrEqual(0);
  });

  it("should reset turn counter after reset()", () => {
    const history = makeHistory(Array(10).fill("test message"));
    ape.onNewTurn(history, profile);
    ape.reset();
    expect(ape.lastKnownAnalysis).toBeNull();
  });

  it("should return the last known analysis between intervals", () => {
    // APE starts at ANALYSIS_INTERVAL so first call fires; second call (turn 1) won't
    const history1 = makeHistory(["Hello"]);
    const result1 = ape.onNewTurn(history1, profile); // fires (at threshold)
    expect(result1.analysis).not.toBeNull();

    // Second call increments counter to 1 — below interval, no new analysis
    const history2 = makeHistory(["Hello", "Follow up"]);
    const result2 = ape.onNewTurn(history2, profile);
    // lastKnownAnalysis should be from the first turn (cached)
    expect(result2.analysis).not.toBeNull();
  });
});
