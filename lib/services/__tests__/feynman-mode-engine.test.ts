/**
 * Tests for FeynmanModeEngine
 * arXiv:2506.09055 (AI Feynman Bot), NeurIPS 2024 LbT, SocraticLM, SocraticAI arXiv:2512.03501
 */

import { describe, it, expect } from "vitest";
import {
  FeynmanModeEngine,
  DEPTH_LABELS,
  DEPTH_INSTRUCTIONS,
  STYLE_INSTRUCTIONS,
  CommandParser,
  VALID_COMMANDS,
  COMMAND_MODE_MAP,
} from "../feynman-mode-engine";
import type {
  FeynmanMode,
  FeynmanModeConfig,
  UserLearningProfile,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<UserLearningProfile> = {}): UserLearningProfile {
  return {
    depth: 5,
    learningStyle: "verbal",
    communication: "layman",
    tone: "encouraging",
    reasoning: "inductive",
    inferred: false,
    inferenceConfidence: 0,
    lastUpdatedAt: Date.now(),
    ...overrides,
  };
}

function makeConfig(mode: FeynmanMode, overrides: Partial<FeynmanModeConfig> = {}): FeynmanModeConfig {
  return {
    mode,
    profile: makeProfile(),
    currentTopic: "Photosynthesis",
    knownConcepts: ["Cell", "Chloroplast"],
    inProgressConcepts: ["Light reactions"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Depth Guide
// ---------------------------------------------------------------------------

describe("Depth Guide", () => {
  it("should have labels and instructions for all 10 depth levels", () => {
    for (let d = 1; d <= 10; d++) {
      expect(DEPTH_LABELS[d as keyof typeof DEPTH_LABELS]).toBeTruthy();
      expect(DEPTH_INSTRUCTIONS[d as keyof typeof DEPTH_INSTRUCTIONS]).toBeTruthy();
    }
  });

  it("depth 1 should mention elementary/child/simple", () => {
    const instruction = DEPTH_INSTRUCTIONS[1].toLowerCase();
    expect(instruction).toMatch(/simple|analogi|everyday|short/);
  });

  it("depth 10 should mention peer/expert/PhD", () => {
    const label = DEPTH_LABELS[10].toLowerCase();
    expect(label).toMatch(/phd|peer|expert|doctoral/i);
  });
});

// ---------------------------------------------------------------------------
// Style Instructions
// ---------------------------------------------------------------------------

describe("Style Instructions", () => {
  it("should have instructions for all 6 learning styles", () => {
    const styles: UserLearningProfile["learningStyle"][] = [
      "visual", "verbal", "active", "intuitive", "reflective", "global",
    ];
    for (const style of styles) {
      expect(STYLE_INSTRUCTIONS[style]).toBeTruthy();
    }
  });

  it("visual style should mention diagrams or spatial", () => {
    expect(STYLE_INSTRUCTIONS.visual.toLowerCase()).toMatch(/diagram|spatial|ascii/);
  });

  it("active style should mention examples or practice", () => {
    expect(STYLE_INSTRUCTIONS.active.toLowerCase()).toMatch(/example|practice|step/);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt — EXPLAINER mode
// ---------------------------------------------------------------------------

describe("FeynmanModeEngine.buildSystemPrompt — EXPLAINER", () => {
  it("should build a non-empty system prompt", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("explainer"));
    expect(result.systemPrompt.length).toBeGreaterThan(100);
    expect(result.mode).toBe("explainer");
  });

  it("should include the topic in the prompt", () => {
    const cfg = makeConfig("explainer", { currentTopic: "Newton's Laws" });
    const result = FeynmanModeEngine.buildSystemPrompt(cfg);
    expect(result.systemPrompt).toContain("Newton's Laws");
  });

  it("should include depth level and label", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(
      makeConfig("explainer", { profile: makeProfile({ depth: 3 }) })
    );
    expect(result.systemPrompt).toContain("3/10");
  });

  it("should include neuroscience principles reference", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("explainer"));
    expect(result.systemPrompt.toLowerCase()).toMatch(/cognitive load|dual cod|spaced|recall/);
  });

  it("should include known concepts when provided", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(
      makeConfig("explainer", { knownConcepts: ["ATP", "NADPH"] })
    );
    expect(result.systemPrompt).toMatch(/ATP|NADPH/);
  });

  it("should have non-empty suggestedStarters", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("explainer"));
    expect(result.suggestedStarters.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt — STUDENT mode (Role-Reversal / LbT)
// ---------------------------------------------------------------------------

describe("FeynmanModeEngine.buildSystemPrompt — STUDENT", () => {
  it("should produce a student-role prompt", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("student"));
    const lower = result.systemPrompt.toLowerCase();
    expect(lower).toMatch(/roleplay|confused|student|learn/);
  });

  it("should include Feynman Technique reference", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("student"));
    expect(result.systemPrompt.toLowerCase()).toMatch(/feynman/);
  });

  it("should mention LbT or 'learning by teaching'", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("student"));
    expect(result.systemPrompt.toLowerCase()).toMatch(/lbt|learning by teaching|nips|neurips/i);
  });

  it("should have beginner confusion for depth 1", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(
      makeConfig("student", { profile: makeProfile({ depth: 1 }) })
    );
    expect(result.systemPrompt.toLowerCase()).toMatch(/very confused|very basic/);
  });

  it("should have mild confusion for depth 9", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(
      makeConfig("student", { profile: makeProfile({ depth: 9 }) })
    );
    expect(result.systemPrompt.toLowerCase()).toMatch(/mildly|edge case|nuanc/);
  });

  it("should include the topic in the starter phrase", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(
      makeConfig("student", { currentTopic: "Recursion" })
    );
    expect(result.systemPrompt).toContain("Recursion");
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt — SOCRATIC mode (SocraticLM NeurIPS 2024)
// ---------------------------------------------------------------------------

describe("FeynmanModeEngine.buildSystemPrompt — SOCRATIC", () => {
  it("should produce a questions-only prompt", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("socratic"));
    const lower = result.systemPrompt.toLowerCase();
    expect(lower).toMatch(/question|socratic|never.*direct|only.*question/);
  });

  it("should mention SocraticLM or NeurIPS", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("socratic"));
    expect(result.systemPrompt).toMatch(/SocraticLM|SocraticAI|NeurIPS|arXiv/i);
  });

  it("should include the topic", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(
      makeConfig("socratic", { currentTopic: "Entropy" })
    );
    expect(result.systemPrompt).toContain("Entropy");
  });

  it("should include known concepts in the prompt", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(
      makeConfig("socratic", { knownConcepts: ["Energy", "Temperature"] })
    );
    expect(result.systemPrompt).toMatch(/Energy|Temperature/);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt — RUBBER DUCK mode
// ---------------------------------------------------------------------------

describe("FeynmanModeEngine.buildSystemPrompt — RUBBER_DUCK", () => {
  it("should produce a listening/minimal-response prompt", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("rubber_duck"));
    const lower = result.systemPrompt.toLowerCase();
    expect(lower).toMatch(/listen|rubber|minimal|aloud|think/);
  });

  it("should explicitly say never give the answer", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(makeConfig("rubber_duck"));
    expect(result.systemPrompt.toLowerCase()).toContain("never give the answer");
  });

  it("should include the topic", () => {
    const result = FeynmanModeEngine.buildSystemPrompt(
      makeConfig("rubber_duck", { currentTopic: "Linked Lists" })
    );
    expect(result.systemPrompt).toContain("Linked Lists");
  });
});

// ---------------------------------------------------------------------------
// recommendMode
// ---------------------------------------------------------------------------

describe("FeynmanModeEngine.recommendMode", () => {
  it("should recommend explainer when confusion is high", () => {
    const { recommendedMode } = FeynmanModeEngine.recommendMode({
      mastery: 0.4,
      confusionLevel: 0.8,
      lastUserMessage: "I don't understand this at all",
      currentMode: "socratic",
    });
    expect(recommendedMode).toBe("explainer");
  });

  it("should recommend student mode when mastery is high and confusion is low", () => {
    const { recommendedMode } = FeynmanModeEngine.recommendMode({
      mastery: 0.85,
      confusionLevel: 0.1,
      lastUserMessage: "I think I understand this well.",
      currentMode: "explainer",
    });
    expect(recommendedMode).toBe("student");
  });

  it("should recommend socratic for conceptual 'why' questions", () => {
    const { recommendedMode } = FeynmanModeEngine.recommendMode({
      mastery: 0.55,
      confusionLevel: 0.2,
      lastUserMessage: "Why does this work the way it does?",
      currentMode: "explainer",
    });
    expect(recommendedMode).toBe("socratic");
  });

  it("should keep current mode when no strong signal", () => {
    const { recommendedMode } = FeynmanModeEngine.recommendMode({
      mastery: 0.5,
      confusionLevel: 0.3,
      lastUserMessage: "Okay.",
      currentMode: "rubber_duck",
    });
    expect(recommendedMode).toBe("rubber_duck");
  });
});

// ---------------------------------------------------------------------------
// allModes + getModeInfo
// ---------------------------------------------------------------------------

describe("FeynmanModeEngine.allModes", () => {
  it("should return all 4 modes", () => {
    const modes = FeynmanModeEngine.allModes();
    expect(modes).toHaveLength(4);
    const modeNames = modes.map((m) => m.mode);
    expect(modeNames).toContain("explainer");
    expect(modeNames).toContain("student");
    expect(modeNames).toContain("socratic");
    expect(modeNames).toContain("rubber_duck");
  });

  it("each mode should have a non-empty description", () => {
    for (const { description } of FeynmanModeEngine.allModes()) {
      expect(description.length).toBeGreaterThan(10);
    }
  });

  it("getModeInfo should return starters for each mode", () => {
    const modes: FeynmanMode[] = ["explainer", "student", "socratic", "rubber_duck"];
    for (const m of modes) {
      const info = FeynmanModeEngine.getModeInfo(m);
      expect(info.starters.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// CommandParser
// ---------------------------------------------------------------------------

describe("CommandParser", () => {
  it("should parse /explain as valid", () => {
    const result = CommandParser.parse("/explain");
    expect(result.valid).toBe(true);
    expect(result.command).toBe("/explain");
  });

  it("should parse /depth 7 as valid with argument", () => {
    const result = CommandParser.parse("/depth 7");
    expect(result.valid).toBe(true);
    expect(result.argument).toBe("7");
  });

  it("should reject /depth with non-numeric argument", () => {
    const result = CommandParser.parse("/depth abc");
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBeDefined();
  });

  it("should reject /depth out of range", () => {
    const result = CommandParser.parse("/depth 11");
    expect(result.valid).toBe(false);
  });

  it("should parse /style verbal as valid", () => {
    const result = CommandParser.parse("/style verbal");
    expect(result.valid).toBe(true);
    expect(result.argument).toBe("verbal");
  });

  it("should reject /style with invalid style", () => {
    const result = CommandParser.parse("/style random");
    expect(result.valid).toBe(false);
  });

  it("should reject unknown commands", () => {
    const result = CommandParser.parse("/unknown");
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain("Unknown command");
  });

  it("should reject non-command input", () => {
    const result = CommandParser.parse("Hello there");
    expect(result.valid).toBe(false);
  });

  it("should identify mode-switching commands correctly", () => {
    const modeCmds = ["/explain", "/teach", "/socratic", "/duck"];
    for (const cmd of modeCmds) {
      expect(CommandParser.isModeSwitch(cmd)).toBe(true);
    }
  });

  it("should identify non-mode commands correctly", () => {
    const nonModeCmds = ["/test", "/config", "/review", "/graph"];
    for (const cmd of nonModeCmds) {
      expect(CommandParser.isModeSwitch(cmd)).toBe(false);
    }
  });

  it("should map /teach to student mode", () => {
    expect(CommandParser.getModeForCommand("/teach")).toBe("student");
  });

  it("should map /duck to rubber_duck mode", () => {
    expect(CommandParser.getModeForCommand("/duck")).toBe("rubber_duck");
  });

  it("VALID_COMMANDS should include all expected commands", () => {
    const expected = ["/test", "/config", "/plan", "/explain", "/teach", "/socratic", "/duck", "/review", "/graph", "/depth", "/style"];
    for (const cmd of expected) {
      expect(VALID_COMMANDS).toContain(cmd);
    }
  });
});
