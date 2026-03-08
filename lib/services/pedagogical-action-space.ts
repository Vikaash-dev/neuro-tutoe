/**
 * Pedagogical Action Space
 *
 * Replaces the SWE "execution drive" (git / npm / bash) with a
 * teaching-oriented action vocabulary for AI tutoring.
 *
 * Core principle from the problem statement:
 *   "An AI tutor requires the exact opposite behaviour [to OpenHands].
 *    Implementing a 'Confused Student Mode' requires hard-overriding the
 *    agent's action space so it outputs targeted questions instead of
 *    bash commands or file writes."
 *
 * This module provides:
 *   - PedagogicalActionFactory  — constructs well-formed PedagogicalAction objects
 *   - PedagogicalActionSelector — chooses the right action from ToM + BKT signals
 *   - SocraticRestraintEnforcer — hard-blocks direct-answer giving
 *   - HintLadder                — scaffolded hints (1=subtle → 3=direct)
 *
 * Research basis:
 *   - SocraticLM (NeurIPS 2024): AI never gives direct answers; only questions
 *   - arXiv 2512.03501 (SocraticAI): guided query framework
 *   - NeurIPS 2024 LbT: pedagogical action must trigger retrieval practice
 *   - Wilson et al. (2019): 85%-rule → target 0.70–0.85 difficulty zone
 *   - Bloom (1984): corrective loop as primary mastery mechanism
 */

import {
  PedagogicalAction,
  PedagogicalActionResult,
  PedagogicalActionType,
  FeynmanMode,
  EpistemicState,
  TomUserProfile,
  HighOrderToMState,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mastery thresholds that determine action selection */
export const ACTION_THRESHOLDS = {
  /** Below this → always explain, never Socratic */
  TOO_LOW_FOR_SOCRATIC: 0.30,
  /** Above this → concept mastered; advance or use role-reversal */
  MASTERY_GATE: 0.85,
  /** Optimal challenge zone [lower, upper] — Wilson et al. 2019 */
  OPTIMAL_ZONE_LOWER: 0.60,
  OPTIMAL_ZONE_UPPER: 0.85,
  /** Below this AND frustration signal → generate analogy first */
  ANALOGY_FALLBACK_THRESHOLD: 0.50,
} as const;

/** Socratic mode: phrases that constitute giving a direct answer (to be blocked) */
const DIRECT_ANSWER_PATTERNS: readonly RegExp[] = [
  /the answer is\s+/i,
  /the solution is\s+/i,
  /you should do\s+/i,
  /\bhere's how to\b/i,
  /\bsimply\s+(do|use|apply|write)\b/i,
  /\bjust\s+(do|use|run|type)\b/i,
];

/** Templates for Socratic redirection (used when a direct answer is blocked) */
const SOCRATIC_REDIRECTS: readonly string[] = [
  "Rather than telling you directly — what do you already know about this?",
  "Good question! Before I answer, what have you tried so far?",
  "What do you think might be the first step here?",
  "What would need to be true for that to work?",
  "Can you break this problem into smaller parts?",
  "What connection do you see between this and what we discussed earlier?",
];

// ---------------------------------------------------------------------------
// Pedagogical Action Factory
// ---------------------------------------------------------------------------

/**
 * PedagogicalActionFactory
 *
 * Constructs well-typed PedagogicalAction objects with sensible defaults.
 * All factory methods are pure functions (no side effects).
 */
export class PedagogicalActionFactory {
  /** Create an evaluate_mastery probe for a concept. */
  static evaluateMastery(
    conceptId: string,
    probeQuestion?: string
  ): PedagogicalAction {
    return { type: "evaluate_mastery", conceptId, probeQuestion };
  }

  /**
   * Create a generate_analogy action.
   * Default target domain chosen from student profile if available.
   */
  static generateAnalogy(
    conceptId: string,
    studentDepth: number,
    targetDomain: string = "everyday life"
  ): PedagogicalAction {
    return { type: "generate_analogy", conceptId, targetDomain, studentDepth };
  }

  /** Create an ask_socratic_question action targeting a specific gap. */
  static askSocraticQuestion(
    conceptId: string,
    targetGap: string,
    questionText: string
  ): PedagogicalAction {
    return { type: "ask_socratic_question", conceptId, targetGap, questionText };
  }

  /** Create a provide_correction action (Bloom corrective loop). */
  static provideCorrection(
    conceptId: string,
    gapDescription: string,
    correctionText: string,
    retryQuestionId: string
  ): PedagogicalAction {
    return {
      type: "provide_correction",
      conceptId,
      gapDescription,
      correctionText,
      retryQuestionId,
    };
  }

  /** Create an adjust_difficulty action. */
  static adjustDifficulty(
    conceptId: string,
    direction: "lower" | "raise" | "maintain",
    reason: string
  ): PedagogicalAction {
    return { type: "adjust_difficulty", conceptId, direction, reason };
  }

  /** Create a trigger_review action for spaced repetition. */
  static triggerReview(
    conceptIds: string[],
    urgency: "immediate" | "end_of_session" | "next_session" = "end_of_session"
  ): PedagogicalAction {
    return { type: "trigger_review", conceptIds, urgency };
  }

  /** Create an explain_concept action. */
  static explainConcept(
    conceptId: string,
    explanation: string,
    mode: FeynmanMode = "explainer"
  ): PedagogicalAction {
    return { type: "explain_concept", conceptId, explanation, mode };
  }

  /** Create an offer_hint action. */
  static offerHint(
    conceptId: string,
    hintLevel: 1 | 2 | 3,
    hintText: string
  ): PedagogicalAction {
    return { type: "offer_hint", conceptId, hintLevel, hintText };
  }

  /** Wrap an action in a PedagogicalActionResult. */
  static toResult(
    action: PedagogicalAction,
    output: string,
    masteryUpdated = false,
    newMasteryP?: number
  ): PedagogicalActionResult {
    return {
      action,
      executedAt: Date.now(),
      output,
      masteryUpdated,
      newMasteryP,
    };
  }
}

// ---------------------------------------------------------------------------
// Pedagogical Action Selector
// ---------------------------------------------------------------------------

/**
 * PedagogicalActionSelector
 *
 * Selects the optimal pedagogical action given:
 *   - EpistemicState (ToM-fused BKT mastery)
 *   - TomUserProfile (psychological profile)
 *   - HighOrderToMState (nested beliefs / false confidence)
 *   - Current Feynman mode
 *
 * Decision logic implements the "closed loop" from the problem statement:
 *   Student Text → Overload Detection → ToM → BKT → Action Selection
 */
export class PedagogicalActionSelector {
  /**
   * Select the best action for the given concept + student state.
   *
   * @param conceptId       Target concept.
   * @param epistemicState  Fused ToM+BKT state.
   * @param tomProfile      Psychological profile.
   * @param highOrderState  Nested belief state.
   * @param currentMode     Active Feynman teaching mode.
   */
  static select(
    conceptId: string,
    epistemicState: EpistemicState,
    tomProfile: TomUserProfile,
    highOrderState: HighOrderToMState | null,
    currentMode: FeynmanMode
  ): { action: PedagogicalAction; rationale: string; suggestedMode: FeynmanMode | null } {
    const rawP = epistemicState.conceptMasteryMap[conceptId] ?? 0.10;
    const adjP = epistemicState.adjustedMasteryMap[conceptId] ?? rawP;
    const isFrustrated = epistemicState.frustrationConcepts.includes(conceptId);
    const hasFalseConfidence = highOrderState?.falseConfidenceConcepts.includes(conceptId) ?? false;

    // ---- Socratic mode constraints ----------------------------------------
    if (currentMode === "socratic") {
      // In Socratic mode, always ask a question — never explain directly
      if (adjP < ACTION_THRESHOLDS.TOO_LOW_FOR_SOCRATIC) {
        // Too low mastery for Socratic — student can't engage with questions
        // Graceful degradation: offer a minimal hint instead
        return {
          action: PedagogicalActionFactory.offerHint(
            conceptId,
            1,
            "Think about the fundamental definition of this concept first."
          ),
          rationale: `Mastery ${adjP.toFixed(2)} too low for Socratic dialogue — offering subtle hint`,
          suggestedMode: "explainer",
        };
      }
      return {
        action: PedagogicalActionFactory.askSocraticQuestion(
          conceptId,
          "current understanding",
          `What would you say is the core principle behind ${conceptId}?`
        ),
        rationale: `Socratic mode: asking guided question (mastery=${adjP.toFixed(2)})`,
        suggestedMode: null,
      };
    }

    // ---- Priority 1: False confidence (most dangerous state) ----------------
    if (hasFalseConfidence) {
      return {
        action: PedagogicalActionFactory.askSocraticQuestion(
          conceptId,
          "expressed but flawed understanding",
          `I'd like to explore your understanding — can you give me a concrete example of ${conceptId}?`
        ),
        rationale: `False confidence detected: student thinks they know ${conceptId} but belief is flawed`,
        suggestedMode: "socratic",
      };
    }

    // ---- Priority 2: Frustration + low mastery → analogy ------------------
    if (isFrustrated && adjP < ACTION_THRESHOLDS.ANALOGY_FALLBACK_THRESHOLD) {
      const domain = tomProfile.communicationPreferences.analogyAffinity ? "everyday life" : "sports";
      return {
        action: PedagogicalActionFactory.generateAnalogy(conceptId, 5, domain),
        rationale: `Frustration detected + mastery=${adjP.toFixed(2)} → analogy fallback (Ranedeer parameter)`,
        suggestedMode: "explainer",
      };
    }

    // ---- Priority 3: Very low mastery → explain ---------------------------
    if (adjP < ACTION_THRESHOLDS.OPTIMAL_ZONE_LOWER) {
      return {
        action: PedagogicalActionFactory.explainConcept(
          conceptId,
          `Let me explain ${conceptId} from the beginning.`,
          "explainer"
        ),
        rationale: `Mastery=${adjP.toFixed(2)} below optimal zone — explanation needed`,
        suggestedMode: "explainer",
      };
    }

    // ---- Priority 4: Mastered → role reversal (LbT) ----------------------
    if (adjP >= ACTION_THRESHOLDS.MASTERY_GATE) {
      return {
        action: PedagogicalActionFactory.evaluateMastery(
          conceptId,
          `Can you teach me about ${conceptId} as if I were a beginner?`
        ),
        rationale: `Mastery=${adjP.toFixed(2)} ≥ gate — switching to role-reversal (LbT)`,
        suggestedMode: "student",
      };
    }

    // ---- Priority 5: Optimal zone → Socratic scaffolding -----------------
    return {
      action: PedagogicalActionFactory.askSocraticQuestion(
        conceptId,
        "deeper understanding",
        `You're making good progress. What do you think would happen if we changed one key assumption about ${conceptId}?`
      ),
      rationale: `Mastery=${adjP.toFixed(2)} in optimal zone — Socratic scaffolding`,
      suggestedMode: adjP > 0.75 ? "socratic" : null,
    };
  }
}

// ---------------------------------------------------------------------------
// Socratic Restraint Enforcer
// ---------------------------------------------------------------------------

/**
 * SocraticRestraintEnforcer
 *
 * Hard-blocks any AI response that contains direct answers in Socratic mode.
 * This implements the architectural constraint from the problem statement:
 *   "Implementing a Confused Student Mode requires hard-overriding the
 *    agent's action space so it outputs targeted questions instead of
 *    bash commands or file writes."
 *
 * In pedagogical terms: the Socratic tutor NEVER says "the answer is X".
 */
export class SocraticRestraintEnforcer {
  /**
   * Check whether a generated response violates Socratic restraint.
   * Returns true if the response contains a direct answer pattern.
   */
  static isViolation(response: string): boolean {
    return DIRECT_ANSWER_PATTERNS.some((pattern) => pattern.test(response));
  }

  /**
   * Rewrite a violating response into a Socratic redirection.
   * If no violation, returns the original response unchanged.
   */
  static enforce(response: string, conceptId?: string): string {
    if (!SocraticRestraintEnforcer.isViolation(response)) {
      return response;
    }

    // Replace with a Socratic redirect
    const redirect = SOCRATIC_REDIRECTS[
      Math.floor(Math.random() * SOCRATIC_REDIRECTS.length)
    ];

    return conceptId
      ? `${redirect} (regarding ${conceptId})`
      : redirect;
  }

  /**
   * Deterministic version of enforce (for testing) — always picks the first redirect.
   */
  static enforceStable(response: string, conceptId?: string): string {
    if (!SocraticRestraintEnforcer.isViolation(response)) {
      return response;
    }
    const redirect = SOCRATIC_REDIRECTS[0];
    return conceptId ? `${redirect} (regarding ${conceptId})` : redirect;
  }

  /**
   * Get a list of all detected violations in the response.
   */
  static listViolations(response: string): string[] {
    return DIRECT_ANSWER_PATTERNS
      .filter((pattern) => pattern.test(response))
      .map((pattern) => pattern.toString());
  }
}

// ---------------------------------------------------------------------------
// Hint Ladder
// ---------------------------------------------------------------------------

/**
 * HintLadder
 *
 * Provides a three-level scaffolded hint system:
 *   Level 1 — Subtle: conceptual direction without revealing the answer
 *   Level 2 — Moderate: structural hint (what kind of thing to look for)
 *   Level 3 — Direct: near-complete hint with one step remaining
 *
 * Inspired by ZPD (Vygotsky 1978) — hints close the gap gradually,
 * maintaining productive cognitive effort.
 */
export class HintLadder {
  /**
   * Generate a hint at the requested level for a concept.
   *
   * @param conceptId    Target concept.
   * @param currentLevel Current hint level (1, 2, or 3).
   * @param context      Optional additional context (e.g. the question text).
   */
  static generate(
    conceptId: string,
    currentLevel: 1 | 2 | 3,
    context?: string
  ): PedagogicalAction {
    const hintTexts: Record<1 | 2 | 3, string> = {
      1: `Consider what the fundamental definition of ${conceptId} implies in this situation.`,
      2: `Think about the key properties of ${conceptId}. ${context ? `In context: "${context.substring(0, 60)}"` : ""} What property is most relevant here?`,
      3: `You're very close. The key insight is to apply the core rule of ${conceptId} directly to the input. One more step and you'll have it.`,
    };

    return PedagogicalActionFactory.offerHint(conceptId, currentLevel, hintTexts[currentLevel]);
  }

  /**
   * Escalate to the next hint level.
   * Returns null if already at level 3 (should provide correction instead).
   */
  static escalate(currentLevel: 1 | 2 | 3): 2 | 3 | null {
    if (currentLevel === 1) return 2;
    if (currentLevel === 2) return 3;
    return null; // at max — time for a correction
  }

  /**
   * Determine the appropriate starting hint level based on mastery.
   * High mastery → subtle hint; low mastery → more direct.
   */
  static startingLevel(pMastered: number): 1 | 2 | 3 {
    if (pMastered >= 0.7) return 1;
    if (pMastered >= 0.45) return 2;
    return 3;
  }
}
