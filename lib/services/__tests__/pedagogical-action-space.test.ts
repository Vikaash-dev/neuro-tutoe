/**
 * Tests for Pedagogical Action Space
 *
 * Covers:
 *   - PedagogicalActionFactory (all action types)
 *   - PedagogicalActionSelector (decision logic per mastery level)
 *   - SocraticRestraintEnforcer (blocks direct answers)
 *   - HintLadder (scaffolded hints)
 */

import { describe, it, expect } from "vitest";
import {
  PedagogicalActionFactory,
  PedagogicalActionSelector,
  SocraticRestraintEnforcer,
  HintLadder,
  ACTION_THRESHOLDS,
} from "../pedagogical-action-space";
import { EpistemicStateTracker, TomProfileBuilder, HighOrderToMTracker } from "../tom-swe";
import type { EpistemicState, TomUserProfile } from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEpistemicState(masteryMap: Record<string, number>): EpistemicState {
  return EpistemicStateTracker.build("u1", masteryMap, TomProfileBuilder.coldStart("u1"));
}

const COLD_PROFILE: TomUserProfile = TomProfileBuilder.coldStart("u1");

// ---------------------------------------------------------------------------
// PedagogicalActionFactory
// ---------------------------------------------------------------------------

describe("PedagogicalActionFactory", () => {
  it("creates evaluate_mastery action", () => {
    const action = PedagogicalActionFactory.evaluateMastery("recursion", "What is recursion?");
    expect(action.type).toBe("evaluate_mastery");
    expect(action.conceptId).toBe("recursion");
    if (action.type === "evaluate_mastery") {
      expect(action.probeQuestion).toBe("What is recursion?");
    }
  });

  it("creates evaluate_mastery without probe question", () => {
    const action = PedagogicalActionFactory.evaluateMastery("graphs");
    expect(action.type).toBe("evaluate_mastery");
    if (action.type === "evaluate_mastery") {
      expect(action.probeQuestion).toBeUndefined();
    }
  });

  it("creates generate_analogy action", () => {
    const action = PedagogicalActionFactory.generateAnalogy("recursion", 5, "cooking");
    expect(action.type).toBe("generate_analogy");
    if (action.type === "generate_analogy") {
      expect(action.targetDomain).toBe("cooking");
      expect(action.studentDepth).toBe(5);
    }
  });

  it("creates ask_socratic_question action", () => {
    const action = PedagogicalActionFactory.askSocraticQuestion(
      "graphs", "node definition", "What is a node?"
    );
    expect(action.type).toBe("ask_socratic_question");
    if (action.type === "ask_socratic_question") {
      expect(action.questionText).toBe("What is a node?");
      expect(action.targetGap).toBe("node definition");
    }
  });

  it("creates provide_correction action", () => {
    const action = PedagogicalActionFactory.provideCorrection(
      "recursion", "missing base case", "Every recursive function needs a base case.", "q42"
    );
    expect(action.type).toBe("provide_correction");
    if (action.type === "provide_correction") {
      expect(action.gapDescription).toBe("missing base case");
      expect(action.retryQuestionId).toBe("q42");
    }
  });

  it("creates adjust_difficulty action", () => {
    const action = PedagogicalActionFactory.adjustDifficulty("recursion", "lower", "student overloaded");
    expect(action.type).toBe("adjust_difficulty");
    if (action.type === "adjust_difficulty") {
      expect(action.direction).toBe("lower");
    }
  });

  it("creates trigger_review action", () => {
    const action = PedagogicalActionFactory.triggerReview(["c1", "c2"], "immediate");
    expect(action.type).toBe("trigger_review");
    if (action.type === "trigger_review") {
      expect(action.conceptIds).toHaveLength(2);
      expect(action.urgency).toBe("immediate");
    }
  });

  it("creates explain_concept action", () => {
    const action = PedagogicalActionFactory.explainConcept("graphs", "A graph has nodes.", "explainer");
    expect(action.type).toBe("explain_concept");
    if (action.type === "explain_concept") {
      expect(action.mode).toBe("explainer");
    }
  });

  it("creates offer_hint action", () => {
    const action = PedagogicalActionFactory.offerHint("recursion", 2, "Think about the base case.");
    expect(action.type).toBe("offer_hint");
    if (action.type === "offer_hint") {
      expect(action.hintLevel).toBe(2);
    }
  });

  it("toResult wraps action correctly", () => {
    const action = PedagogicalActionFactory.evaluateMastery("c1");
    const result = PedagogicalActionFactory.toResult(action, "Great!", true, 0.7);
    expect(result.output).toBe("Great!");
    expect(result.masteryUpdated).toBe(true);
    expect(result.newMasteryP).toBe(0.7);
    expect(result.action).toBe(action);
  });
});

// ---------------------------------------------------------------------------
// PedagogicalActionSelector
// ---------------------------------------------------------------------------

describe("PedagogicalActionSelector", () => {
  it("explains when mastery is very low (< OPTIMAL_ZONE_LOWER)", () => {
    const state = makeEpistemicState({ recursion: 0.25 });
    const result = PedagogicalActionSelector.select(
      "recursion", state, COLD_PROFILE, null, "explainer"
    );
    expect(result.action.type).toBe("explain_concept");
    expect(result.suggestedMode).toBe("explainer");
  });

  it("asks Socratic question in optimal zone", () => {
    const state = makeEpistemicState({ recursion: 0.70 });
    const result = PedagogicalActionSelector.select(
      "recursion", state, COLD_PROFILE, null, "explainer"
    );
    expect(result.action.type).toBe("ask_socratic_question");
  });

  it("switches to role-reversal when mastered", () => {
    const state = makeEpistemicState({ recursion: 0.90 });
    const result = PedagogicalActionSelector.select(
      "recursion", state, COLD_PROFILE, null, "explainer"
    );
    expect(result.action.type).toBe("evaluate_mastery");
    expect(result.suggestedMode).toBe("student");
  });

  it("generates analogy when frustrated + low mastery + analogyAffinity", () => {
    const profileWithAnalogy: TomUserProfile = {
      ...COLD_PROFILE,
      communicationPreferences: {
        ...COLD_PROFILE.communicationPreferences,
        analogyAffinity: true,
      },
      frustrationTriggers: [],
    };
    const state: EpistemicState = {
      studentId: "u1",
      conceptMasteryMap: { recursion: 0.35 },
      adjustedMasteryMap: { recursion: 0.35 },
      frustrationConcepts: ["recursion"],
      updatedAt: Date.now(),
    };
    const result = PedagogicalActionSelector.select(
      "recursion", state, profileWithAnalogy, null, "explainer"
    );
    expect(result.action.type).toBe("generate_analogy");
  });

  it("in Socratic mode: offers hint instead of explanation when mastery too low", () => {
    const state = makeEpistemicState({ recursion: 0.15 });
    const result = PedagogicalActionSelector.select(
      "recursion", state, COLD_PROFILE, null, "socratic"
    );
    expect(result.action.type).toBe("offer_hint");
    expect(result.suggestedMode).toBe("explainer");
  });

  it("in Socratic mode: asks question when mastery is sufficient", () => {
    const state = makeEpistemicState({ recursion: 0.55 });
    const result = PedagogicalActionSelector.select(
      "recursion", state, COLD_PROFILE, null, "socratic"
    );
    expect(result.action.type).toBe("ask_socratic_question");
  });

  it("prioritises false confidence over low mastery", () => {
    let tomState = HighOrderToMTracker.create("u1");
    tomState = HighOrderToMTracker.setGroundTruth(tomState, "recursion", "function calls itself");
    tomState = HighOrderToMTracker.recordStudentBelief(
      tomState, "recursion", "something completely wrong and unrelated", 0.75
    );
    const state = makeEpistemicState({ recursion: 0.75 });
    const result = PedagogicalActionSelector.select(
      "recursion", state, COLD_PROFILE, tomState, "explainer"
    );
    expect(result.action.type).toBe("ask_socratic_question");
    expect(result.suggestedMode).toBe("socratic");
  });

  it("rationale string is non-empty", () => {
    const state = makeEpistemicState({ recursion: 0.5 });
    const result = PedagogicalActionSelector.select(
      "recursion", state, COLD_PROFILE, null, "explainer"
    );
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it("ACTION_THRESHOLDS constant is exported", () => {
    expect(ACTION_THRESHOLDS.MASTERY_GATE).toBe(0.85);
    expect(ACTION_THRESHOLDS.OPTIMAL_ZONE_LOWER).toBe(0.60);
  });
});

// ---------------------------------------------------------------------------
// SocraticRestraintEnforcer
// ---------------------------------------------------------------------------

describe("SocraticRestraintEnforcer", () => {
  it("detects 'the answer is' as a violation", () => {
    expect(SocraticRestraintEnforcer.isViolation("The answer is 42.")).toBe(true);
  });

  it("detects 'the solution is' as a violation", () => {
    expect(SocraticRestraintEnforcer.isViolation("The solution is to use recursion.")).toBe(true);
  });

  it("detects 'you should do' as a violation", () => {
    expect(SocraticRestraintEnforcer.isViolation("You should do a depth-first search.")).toBe(true);
  });

  it("detects 'here's how to' as a violation", () => {
    expect(SocraticRestraintEnforcer.isViolation("Here's how to solve this problem.")).toBe(true);
  });

  it("detects 'simply do' as a violation", () => {
    expect(SocraticRestraintEnforcer.isViolation("Simply do a binary search.")).toBe(true);
  });

  it("does NOT flag a pure question as a violation", () => {
    expect(SocraticRestraintEnforcer.isViolation("What do you think the first step is?")).toBe(false);
  });

  it("does NOT flag a neutral explanation start", () => {
    expect(SocraticRestraintEnforcer.isViolation("Interesting. What have you tried so far?")).toBe(false);
  });

  it("enforceStable rewrites violations to a redirect", () => {
    const original = "The answer is recursion.";
    const result = SocraticRestraintEnforcer.enforceStable(original);
    expect(result).not.toBe(original);
    expect(result.length).toBeGreaterThan(0);
  });

  it("enforceStable leaves non-violating responses unchanged", () => {
    const original = "What do you think about this approach?";
    expect(SocraticRestraintEnforcer.enforceStable(original)).toBe(original);
  });

  it("enforce includes conceptId in rewrite when provided", () => {
    const result = SocraticRestraintEnforcer.enforceStable("The answer is X.", "graphs");
    expect(result).toContain("graphs");
  });

  it("listViolations returns all matched patterns", () => {
    const violations = SocraticRestraintEnforcer.listViolations(
      "The answer is A. Simply do B."
    );
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it("listViolations returns empty array for clean response", () => {
    expect(SocraticRestraintEnforcer.listViolations("What do you already know?")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HintLadder
// ---------------------------------------------------------------------------

describe("HintLadder", () => {
  it("generates level-1 hint", () => {
    const action = HintLadder.generate("recursion", 1);
    expect(action.type).toBe("offer_hint");
    if (action.type === "offer_hint") {
      expect(action.hintLevel).toBe(1);
      expect(action.hintText).toContain("recursion");
    }
  });

  it("generates level-2 hint", () => {
    const action = HintLadder.generate("recursion", 2);
    if (action.type === "offer_hint") {
      expect(action.hintLevel).toBe(2);
    }
  });

  it("generates level-3 hint", () => {
    const action = HintLadder.generate("recursion", 3);
    if (action.type === "offer_hint") {
      expect(action.hintLevel).toBe(3);
    }
  });

  it("level-3 hint is more explicit than level-1", () => {
    const h1 = HintLadder.generate("c1", 1);
    const h3 = HintLadder.generate("c1", 3);
    if (h1.type === "offer_hint" && h3.type === "offer_hint") {
      // Level 3 hint should be longer / more informative
      expect(h3.hintText.length).toBeGreaterThanOrEqual(h1.hintText.length);
    }
  });

  it("escalate 1 → 2", () => {
    expect(HintLadder.escalate(1)).toBe(2);
  });

  it("escalate 2 → 3", () => {
    expect(HintLadder.escalate(2)).toBe(3);
  });

  it("escalate 3 → null (max level)", () => {
    expect(HintLadder.escalate(3)).toBeNull();
  });

  it("startingLevel: high mastery → level 1", () => {
    expect(HintLadder.startingLevel(0.85)).toBe(1);
  });

  it("startingLevel: medium mastery → level 2", () => {
    expect(HintLadder.startingLevel(0.55)).toBe(2);
  });

  it("startingLevel: low mastery → level 3", () => {
    expect(HintLadder.startingLevel(0.30)).toBe(3);
  });

  it("context is included in level-2 hint when provided", () => {
    const action = HintLadder.generate("recursion", 2, "fibonacci sequence");
    if (action.type === "offer_hint") {
      expect(action.hintText).toContain("fibonacci sequence");
    }
  });
});
