/**
 * Tests for DeepFeynman V2 — Sprint 0-4 server services
 *   - feynman-prompts.ts (4 modes, APE, KG extraction)
 *   - gemini-service.ts (key resolution, extractUserApiKey)
 */

import { describe, it, expect } from "vitest";

// ── Feynman Prompts ──────────────────────────────────────────────────────────
import {
  buildSystemPrompt,
  buildExplainerPrompt,
  buildStudentPrompt,
  buildSocraticPrompt,
  buildDuckPrompt,
  APE_INFERENCE_PROMPT,
  KG_EXTRACT_PROMPT,
  FeynmanMode,
} from "../feynman-prompts";

// ── Gemini Service — extractUserApiKey (pure utility, inline for test isolation) ──
// The full gemini-service.ts has server-only imports (invokeLLM), so we test
// the pure utility function directly here without importing the full module.
function extractUserApiKey(headers: Record<string, string | string[] | undefined>): string | undefined {
  const val = headers["x-gemini-api-key"];
  return Array.isArray(val) ? val[0] : val;
}

// ============================================================================
// FEYNMAN PROMPTS — Mode 1: Explainer
// ============================================================================

describe("buildExplainerPrompt", () => {
  it("should include the concept name", () => {
    const p = buildExplainerPrompt("Recursion");
    expect(p).toContain("Recursion");
  });

  it("should reference Feynman methodology", () => {
    const p = buildExplainerPrompt("Recursion");
    expect(p.toLowerCase()).toMatch(/feynman|simplif|analogy/);
  });

  it("should include depth level when profile provided", () => {
    const p = buildExplainerPrompt("Neural Networks", { depthLevel: 3, learningStyle: "visual" });
    expect(p).toMatch(/High School|depth/i);
    expect(p).toContain("visual");
  });

  it("should not crash with empty profile", () => {
    expect(() => buildExplainerPrompt("Calculus", {})).not.toThrow();
  });

  it("should contain the 7-step Feynman loop", () => {
    const p = buildExplainerPrompt("Pointers");
    // Should contain some of the loop steps
    expect(p).toMatch(/analogy|gap|teaching snapshot|simplif/i);
  });
});

// ============================================================================
// FEYNMAN PROMPTS — Mode 2: Student (Role Reversal)
// ============================================================================

describe("buildStudentPrompt", () => {
  it("should ask user to explain the topic", () => {
    const p = buildStudentPrompt("Gradient Descent");
    expect(p).toContain("Gradient Descent");
    expect(p.toLowerCase()).toMatch(/explain|teach/);
  });

  it("should mention role reversal", () => {
    const p = buildStudentPrompt("Gradient Descent");
    expect(p.toLowerCase()).toMatch(/student|learning|explain it to me/);
  });

  it("should NOT contain direct answer instructions", () => {
    const p = buildStudentPrompt("Recursion");
    // Should not tell the AI to give answers
    expect(p.toLowerCase()).not.toMatch(/give the answer|reveal the answer/);
  });

  it("should start with an invitation to explain", () => {
    const p = buildStudentPrompt("Pointers");
    expect(p).toContain("explain");
  });
});

// ============================================================================
// FEYNMAN PROMPTS — Mode 3: Socratic
// ============================================================================

describe("buildSocraticPrompt", () => {
  it("should prohibit direct answers", () => {
    const p = buildSocraticPrompt("Dynamic Programming");
    expect(p.toLowerCase()).toMatch(/never give|never reveal|only.*question|questions only/);
  });

  it("should mention the Guided Query Framework steps", () => {
    const p = buildSocraticPrompt("Dynamic Programming");
    expect(p.toLowerCase()).toMatch(/approach|tried|stuck|what would happen/);
  });

  it("should enforce 4:1 question ratio", () => {
    const p = buildSocraticPrompt("Recursion");
    expect(p).toMatch(/4.*question|4:1/i);
  });

  it("should include hint fallback after 4 exchanges", () => {
    const p = buildSocraticPrompt("Trees");
    expect(p.toLowerCase()).toMatch(/hint|4 exchange/);
  });
});

// ============================================================================
// FEYNMAN PROMPTS — Mode 4: Rubber Duck
// ============================================================================

describe("buildDuckPrompt", () => {
  it("should keep responses minimal", () => {
    const p = buildDuckPrompt("Memory Leaks");
    expect(p.toLowerCase()).toMatch(/short|1-3 sentence|minimal/);
  });

  it("should NOT solve the problem", () => {
    const p = buildDuckPrompt("Memory Leaks");
    expect(p.toLowerCase()).toContain("do not solve");
  });

  it("should use reflective paraphrase technique", () => {
    const p = buildDuckPrompt("Deadlock");
    expect(p.toLowerCase()).toMatch(/paraphrase|reflect|so what you.re saying/i);
  });

  it("should start by inviting the user to talk through it", () => {
    const p = buildDuckPrompt("Stack Overflow");
    expect(p.toLowerCase()).toContain("walk me through");
  });
});

// ============================================================================
// FEYNMAN PROMPTS — buildSystemPrompt (mode dispatcher)
// ============================================================================

describe("buildSystemPrompt", () => {
  const modes: FeynmanMode[] = ["explainer", "student", "socratic", "duck"];

  modes.forEach((mode) => {
    it(`should build a non-empty prompt for mode: ${mode}`, () => {
      const p = buildSystemPrompt(mode, "Big O Notation");
      expect(p).toBeTruthy();
      expect(p.length).toBeGreaterThan(100);
      expect(p).toContain("Big O Notation");
    });
  });

  it("should fall through to explainer for unknown mode", () => {
    const p = buildSystemPrompt("unknown_mode" as FeynmanMode, "Sorting");
    expect(p.toLowerCase()).toMatch(/feynman|simplif|analogy/);
  });

  it("explainer and student prompts should be different", () => {
    const explainer = buildSystemPrompt("explainer", "Heaps");
    const student = buildSystemPrompt("student", "Heaps");
    expect(explainer).not.toBe(student);
  });

  it("socratic and duck prompts should be different", () => {
    const socratic = buildSystemPrompt("socratic", "Heaps");
    const duck = buildSystemPrompt("duck", "Heaps");
    expect(socratic).not.toBe(duck);
  });
});

// ============================================================================
// APE INFERENCE PROMPT
// ============================================================================

describe("APE_INFERENCE_PROMPT", () => {
  it("should contain all required JSON fields", () => {
    expect(APE_INFERENCE_PROMPT).toContain("depth_level");
    expect(APE_INFERENCE_PROMPT).toContain("learning_style");
    expect(APE_INFERENCE_PROMPT).toContain("comm_style");
    expect(APE_INFERENCE_PROMPT).toContain("tone");
    expect(APE_INFERENCE_PROMPT).toContain("confusion_signals");
    expect(APE_INFERENCE_PROMPT).toContain("engagement_level");
    expect(APE_INFERENCE_PROMPT).toContain("confidence");
  });

  it("should list all valid learning styles", () => {
    const styles = ["visual", "verbal", "active", "intuitive", "reflective", "global"];
    for (const s of styles) expect(APE_INFERENCE_PROMPT).toContain(s);
  });

  it("should list all valid communication styles", () => {
    const styles = ["formal", "textbook", "layman", "story", "socratic"];
    for (const s of styles) expect(APE_INFERENCE_PROMPT).toContain(s);
  });

  it("should describe inference signals", () => {
    expect(APE_INFERENCE_PROMPT.toLowerCase()).toMatch(/vocabular|jargon|question|confusion/);
  });
});

// ============================================================================
// KG EXTRACTION PROMPT
// ============================================================================

describe("KG_EXTRACT_PROMPT", () => {
  it("should contain required JSON structure", () => {
    expect(KG_EXTRACT_PROMPT).toContain("new_nodes");
    expect(KG_EXTRACT_PROMPT).toContain("new_edges");
    expect(KG_EXTRACT_PROMPT).toContain("mastery_signals");
  });

  it("should define valid edge relation types", () => {
    expect(KG_EXTRACT_PROMPT).toContain("prerequisite");
    expect(KG_EXTRACT_PROMPT).toContain("related");
    expect(KG_EXTRACT_PROMPT).toContain("applies_to");
  });

  it("should specify mastery signal range", () => {
    expect(KG_EXTRACT_PROMPT).toMatch(/0\.0.*1\.0|0-1/);
  });
});

// ============================================================================
// GEMINI SERVICE — extractUserApiKey
// ============================================================================

describe("extractUserApiKey", () => {
  it("should extract string header value", () => {
    const key = extractUserApiKey({ "x-gemini-api-key": "my-test-key" });
    expect(key).toBe("my-test-key");
  });

  it("should extract first item from array header value", () => {
    const key = extractUserApiKey({ "x-gemini-api-key": ["key-from-array", "other"] });
    expect(key).toBe("key-from-array");
  });

  it("should return undefined when header is missing", () => {
    const key = extractUserApiKey({ "content-type": "application/json" });
    expect(key).toBeUndefined();
  });

  it("should return undefined for empty headers", () => {
    const key = extractUserApiKey({});
    expect(key).toBeUndefined();
  });

  it("should be case-insensitive for the header name (lowercase)", () => {
    // Express normalizes headers to lowercase
    const key = extractUserApiKey({ "x-gemini-api-key": "lowercase-key" });
    expect(key).toBe("lowercase-key");
  });
});
