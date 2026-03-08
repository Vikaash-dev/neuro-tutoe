/**
 * Pedagogical Action Space
 *
 * Replaces the SWE execution action space (git commit, npm install, bash) with
 * a principled pedagogical action vocabulary.
 *
 * Problem statement insight (OpenHands critique):
 *   "An AI tutor does not need access to `git commit` or `npm install`.
 *    Replace the SWE action space with a Pedagogical action space:
 *    evaluate_mastery(), generate_analogy(), ask_socratic_question()."
 *
 * This module defines:
 *   1. The complete Pedagogical Action taxonomy.
 *   2. An ActionConstraintEngine that BLOCKS execution-style actions.
 *   3. A PedagogicalActionSelector that chooses the *right* action given the
 *      student's current epistemic state and ToM profile (Criterion C: Socratic
 *      Restraint — the agent is PROHIBITED from giving direct answers when
 *      mastery < threshold, and REQUIRED to use questioning or analogy modes).
 *   4. "Confused Student Mode" — the agent pretends to be confused to trigger
 *      Feynman "teach back" (role reversal).
 *
 * Reference:
 *   OpenHands CodeActAgent action taxonomy (stripped for tutoring)
 *   Mr. Ranedeer AI Tutor parameters (github.com/JushBJJ/Mr.-Ranedeer-AI-Tutor)
 *   Bloom's Taxonomy revised (Anderson & Krathwohl, 2001)
 */

import { UserProfile, FrustrationLevel } from "./tom-user-profiler";
import { EpistemicState } from "./epistemic-state-tracker";

import type {
  PedagogicalAction as LegacyPedagogicalAction,
  PedagogicalActionResult,
  EpistemicState as LegacyEpistemicState,
  TomUserProfile,
  HighOrderToMState,
  FeynmanMode,
} from "@/lib/types/learning";

// ============================================================================
// ACTION TAXONOMY
// ============================================================================

/** Every action the tutoring agent is permitted to take. */
export type PedagogicalActionType =
  // ── Assessment actions ───────────────────────────────────────────────────
  | "evaluate_mastery"         // Run a mastery probe (quiz / Socratic check)
  | "probe_misconception"      // Ask a targeted question to surface a specific misconception
  // ── Teaching actions ────────────────────────────────────────────────────
  | "explain_concept"          // Direct explanation (only when mastery is very low AND student is not in Socratic mode)
  | "generate_analogy"         // Provide an analogy mapping new concept to known domain
  | "show_worked_example"      // Walk through a concrete example step-by-step
  | "draw_concept_map"         // Produce a text-based concept map / diagram
  // ── Socratic / Guided-discovery actions ─────────────────────────────────
  | "ask_socratic_question"    // Guide student toward insight via questioning
  | "give_hint"                // Provide a minimal nudge without revealing the answer
  | "trigger_confused_student" // Role reversal: agent acts confused, student must explain
  // ── Motivational / Metacognitive actions ────────────────────────────────
  | "acknowledge_frustration"  // Validate student frustration before continuing
  | "celebrate_breakthrough"   // Reinforce a moment of understanding
  | "suggest_break"            // Recommend a short break when overload detected
  | "reframe_difficulty"       // Reframe a difficult concept as a desirable challenge
  // ── Meta-pedagogical actions ────────────────────────────────────────────
  | "switch_modality"          // Change explanation style (visual → verbal → example)
  | "step_back_prerequisite"   // Step back to a prerequisite that gaps analysis reveals
  | "advance_to_challenge"     // Move to a harder problem when student is excelling
  | "select_pedagogy";         // Explicitly announce a pedagogical strategy change

/**
 * BLOCKED actions (execution-drive residuals from the SWE agent).
 *
 * These are prohibited in the tutoring context for two reasons:
 *  1. Autonomy conflict: performing these actions *for* the student short-circuits
 *     learning (the tutoring equivalent of doing a student's homework).
 *  2. Trust boundary: a tutor agent should not have write access to the student's
 *     filesystem or shell. `read_file` is also blocked here because the tutoring
 *     agent should only access content that has been explicitly shared through the
 *     conversational context — not autonomously retrieve files behind the scenes.
 *     Educational content access is handled through the RAG pipeline instead.
 */
export const BLOCKED_SWE_ACTIONS = [
  "run_bash",
  "write_file",
  "git_commit",
  "npm_install",
  "execute_code",
  "read_file",
  "search_web",
] as const;

export type BlockedSWEAction = typeof BLOCKED_SWE_ACTIONS[number];

// ============================================================================
// PEDAGOGICAL ACTION PAYLOAD
// ============================================================================

/** A resolved, ready-to-execute pedagogical action. */
export interface PedagogicalAction {
  type: PedagogicalActionType;
  /** Human-readable instruction for the LLM prompt. */
  instruction: string;
  /** Target concept for this action. */
  conceptId: string;
  /** Mastery level that triggered this action selection (0-1). */
  triggerMasteryScore: number;
  /** Bloom level this action targets (1=remember … 6=create). */
  bloomLevel: 1 | 2 | 3 | 4 | 5 | 6;
  /** Whether this action is in "Socratic restraint" mode (no direct answers). */
  socraticRestraintActive: boolean;
  /** Whether the agent is in "Confused Student Mode". */
  confusedStudentModeActive: boolean;
  metadata: Record<string, unknown>;
}

/** Possible outcomes observed after executing an action. */
export type ActionOutcome =
  | "student_understood"
  | "student_confused"
  | "student_frustrated"
  | "student_engaged"
  | "breakthrough"
  | "no_change";

export interface ActionFeedback {
  action: PedagogicalAction;
  outcome: ActionOutcome;
  studentResponse: string;
  masteryDelta: number; // change in mastery score after this action
  timestamp: number;
}

// ============================================================================
// ACTION CONSTRAINT ENGINE
// ============================================================================

/**
 * Hard-blocks any SWE-style execution actions and enforces Socratic Restraint.
 *
 * "To use OpenHands as a tutor, you have to actively fight its core nature.
 *  The CodeActAgent will instinctively try to write the solution. Implementing
 *  'Confused Student Mode' requires hard-overriding the agent's action space."
 */
export class ActionConstraintEngine {
  /** Mastery threshold below which direct explanation IS allowed. */
  static readonly DIRECT_EXPLAIN_MASTERY_THRESHOLD = 0.25;
  /** Mastery threshold above which Socratic questioning is enforced. */
  static readonly SOCRATIC_RESTRAINT_THRESHOLD = 0.40;
  /** Mastery threshold above which "Confused Student Mode" unlocks. */
  static readonly CONFUSED_STUDENT_THRESHOLD = 0.55;

  /** Returns true if the action type is completely prohibited. */
  isBlocked(actionType: string): boolean {
    return (BLOCKED_SWE_ACTIONS as readonly string[]).includes(actionType);
  }

  /**
   * Given a proposed action and the current epistemic state, return the
   * action (possibly overridden) that is actually permissible.
   *
   * Override rules (in priority order):
   *  1. If proposed action is a BLOCKED SWE action → replace with ask_socratic_question.
   *  2. If `explain_concept` is proposed but mastery ≥ SOCRATIC_RESTRAINT_THRESHOLD
   *     → replace with ask_socratic_question (Socratic Restraint active).
   *  3. If mastery ≥ CONFUSED_STUDENT_THRESHOLD and student has answered ≥ 2 questions
   *     → allow trigger_confused_student (role reversal).
   *  4. If frustration is "high" or "overwhelmed" → prepend acknowledge_frustration.
   */
  constrainAction(
    proposedType: string,
    mastery: number,
    frustration: FrustrationLevel,
    conceptId: string,
    studentResponseCount: number
  ): PedagogicalActionType {
    // Rule 1 — Block SWE actions
    if (this.isBlocked(proposedType)) {
      return "ask_socratic_question";
    }

    // Rule 2 — Socratic restraint: don't give direct answers when student has some knowledge
    if (
      proposedType === "explain_concept" &&
      mastery >= ActionConstraintEngine.SOCRATIC_RESTRAINT_THRESHOLD
    ) {
      return "ask_socratic_question";
    }

    // Rule 3 — Confused Student Mode when student is sufficiently capable
    if (
      proposedType === "trigger_confused_student" &&
      mastery < ActionConstraintEngine.CONFUSED_STUDENT_THRESHOLD
    ) {
      // Not ready yet — use give_hint instead
      return "give_hint";
    }

    // Rule 4 — Frustration override
    if (
      (frustration === "high" || frustration === "overwhelmed") &&
      !["acknowledge_frustration", "suggest_break"].includes(proposedType)
    ) {
      return "acknowledge_frustration";
    }

    return proposedType as PedagogicalActionType;
  }

  /**
   * Check if Socratic Restraint is currently active.
   * When active, the agent MUST NOT give a direct answer.
   */
  isSocraticRestraintActive(mastery: number): boolean {
    return mastery >= ActionConstraintEngine.SOCRATIC_RESTRAINT_THRESHOLD;
  }

  /**
   * Check if Confused Student Mode should be triggered.
   */
  shouldTriggerConfusedStudentMode(mastery: number, sessionInteractionCount: number): boolean {
    return (
      mastery >= ActionConstraintEngine.CONFUSED_STUDENT_THRESHOLD &&
      sessionInteractionCount >= 3
    );
  }
}

// ============================================================================
// PEDAGOGICAL ACTION SELECTOR
// ============================================================================

/**
 * Selects the optimal pedagogical action given:
 *  - The student's current epistemic state (mastery probability from DKT)
 *  - Their ToM profile (preferred modality, frustration triggers)
 *  - The current session context (recent interactions, breakthrough signals)
 *
 * This is the "action layer" that replaces the CodeActAgent's execution planner.
 */
export class PedagogicalActionSelector {
  private constraintEngine: ActionConstraintEngine;

  constructor() {
    this.constraintEngine = new ActionConstraintEngine();
  }

  /**
   * Select the best next pedagogical action.
   *
   * @param conceptId - Concept currently being taught.
   * @param epistemicState - Current DKT mastery estimate.
   * @param profile - Student's long-term ToM profile.
   * @param sessionContext - Recent session events and interaction count.
   */
  selectAction(
    conceptId: string,
    epistemicState: EpistemicState,
    profile: UserProfile,
    sessionContext: SessionContext
  ): PedagogicalAction {
    const mastery = epistemicState.masteryProbability;
    const frustration = profile.averageFrustrationLevel;
    const socraticActive = this.constraintEngine.isSocraticRestraintActive(mastery);

    // ── Priority 1: Frustration / motivational override ─────────────────────
    if (frustration === "overwhelmed" || frustration === "high") {
      if (sessionContext.recentFrustrationSignals >= 2) {
        return this.buildAction("acknowledge_frustration", conceptId, mastery, 1, false, false, {
          reason: "high_frustration",
        });
      }
      if (mastery < 0.3) {
        return this.buildAction("step_back_prerequisite", conceptId, mastery, 1, false, false, {
          reason: "mastery_too_low_with_frustration",
        });
      }
    }

    // ── Priority 2: Second-order belief mismatch (Confused Student Mode) ────
    if (
      epistemicState.hasFlawedMentalModel &&
      this.constraintEngine.shouldTriggerConfusedStudentMode(mastery, sessionContext.interactionCount)
    ) {
      return this.buildAction("trigger_confused_student", conceptId, mastery, 4, true, true, {
        flawedBelief: epistemicState.studentSelfAssessedMastery,
        actualMastery: mastery,
      });
    }

    // ── Priority 3: New concept (mastery very low) ───────────────────────────
    if (mastery < ActionConstraintEngine.DIRECT_EXPLAIN_MASTERY_THRESHOLD) {
      // Very first encounter — direct explanation is warranted
      const actionType = profile.preferredModality === "example-based"
        ? "show_worked_example"
        : profile.preferredModality === "visual"
        ? "draw_concept_map"
        : "explain_concept";
      return this.buildAction(actionType, conceptId, mastery, 1, false, false, {
        modality: profile.preferredModality,
      });
    }

    // ── Priority 4: Misconception detected ──────────────────────────────────
    if (
      epistemicState.activeMisconceptions.length > 0 &&
      profile.persistentMisconceptions[epistemicState.activeMisconceptions[0]] !== undefined
    ) {
      return this.buildAction("probe_misconception", conceptId, mastery, 2, socraticActive, false, {
        misconception: epistemicState.activeMisconceptions[0],
      });
    }

    // ── Priority 5: Socratic zone (mastery 0.25–0.75) ────────────────────────
    if (mastery < 0.75) {
      // Within Socratic zone — guide via questions
      if (sessionContext.consecutiveCorrectAnswers >= 2) {
        // Student is doing well — give a harder Socratic question
        return this.buildAction("ask_socratic_question", conceptId, mastery, 3, true, false, {
          difficulty: "probing",
        });
      }
      if (sessionContext.recentHintRequests >= 2) {
        return this.buildAction("generate_analogy", conceptId, mastery, 2, false, false, {
          analogyDomain: profile.analogyResonanceTopics[0] ?? "everyday life",
        });
      }
      return this.buildAction("ask_socratic_question", conceptId, mastery, 3, true, false, {
        difficulty: "leading",
      });
    }

    // ── Priority 6: High mastery — consolidation / advance ───────────────────
    if (mastery >= 0.85) {
      return this.buildAction("advance_to_challenge", conceptId, mastery, 5, false, false, {
        bloomLevel: 5,
      });
    }

    // ── Default: evaluate and probe ──────────────────────────────────────────
    return this.buildAction("evaluate_mastery", conceptId, mastery, 4, false, false, {});
  }

  /**
   * Build a PedagogicalAction with the appropriate LLM instruction.
   */
  buildAction(
    type: PedagogicalActionType,
    conceptId: string,
    mastery: number,
    bloomLevel: PedagogicalAction["bloomLevel"],
    socraticRestraint: boolean,
    confusedStudentMode: boolean,
    metadata: Record<string, unknown>
  ): PedagogicalAction {
    return {
      type,
      instruction: this.buildInstruction(type, conceptId, mastery, socraticRestraint, confusedStudentMode, metadata),
      conceptId,
      triggerMasteryScore: mastery,
      bloomLevel,
      socraticRestraintActive: socraticRestraint,
      confusedStudentModeActive: confusedStudentMode,
      metadata,
    };
  }

  private buildInstruction(
    type: PedagogicalActionType,
    conceptId: string,
    mastery: number,
    socraticRestraint: boolean,
    confusedStudentMode: boolean,
    metadata: Record<string, unknown>
  ): string {
    const restraintClause = socraticRestraint
      ? " IMPORTANT: Do NOT provide the answer directly. Use questions only."
      : "";

    switch (type) {
      case "evaluate_mastery":
        return `Ask the student a short, targeted question to probe their current understanding of "${conceptId}".${restraintClause}`;

      case "probe_misconception":
        return `The student likely believes "${metadata["misconception"]}". Ask a carefully crafted question that will expose this flaw without telling them they are wrong.${restraintClause}`;

      case "explain_concept":
        return `Provide a clear, ${mastery < 0.1 ? "very simple" : "accessible"} explanation of "${conceptId}". Use ${metadata["modality"] ?? "mixed"} style.`;

      case "generate_analogy":
        return `Create a vivid analogy mapping "${conceptId}" to "${metadata["analogyDomain"] ?? "everyday life"}". Do not define the concept directly — let the analogy do the work.`;

      case "show_worked_example":
        return `Walk through a concrete worked example of "${conceptId}" step-by-step. Pause to ask the student what they think each step does.${restraintClause}`;

      case "draw_concept_map":
        return `Create a text-based concept map or structured outline that visually shows how "${conceptId}" connects to related ideas.`;

      case "ask_socratic_question":
        return `Ask a ${metadata["difficulty"] ?? "probing"} Socratic question about "${conceptId}" that guides the student toward insight without revealing the answer.${restraintClause}`;

      case "give_hint":
        return `Provide a minimal hint for "${conceptId}" that nudges the student without giving the answer. Current mastery: ${Math.round(mastery * 100)}%.${restraintClause}`;

      case "trigger_confused_student":
        return `[ROLE REVERSAL] Act as a confused student who cannot understand "${conceptId}". Ask the student to explain it to you as if you have never heard it. Probe their explanation gently to reveal any gaps.`;

      case "acknowledge_frustration":
        return `Acknowledge that "${conceptId}" is genuinely challenging. Validate the student's effort before proceeding. Offer to approach it from a different angle.`;

      case "celebrate_breakthrough":
        return `The student just demonstrated understanding of "${conceptId}". Celebrate this specifically and concretely, then ask them to generalise.`;

      case "suggest_break":
        return `Gently suggest a short break. Frame it positively — the brain consolidates learning during rest.`;

      case "reframe_difficulty":
        return `Reframe the difficulty of "${conceptId}" as a sign that real learning is happening (Bjork's desirable difficulties). Use an encouraging, growth-mindset framing.`;

      case "switch_modality":
        return `Switch the explanation style for "${conceptId}" to ${metadata["newModality"] ?? "example-based"} mode. Previous modality was not landing.`;

      case "step_back_prerequisite":
        return `Step back to a prerequisite concept before "${conceptId}". The student cannot advance without first solidifying the foundation.`;

      case "advance_to_challenge":
        return `The student has strong mastery of "${conceptId}". Introduce a harder, application-level challenge (Bloom level 5) to push into the Zone of Proximal Development.`;

      case "select_pedagogy":
        return `Announce the pedagogical strategy change: switching to ${metadata["strategy"] ?? "guided discovery"} mode for "${conceptId}".`;

      default:
        return `Continue tutoring on "${conceptId}" at current depth.`;
    }
  }

  /** Static entry point (backward-compatible API for tests and ToMMasteryBridge) */
  static select(
    conceptId: string,
    state: LegacyEpistemicState,
    profile: TomUserProfile,
    tomState: HighOrderToMState | null,
    mode: FeynmanMode = "explainer"
  ): PedagogicalSelectorResult {
    const mastery = state.conceptMasteryMap[conceptId] ?? 0;
    const isFrustrated = state.frustrationConcepts.includes(conceptId);
    const hasAnalogyAffinity = profile.communicationPreferences.analogyAffinity;

    // Priority 1: False confidence (second-order ToM)
    if (tomState?.falseConfidenceConcepts.includes(conceptId)) {
      return {
        action: PedagogicalActionFactory.askSocraticQuestion(
          conceptId,
          "misconception detected",
          `What makes you confident that you understand ${conceptId}?`
        ),
        suggestedMode: "socratic" as FeynmanMode,
        rationale: "False confidence detected: student belief is flawed",
      };
    }

    // Priority 2: Socratic mode override
    if (mode === "socratic") {
      if (mastery < ACTION_THRESHOLDS.DIRECT_EXPLAIN_THRESHOLD) {
        return {
          action: PedagogicalActionFactory.offerHint(
            conceptId, 3 as 1|2|3,
            `Let's approach ${conceptId} step by step. What do you already know?`
          ),
          suggestedMode: "explainer" as FeynmanMode,
          rationale: `Socratic + low mastery (${mastery.toFixed(2)}) → hint first`,
        };
      }
      return {
        action: PedagogicalActionFactory.askSocraticQuestion(
          conceptId,
          "comprehension check",
          `What is the key idea behind ${conceptId}?`
        ),
        suggestedMode: "socratic" as FeynmanMode,
        rationale: `Socratic mode + mastery ${mastery.toFixed(2)} → guided question`,
      };
    }

    // Priority 3: Mastered → role reversal
    if (mastery >= ACTION_THRESHOLDS.MASTERY_GATE) {
      return {
        action: PedagogicalActionFactory.evaluateMastery(
          conceptId,
          `Can you explain ${conceptId} as if teaching a complete beginner?`
        ),
        suggestedMode: "student" as FeynmanMode,
        rationale: `Mastery ${mastery.toFixed(2)} ≥ ${ACTION_THRESHOLDS.MASTERY_GATE} → role-reversal`,
      };
    }

    // Priority 4: Frustrated + analogy affinity
    if (isFrustrated && hasAnalogyAffinity) {
      return {
        action: PedagogicalActionFactory.generateAnalogy(conceptId, Math.round(mastery * 10), "everyday life"),
        suggestedMode: "explainer" as FeynmanMode,
        rationale: `Frustrated + analogy affinity + mastery ${mastery.toFixed(2)} → analogy`,
      };
    }

    // Priority 5: Optimal zone → Socratic question
    if (mastery >= ACTION_THRESHOLDS.OPTIMAL_ZONE_LOWER) {
      return {
        action: PedagogicalActionFactory.askSocraticQuestion(
          conceptId,
          "deepening comprehension",
          `What would happen if ${conceptId} didn't exist?`
        ),
        suggestedMode: "socratic" as FeynmanMode,
        rationale: `Mastery ${mastery.toFixed(2)} in optimal zone → Socratic`,
      };
    }

    // Default: explain directly
    return {
      action: PedagogicalActionFactory.explainConcept(
        conceptId,
        `Let me explain ${conceptId} clearly.`,
        mode
      ),
      suggestedMode: mode,
      rationale: `Low mastery ${mastery.toFixed(2)} < ${ACTION_THRESHOLDS.OPTIMAL_ZONE_LOWER} → direct explanation`,
    };
  }

}

// ============================================================================
// SESSION CONTEXT (consumed by ActionSelector)
// ============================================================================

export interface SessionContext {
  sessionId: string;
  studentId: string;
  conceptId: string;
  interactionCount: number;
  consecutiveCorrectAnswers: number;
  consecutiveIncorrectAnswers: number;
  recentHintRequests: number;
  recentFrustrationSignals: number;
  recentBreakthroughs: number;
  lastActionType: PedagogicalActionType | null;
  lastActionOutcome: ActionOutcome | null;
}

export function createSessionContext(
  sessionId: string,
  studentId: string,
  conceptId: string
): SessionContext {
  return {
    sessionId,
    studentId,
    conceptId,
    interactionCount: 0,
    consecutiveCorrectAnswers: 0,
    consecutiveIncorrectAnswers: 0,
    recentHintRequests: 0,
    recentFrustrationSignals: 0,
    recentBreakthroughs: 0,
    lastActionType: null,
    lastActionOutcome: null,
  };
}

// Singleton instances
export const actionConstraintEngine = new ActionConstraintEngine();
export const pedagogicalActionSelector = new PedagogicalActionSelector();

// ============================================================================
// BACKWARD-COMPATIBLE API
// (supports tests written against lib/types/learning.ts PedagogicalAction type)
// ============================================================================

export const ACTION_THRESHOLDS = {
  MASTERY_GATE: 0.85,           // Above this → mastered, trigger role-reversal
  OPTIMAL_ZONE_LOWER: 0.60,     // [0.60, 0.85] = Socratic zone
  DIRECT_EXPLAIN_THRESHOLD: 0.40, // Below this → direct explanation warranted
} as const;

// ── PedagogicalActionFactory ─────────────────────────────────────────────────

export class PedagogicalActionFactory {
  static evaluateMastery(conceptId: string, probeQuestion?: string): LegacyPedagogicalAction {
    return { type: "evaluate_mastery", conceptId, probeQuestion };
  }

  static generateAnalogy(
    conceptId: string,
    studentDepth: number = 3,
    targetDomain: string = "everyday life"
  ): LegacyPedagogicalAction {
    return { type: "generate_analogy", conceptId, studentDepth, targetDomain };
  }

  static askSocraticQuestion(
    conceptId: string,
    targetGap: string,
    questionText: string
  ): LegacyPedagogicalAction {
    return { type: "ask_socratic_question", conceptId, targetGap, questionText };
  }

  static provideCorrection(
    conceptId: string,
    gapDescription: string,
    correctionText: string,
    retryQuestionId: string = ""
  ): LegacyPedagogicalAction {
    return { type: "provide_correction", conceptId, gapDescription, correctionText, retryQuestionId };
  }

  static adjustDifficulty(
    conceptId: string,
    direction: "lower" | "raise" | "maintain",
    reason: string
  ): LegacyPedagogicalAction {
    return { type: "adjust_difficulty", conceptId, direction, reason };
  }

  static triggerReview(
    conceptIds: string[],
    urgency: "immediate" | "end_of_session" | "next_session" = "end_of_session"
  ): LegacyPedagogicalAction {
    return { type: "trigger_review", conceptIds, urgency };
  }

  static explainConcept(
    conceptId: string,
    explanation: string,
    mode: FeynmanMode = "explainer"
  ): LegacyPedagogicalAction {
    return { type: "explain_concept", conceptId, explanation, mode };
  }

  static offerHint(
    conceptId: string,
    hintLevel: 1 | 2 | 3,
    hintText: string
  ): LegacyPedagogicalAction {
    return { type: "offer_hint", conceptId, hintLevel, hintText };
  }

  static toResult(
    action: LegacyPedagogicalAction,
    output: string,
    masteryUpdated: boolean,
    newMasteryP?: number
  ): PedagogicalActionResult {
    return { action, executedAt: Date.now(), output, masteryUpdated, newMasteryP };
  }
}

// ── PedagogicalActionSelector (static interface) ─────────────────────────────

export interface PedagogicalSelectorResult {
  action: LegacyPedagogicalAction;
  suggestedMode: FeynmanMode;
  rationale: string;
}

// ── SocraticRestraintEnforcer ────────────────────────────────────────────────

const VIOLATION_PATTERNS: RegExp[] = [
  /the\s+answer\s+is\b/i,
  /the\s+solution\s+is\b/i,
  /you\s+should\s+do\b/i,
  /here'?s?\s+how\s+to\b/i,
  /simply\s+do\b/i,
  /just\s+do\b/i,
  /to\s+solve\s+this[,\s]/i,
];

export class SocraticRestraintEnforcer {
  static isViolation(text: string): boolean {
    return VIOLATION_PATTERNS.some((p) => p.test(text));
  }

  static listViolations(text: string): string[] {
    return VIOLATION_PATTERNS
      .filter((p) => p.test(text))
      .map((p) => p.source);
  }

  static enforceStable(text: string, conceptId?: string): string {
    if (!SocraticRestraintEnforcer.isViolation(text)) return text;
    const topic = conceptId ? ` about ${conceptId}` : "";
    return `What do you think the key insight${topic} is? What have you already tried?`;
  }
}

// ── HintLadder ───────────────────────────────────────────────────────────────

export class HintLadder {
  static generate(
    conceptId: string,
    level: 1 | 2 | 3,
    context?: string
  ): LegacyPedagogicalAction {
    const contextClause = context ? ` (context: ${context})` : "";
    const hints: Record<1 | 2 | 3, string> = {
      1: `Think carefully about what you already know about ${conceptId}${contextClause}. What's the first thing that comes to mind?`,
      2: `For ${conceptId}, consider: what is the core mechanism or key principle${contextClause}? Try to express it in your own words.`,
      3: `Here's a direct nudge for ${conceptId}: focus on the relationship between the inputs and outputs${contextClause}. How does the transformation work step by step?`,
    };
    return PedagogicalActionFactory.offerHint(conceptId, level, hints[level]);
  }

  static escalate(level: 1 | 2 | 3): 2 | 3 | null {
    if (level === 1) return 2;
    if (level === 2) return 3;
    return null;
  }

  static startingLevel(masteryP: number): 1 | 2 | 3 {
    if (masteryP >= 0.75) return 1;
    if (masteryP >= 0.45) return 2;
    return 3;
  }
}
