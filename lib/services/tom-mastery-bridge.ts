/**
 * ToM ↔ Mastery Bridge
 *
 * Fuses the psychological Theory of Mind profile (TomUserProfile / Tier 3)
 * with the quantitative knowledge tracing layer (BKT mastery probabilities)
 * to produce a unified TomMasteryDecision.
 *
 * This bridge implements the critical architectural requirement from the
 * problem statement:
 *
 *   "The agent shouldn't just know the user 'gets frustrated easily' (ToM);
 *    it needs to know they are frustrated *because* their mastery of
 *    'Graph Traversal' is only at 0.45, triggering a fallback to
 *    'Visual Analogies' (Mr. Ranedeer parameters)."
 *
 * Design decisions:
 *   - Produce a human-readable `rationale` string for every decision
 *     (transparency requirement, EDM 2025 Responsible-AI metrics).
 *   - Use `adjustedMastery` (ToM-penalised) not raw BKT mastery, so that
 *     frustration states are reflected in the decision.
 *   - Recommend a Ranedeer mode (FeynmanMode) alongside the action, so
 *     the Feynman Engine can update its teaching mode in one atomic step.
 *
 * Research basis:
 *   - OpenHands ToM-SWE: ToM profile injected into agent decision loop
 *   - Hegde & Jayalath (2025): frustration → cognitive load → lower recall
 *   - Bloom (1984): corrective loop as mastery recovery mechanism
 *   - Wilson et al. (2019): 85%-rule zone drives difficulty adjustment
 *   - ProfiLLM (arXiv:2506.13980): implicit profile merges with task state
 */

import {
  EpistemicState,
  FeynmanMode,
  HighOrderToMState,
  PedagogicalAction,
  TomMasteryDecision,
  TomUserProfile,
} from "@/lib/types/learning";
import { PedagogicalActionFactory, PedagogicalActionSelector } from "./pedagogical-action-space";

// ---------------------------------------------------------------------------
// Affect → Mastery penalty mapping
// ---------------------------------------------------------------------------

/**
 * Affect penalty: how much to reduce effective mastery based on ToM affect signal.
 * (Hegde & Jayalath 2025: frustration impairs retrieval by up to 20%)
 */
const AFFECT_MASTERY_PENALTIES: Record<string, number> = {
  positive:    0.00,  // no penalty
  neutral:     0.00,
  confused:    0.08,  // 8% reduction
  frustrated:  0.18,  // 18% reduction
  disengaged:  0.12,  // 12% reduction
};

/** Ranedeer learning style → analogy target domain mapping */
const STYLE_TO_DOMAIN: Record<string, string> = {
  visual:     "visual diagrams",
  active:     "hands-on practice",
  intuitive:  "big-picture patterns",
  reflective: "logical reasoning",
  global:     "real-world systems",
  verbal:     "everyday language",
};

// ---------------------------------------------------------------------------
// TomMasteryBridge — main facade
// ---------------------------------------------------------------------------

/**
 * TomMasteryBridge
 *
 * Produces unified TomMasteryDecision objects by reasoning jointly over:
 *   1. Raw BKT mastery probability (p_mastered)
 *   2. ToM affect signal (frustrated / confused / disengaged)
 *   3. TomUserProfile communication preferences + frustration triggers
 *   4. HighOrderToMState (false confidence, flawed beliefs)
 *   5. Current Feynman teaching mode
 */
export class TomMasteryBridge {
  /**
   * Produce a TomMasteryDecision for one concept + student state.
   *
   * @param studentId       Student identifier.
   * @param conceptId       Target concept.
   * @param rawMastery      Raw BKT p_mastered (0-1).
   * @param affectSignal    Current session affect (from SessionAnalysis.affectSignal).
   * @param tomProfile      Tier-3 psychological profile.
   * @param epistemicState  ToM-fused epistemic state (may be derived from tomProfile).
   * @param highOrderState  Optional second-order belief state.
   * @param currentMode     Active Feynman mode.
   */
  static reason(
    studentId: string,
    conceptId: string,
    rawMastery: number,
    affectSignal: "positive" | "neutral" | "frustrated" | "confused" | "disengaged",
    tomProfile: TomUserProfile,
    epistemicState: EpistemicState,
    highOrderState: HighOrderToMState | null,
    currentMode: FeynmanMode = "explainer"
  ): TomMasteryDecision {
    // ---- Step 1: affect-adjusted mastery -----------------------------------
    const afPenalty = AFFECT_MASTERY_PENALTIES[affectSignal] ?? 0;
    const affectAdjustedMastery = Math.max(0, rawMastery * (1 - afPenalty));

    // ---- Step 2: build rationale parts ------------------------------------
    const rationaleParts: string[] = [];
    rationaleParts.push(
      `raw mastery=${rawMastery.toFixed(2)}; affect=${affectSignal}; adjusted=${affectAdjustedMastery.toFixed(2)}`
    );

    // ---- Step 3: delegate action selection to PedagogicalActionSelector ---
    const selection = PedagogicalActionSelector.select(
      conceptId,
      epistemicState,
      tomProfile,
      highOrderState,
      currentMode
    );

    // ---- Step 4: override action if frustration + analogy affinity --------
    let finalAction: PedagogicalAction = selection.action;
    let finalMode: FeynmanMode | null = selection.suggestedMode;

    if (
      (affectSignal === "frustrated" || affectSignal === "confused") &&
      rawMastery < 0.55 &&
      tomProfile.communicationPreferences.analogyAffinity
    ) {
      const domain = STYLE_TO_DOMAIN[tomProfile.workingStyle] ?? "everyday life";
      finalAction = PedagogicalActionFactory.generateAnalogy(
        conceptId,
        5, // default depth
        domain
      );
      finalMode = "explainer";
      rationaleParts.push(
        `→ analogy fallback (analogyAffinity=true, domain="${domain}")`
      );
    } else {
      rationaleParts.push(`→ ${selection.action.type} (${selection.rationale})`);
    }

    // ---- Step 5: check Ranedeer profile for verbosity preference ----------
    if (
      tomProfile.communicationPreferences.verbosity === "concise" &&
      finalAction.type === "explain_concept"
    ) {
      rationaleParts.push("→ concise mode (student prefers brevity)");
    }

    // ---- Step 6: compose human-readable rationale -------------------------
    const rationale = rationaleParts.join("; ");

    return {
      studentId,
      conceptId,
      rawMastery,
      affectAdjustedMastery,
      recommendedAction: finalAction,
      rationale,
      suggestedMode: finalMode,
      decidedAt: Date.now(),
    };
  }

  /**
   * Batch decision: produce decisions for multiple concepts at once.
   * Returns decisions sorted by urgency (lowest adjusted mastery first).
   */
  static reasonBatch(
    studentId: string,
    conceptIds: string[],
    affectSignal: "positive" | "neutral" | "frustrated" | "confused" | "disengaged",
    tomProfile: TomUserProfile,
    epistemicState: EpistemicState,
    highOrderState: HighOrderToMState | null,
    currentMode: FeynmanMode = "explainer"
  ): TomMasteryDecision[] {
    return conceptIds
      .map((conceptId) => {
        const rawMastery = epistemicState.conceptMasteryMap[conceptId] ?? 0.10;
        return TomMasteryBridge.reason(
          studentId,
          conceptId,
          rawMastery,
          affectSignal,
          tomProfile,
          epistemicState,
          highOrderState,
          currentMode
        );
      })
      .sort((a, b) => a.affectAdjustedMastery - b.affectAdjustedMastery);
  }
}

// ---------------------------------------------------------------------------
// TomCodeActAgent — orchestration facade
// ---------------------------------------------------------------------------

/**
 * TomCodeActAgent
 *
 * Intercepts the pedagogical decision loop and injects ToM-aware
 * personalised instructions before the tutor agent acts.
 *
 * This is the pedagogical equivalent of OpenHands' `TomCodeActAgent`:
 * instead of injecting "use conventional commits" or "prefer async/await",
 * it injects "use analogies for this student" or "switch to Socratic mode".
 *
 * The agent operates in three phases per turn:
 *   1. PERCEIVE:  Read the current ToM profile + epistemic state.
 *   2. DECIDE:    Call TomMasteryBridge.reason() for the active concept.
 *   3. INJECT:    Prepend the ToM instruction to the system prompt.
 */
export class TomCodeActAgent {
  private currentMode: FeynmanMode;
  private turnCount = 0;

  constructor(initialMode: FeynmanMode = "explainer") {
    this.currentMode = initialMode;
  }

  /**
   * Process one conversation turn.
   * Returns the ToM-aware pedagogical decision and the updated mode.
   */
  processTurn(
    studentId: string,
    conceptId: string,
    rawMastery: number,
    affectSignal: "positive" | "neutral" | "frustrated" | "confused" | "disengaged",
    tomProfile: TomUserProfile,
    epistemicState: EpistemicState,
    highOrderState: HighOrderToMState | null
  ): {
    decision: TomMasteryDecision;
    systemPromptInjection: string;
    modeChanged: boolean;
  } {
    this.turnCount++;

    const decision = TomMasteryBridge.reason(
      studentId,
      conceptId,
      rawMastery,
      affectSignal,
      tomProfile,
      epistemicState,
      highOrderState,
      this.currentMode
    );

    const modeChanged = decision.suggestedMode !== null &&
      decision.suggestedMode !== this.currentMode;

    if (modeChanged && decision.suggestedMode !== null) {
      this.currentMode = decision.suggestedMode;
    }

    const injection = TomCodeActAgent.buildSystemPromptInjection(
      decision,
      tomProfile,
      this.currentMode
    );

    return { decision, systemPromptInjection: injection, modeChanged };
  }

  /** Build the system prompt injection from a TomMasteryDecision. */
  static buildSystemPromptInjection(
    decision: TomMasteryDecision,
    tomProfile: TomUserProfile,
    activeMode: FeynmanMode
  ): string {
    const lines: string[] = [
      "=== ToM-SWE PEDAGOGICAL INJECTION ===",
      `Student mastery of "${decision.conceptId}": ${(decision.affectAdjustedMastery * 100).toFixed(0)}%`,
      `Recommended action: ${decision.recommendedAction.type}`,
      `Rationale: ${decision.rationale}`,
      "",
      "Student profile:",
      `  Working style: ${tomProfile.workingStyle}`,
      `  Prefers analogies: ${tomProfile.communicationPreferences.analogyAffinity}`,
      `  Prefers examples: ${tomProfile.communicationPreferences.exampleAffinity}`,
      `  Verbosity: ${tomProfile.communicationPreferences.verbosity}`,
    ];

    if (tomProfile.implicitNeeds.length > 0) {
      lines.push(`  Implicit needs: ${tomProfile.implicitNeeds.slice(0, 2).join(", ")}`);
    }

    lines.push(`Active Feynman mode: ${activeMode}`);
    lines.push("=== END ToM-SWE INJECTION ===");

    return lines.join("\n");
  }

  get mode(): FeynmanMode {
    return this.currentMode;
  }

  get turns(): number {
    return this.turnCount;
  }
}

// ---------------------------------------------------------------------------
// Context Coherence Monitor
// ---------------------------------------------------------------------------

/**
 * ContextCoherenceMonitor
 *
 * Monitors the HighOrderToMState's `contextCoherenceScore` and triggers
 * a "context reset" strategy when it falls below a critical threshold.
 *
 * Context collapse is a known failure mode for LLMs holding conflicting
 * belief states over long sessions (as identified in the problem statement
 * for second-order ToM).
 */
export class ContextCoherenceMonitor {
  static readonly CRITICAL_THRESHOLD = 0.40;
  static readonly WARNING_THRESHOLD  = 0.65;

  /**
   * Assess the coherence state and return a recommended response.
   */
  static assess(
    state: HighOrderToMState
  ): {
    level: "ok" | "warning" | "critical";
    recommendation: string;
    shouldReset: boolean;
  } {
    const { contextCoherenceScore } = state;

    if (contextCoherenceScore < this.CRITICAL_THRESHOLD) {
      return {
        level: "critical",
        recommendation:
          "Context coherence is critically low — too many contradictory beliefs held simultaneously. " +
          "Recommend: summarise session progress, resolve top flawed belief, then restart focused on one concept.",
        shouldReset: true,
      };
    }

    if (contextCoherenceScore < this.WARNING_THRESHOLD) {
      return {
        level: "warning",
        recommendation:
          "Context coherence is degrading. " +
          `${state.falseConfidenceConcepts.length} false-confidence concepts detected. ` +
          "Recommend: Socratic intervention on the most critical belief mismatch.",
        shouldReset: false,
      };
    }

    return {
      level: "ok",
      recommendation: "Context coherence is healthy. Continue current strategy.",
      shouldReset: false,
    };
  }

  /**
   * Generate a session summary prompt for context reset.
   * Used when coherence falls below CRITICAL_THRESHOLD.
   */
  static buildResetPrompt(state: HighOrderToMState): string {
    const flawed = Object.values(state.studentBeliefMap)
      .filter((b) => b.isFlawed)
      .slice(0, 3);

    return [
      "Let's take a step back and consolidate what we've covered.",
      "",
      flawed.length > 0
        ? `I want to revisit ${flawed.map((b) => b.conceptId).join(", ")} — ` +
          "I think there might be some gaps in our current understanding."
        : "Let me summarise what we've established so far.",
      "",
      "Once we've aligned on the fundamentals, we'll move forward more efficiently.",
    ].join("\n");
  }
}
