/**
 * Epistemic State Tracker
 *
 * Implements Criteria B and D from the problem statement:
 *
 * Criterion B — Epistemic State Tracking
 *   "While the ToM module tracks user *preferences*, it lacks a Bayesian
 *    Knowledge Tracing (BKT) layer to track user *mastery*. The agent must ask:
 *    'What is the probability the user actually understands recursion?' not just
 *    'What is the user's preferred coding style?'"
 *
 * Criterion D — High-Order ToM (Nested Beliefs)
 *   "An agent must maintain a dual model: the actual ground truth AND the
 *    student's flawed mental model. Second-order ToM: 'I know the student
 *    *thinks* they understand pointers, but I know their mental model is flawed
 *    based on their last commit / quiz.'"
 *
 * This module:
 *  1. Maintains `EpistemicState` per (student, concept) — the agent's model
 *     of what the student *actually* knows (first-order ToM: what is true).
 *  2. Tracks `StudentSelfModel` — what the student *believes* about their own
 *     mastery (zero-order: the student's belief about themselves).
 *  3. Detects "Belief–Reality Mismatch": when self-assessed mastery diverges
 *     from actual DKT mastery — the second-order ToM signal.
 *  4. Fuses DKT updates from `LSTMKnowledgeTracingEngine` with the ToM profile
 *     to generate personalised "mastery-aware" agent instructions.
 *
 * Reference:
 *   "Deep Knowledge Tracing" Piech et al. (2015), arXiv:1506.05908
 *   "Bayesian Knowledge Tracing" Corbett & Anderson (1994)
 *   "Theory of Mind in LLMs: Failure Modes" Ullman (2023), arXiv:2302.08399
 *   "DKT for Personalized Adaptive Learning" arXiv:2410.13876
 */

import {
  LSTMKnowledgeTracingEngine,
  KnowledgeState,
  StudentKnowledgeTrace,
} from "./lstm-knowledge-tracing";
import { UserProfile } from "./tom-user-profiler";

// ============================================================================
// EPISTEMIC STATE TYPES
// ============================================================================

/** Constants shared with pedagogical-action-space.ts (avoids circular import). */
const ActionConstraintConfig = {
  CONFUSED_STUDENT_THRESHOLD: 0.55,
  SOCRATIC_RESTRAINT_THRESHOLD: 0.40,
};

/**
 * The agent's model of what the student *actually* knows about a concept.
 * First-order ToM: "I believe the student's mastery of X is P."
 */
export interface EpistemicState {
  studentId: string;
  conceptId: string;

  // ── Actual mastery (from DKT / BKT) ──────────────────────────────────────
  /** DKT-estimated probability of mastery (0-1). */
  masteryProbability: number;
  /** Confidence interval [lower, upper] around the mastery estimate. */
  masteryConfidenceInterval: [number, number];
  /** Number of observations used to compute this estimate. */
  observationCount: number;
  /** Timestamp of last update. */
  lastUpdated: number;

  // ── Self-model divergence (second-order ToM) ──────────────────────────────
  /** Student's self-reported confidence in their mastery (0-1). */
  studentSelfAssessedMastery: number;
  /** Whether the student believes they have mastered this concept. */
  studentBelievesTheyKnowIt: boolean;
  /**
   * TRUE when self-assessed mastery substantially *exceeds* actual DKT mastery.
   * This is the Dunning-Kruger signal — "I know the student THINKS they
   * understand it, but I know they're wrong."
   */
  hasFlawedMentalModel: boolean;
  /**
   * Divergence score: (self-assessed - actual). Positive = over-confident.
   * Threshold: divergence > 0.25 triggers second-order ToM mode.
   */
  beliefRealityDivergence: number;

  // ── Active misconceptions ─────────────────────────────────────────────────
  /** Misconception IDs currently believed active for this concept. */
  activeMisconceptions: string[];
  /** Misconceptions that have been confirmed corrected. */
  resolvedMisconceptions: string[];

  // ── Learning dynamics ─────────────────────────────────────────────────────
  /** Rate of mastery change per session (positive = improving). */
  learningVelocity: number;
  /** Recommended next pedagogical action based on this state alone. */
  recommendedAction: "explain" | "probe" | "socratic" | "confused_student" | "advance" | "review";
  /** Estimated days to reach mastery threshold (0.85). */
  estimatedDaysToMastery: number;
}

/** The student's own model of their mastery — tracked separately from reality. */
export interface StudentSelfModel {
  studentId: string;
  conceptId: string;
  /** Self-reported confidence (0-1). Updated from explicit self-assessments. */
  selfConfidence: number;
  /** Whether they explicitly said "I understand this" without being correct. */
  hasOverclaimed: boolean;
  /** Times they expressed uncertainty ("I think...", "maybe...", "I'm not sure"). */
  uncertaintyExpressions: number;
  lastUpdated: number;
}

/** Second-order ToM: the agent's model of what the student believes about their own knowledge. */
export interface SecondOrderBelief {
  studentId: string;
  conceptId: string;
  /**
   * The agent's prediction: does the student THINK they know this?
   * "I (agent) believe that the student believes they know X."
   */
  agentBelievesStudentThinksMastered: boolean;
  /** Actual mastery from DKT. */
  actualMastery: number;
  /** Student self-assessment. */
  studentBeliefMastery: number;
  /** Whether intervention is needed (flawed belief requires Socratic probing). */
  requiresBeliefCorrection: boolean;
  /** Suggested correction strategy. */
  correctionStrategy: "probe_misconception" | "trigger_confused_student" | "evaluate_mastery";
}

// ============================================================================
// EPISTEMIC STATE TRACKER
// ============================================================================

/** Mismatch threshold: if self-assessed mastery exceeds DKT by this much → flawed model. */
const BELIEF_DIVERGENCE_THRESHOLD = 0.25;
/** Mastery level at which a concept is considered "mastered". */
const MASTERY_THRESHOLD = 0.85;

export class EpistemicStateTracker {
  private states: Map<string, Map<string, EpistemicState>> = new Map(); // studentId → conceptId → state
  private selfModels: Map<string, Map<string, StudentSelfModel>> = new Map();

  /**
   * Update the epistemic state for a student/concept after a quiz attempt.
   *
   * Fuses the DKT update (from LSTMKnowledgeTracingEngine) with the
   * student's self-assessed confidence.
   *
   * @param trace - The student's full knowledge trace (DKT source of truth).
   * @param conceptId - Concept that was just observed.
   * @param correct - Whether the student answered correctly.
   * @param responseTime - Time taken to respond (ms).
   * @param selfConfidence - Student's self-reported confidence (1-5 scale).
   * @param expressedUncertainty - Whether student expressed doubt in their answer.
   */
  update(
    trace: StudentKnowledgeTrace,
    conceptId: string,
    correct: boolean,
    responseTime: number,
    selfConfidence: number, // 1-5
    expressedUncertainty: boolean = false
  ): EpistemicState {
    const studentId = trace.studentId;
    const normalizedConfidence = selfConfidence / 5; // → 0–1

    // ── Get updated DKT knowledge state ─────────────────────────────────────
    let dktState = trace.conceptStates.get(conceptId);
    if (!dktState) {
      dktState = {
        conceptId,
        masteryProbability: 0.5,
        confidenceInterval: [0.3, 0.7],
        lastUpdated: new Date(),
        observationCount: 0,
      };
    }
    // Apply DKT update (leverages the existing LSTM engine)
    const updatedDktState = LSTMKnowledgeTracingEngine.updateKnowledgeState(
      dktState,
      correct,
      responseTime,
      selfConfidence
    );
    trace.conceptStates.set(conceptId, updatedDktState);

    // ── Update self-model ────────────────────────────────────────────────────
    const selfModel = this.updateSelfModel(
      studentId,
      conceptId,
      normalizedConfidence,
      correct,
      expressedUncertainty
    );

    // ── Compute divergence ───────────────────────────────────────────────────
    const actualMastery = updatedDktState.masteryProbability;
    const divergence = selfModel.selfConfidence - actualMastery;
    const hasFlawedMentalModel =
      divergence > BELIEF_DIVERGENCE_THRESHOLD && !correct;

    // ── Learning velocity ───────────────────────────────────────────────────
    const velocity = LSTMKnowledgeTracingEngine.calculateLearningVelocity(trace, conceptId, 3);

    // ── Active misconceptions ───────────────────────────────────────────────
    const existing = this.getState(studentId, conceptId);
    const activeMisconceptions = existing?.activeMisconceptions ?? [];
    const resolvedMisconceptions = existing?.resolvedMisconceptions ?? [];

    // ── Recommended action ──────────────────────────────────────────────────
    const recommendedAction = this.determineRecommendedAction(
      actualMastery,
      hasFlawedMentalModel,
      divergence,
      activeMisconceptions.length
    );

    // ── Days to mastery ─────────────────────────────────────────────────────
    const masteryGap = Math.max(0, MASTERY_THRESHOLD - actualMastery);
    const effectiveVelocity = Math.max(0.01, Math.abs(velocity));
    const estimatedDaysToMastery = Math.ceil(masteryGap / effectiveVelocity);

    const state: EpistemicState = {
      studentId,
      conceptId,
      masteryProbability: actualMastery,
      masteryConfidenceInterval: updatedDktState.confidenceInterval,
      observationCount: updatedDktState.observationCount,
      lastUpdated: Date.now(),
      studentSelfAssessedMastery: selfModel.selfConfidence,
      studentBelievesTheyKnowIt: selfModel.selfConfidence >= 0.7,
      hasFlawedMentalModel,
      beliefRealityDivergence: divergence,
      activeMisconceptions,
      resolvedMisconceptions,
      learningVelocity: velocity,
      recommendedAction,
      estimatedDaysToMastery,
    };

    // Persist
    const studentMap = this.states.get(studentId) ?? new Map();
    studentMap.set(conceptId, state);
    this.states.set(studentId, studentMap);

    return state;
  }

  /**
   * Get the current epistemic state for a student/concept (may be undefined for first visit).
   */
  getState(studentId: string, conceptId: string): EpistemicState | undefined {
    return this.states.get(studentId)?.get(conceptId);
  }

  /**
   * Get or create a default epistemic state for a student/concept.
   */
  getOrCreateState(studentId: string, conceptId: string): EpistemicState {
    return this.getState(studentId, conceptId) ?? this.createDefaultState(studentId, conceptId);
  }

  /**
   * Record a misconception as active for a student/concept.
   */
  recordMisconception(studentId: string, conceptId: string, misconceptionId: string): void {
    const state = this.getOrCreateState(studentId, conceptId);
    if (!state.activeMisconceptions.includes(misconceptionId)) {
      state.activeMisconceptions.push(misconceptionId);
    }
    const studentMap = this.states.get(studentId) ?? new Map();
    studentMap.set(conceptId, state);
    this.states.set(studentId, studentMap);
  }

  /**
   * Mark a misconception as resolved.
   */
  resolveMisconception(studentId: string, conceptId: string, misconceptionId: string): void {
    const state = this.getOrCreateState(studentId, conceptId);
    state.activeMisconceptions = state.activeMisconceptions.filter((m) => m !== misconceptionId);
    if (!state.resolvedMisconceptions.includes(misconceptionId)) {
      state.resolvedMisconceptions.push(misconceptionId);
    }
    const studentMap = this.states.get(studentId) ?? new Map();
    studentMap.set(conceptId, state);
    this.states.set(studentId, studentMap);
  }

  /**
   * Compute second-order ToM belief for a student/concept.
   * "I (agent) believe that the student believes they know X."
   */
  computeSecondOrderBelief(studentId: string, conceptId: string): SecondOrderBelief {
    const state = this.getOrCreateState(studentId, conceptId);
    const selfModel = this.selfModels.get(studentId)?.get(conceptId);

    const agentBelievesStudentThinksMastered =
      state.studentBelievesTheyKnowIt || (selfModel?.hasOverclaimed ?? false);

    const requiresBeliefCorrection =
      agentBelievesStudentThinksMastered &&
      state.masteryProbability < MASTERY_THRESHOLD - 0.1;

    const correctionStrategy: SecondOrderBelief["correctionStrategy"] =
      state.activeMisconceptions.length > 0
        ? "probe_misconception"
        : state.masteryProbability > ActionConstraintConfig.CONFUSED_STUDENT_THRESHOLD
        ? "trigger_confused_student"
        : "evaluate_mastery";

    return {
      studentId,
      conceptId,
      agentBelievesStudentThinksMastered,
      actualMastery: state.masteryProbability,
      studentBeliefMastery: state.studentSelfAssessedMastery,
      requiresBeliefCorrection,
      correctionStrategy,
    };
  }

  /**
   * Generate a mastery-aware agent instruction fusing the epistemic state
   * with the ToM profile.
   *
   * This is the "mastery loop injection" described in the problem statement:
   * "The agent shouldn't just know the user 'gets frustrated easily' (ToM);
   *  it needs to know they are frustrated BECAUSE their mastery of 'Graph
   *  Traversal' is only 0.45, triggering a fallback to 'Visual Analogies'."
   */
  generateMasteryAwareInstruction(
    epistemicState: EpistemicState,
    profile: UserProfile
  ): string {
    const mastery = epistemicState.masteryProbability;
    const conceptId = epistemicState.conceptId;
    const frustrated =
      profile.averageFrustrationLevel === "high" ||
      profile.averageFrustrationLevel === "overwhelmed";

    const parts: string[] = [];

    // Mastery context
    parts.push(
      `Student mastery of "${conceptId}": ${Math.round(mastery * 100)}% (${this.masteryLabel(mastery)}).`
    );

    // Belief mismatch
    if (epistemicState.hasFlawedMentalModel) {
      parts.push(
        `[HIGH-ORDER ToM] Student self-assesses at ${Math.round(epistemicState.studentSelfAssessedMastery * 100)}% ` +
        `but actual mastery is ${Math.round(mastery * 100)}% — belief–reality divergence = ${(epistemicState.beliefRealityDivergence * 100).toFixed(0)}%. ` +
        `Do NOT accept their self-assessment. Use Socratic probing to surface the gap.`
      );
    }

    // Frustration + mastery fusion (the specific scenario described in the problem statement)
    if (frustrated && mastery < 0.55) {
      const fallback = profile.preferredModality === "visual"
        ? "a visual analogy"
        : profile.preferredModality === "example-based"
        ? "a concrete worked example"
        : "a simple analogy from everyday life";
      parts.push(
        `Student is frustrated because mastery is below threshold. ` +
        `Trigger fallback to ${fallback} (${profile.preferredModality} modality per ToM profile) ` +
        `before asking further questions.`
      );
    }

    // Active misconceptions
    if (epistemicState.activeMisconceptions.length > 0) {
      parts.push(
        `Active misconceptions: ${epistemicState.activeMisconceptions.join(", ")}. ` +
        `Probe these before advancing.`
      );
    }

    // Profile-driven instructions
    profile.agentInstructions.slice(0, 2).forEach((inst) => parts.push(inst));

    return parts.join(" | ");
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private updateSelfModel(
    studentId: string,
    conceptId: string,
    normalizedConfidence: number,
    correct: boolean,
    expressedUncertainty: boolean
  ): StudentSelfModel {
    const existing = this.selfModels.get(studentId)?.get(conceptId);
    const prev = existing ?? {
      studentId,
      conceptId,
      selfConfidence: 0.5,
      hasOverclaimed: false,
      uncertaintyExpressions: 0,
      lastUpdated: Date.now(),
    };

    // Over-claim: confident but wrong
    const hasOverclaimed = normalizedConfidence >= 0.7 && !correct;
    const uncertaintyExpressions = prev.uncertaintyExpressions + (expressedUncertainty ? 1 : 0);

    // Exponential moving average of self-confidence
    const selfConfidence = 0.7 * prev.selfConfidence + 0.3 * normalizedConfidence;

    const model: StudentSelfModel = {
      studentId,
      conceptId,
      selfConfidence,
      hasOverclaimed: prev.hasOverclaimed || hasOverclaimed,
      uncertaintyExpressions,
      lastUpdated: Date.now(),
    };

    const studentMap = this.selfModels.get(studentId) ?? new Map();
    studentMap.set(conceptId, model);
    this.selfModels.set(studentId, studentMap);
    return model;
  }

  private determineRecommendedAction(
    mastery: number,
    hasFlawedMentalModel: boolean,
    divergence: number,
    activeMisconceptionCount: number
  ): EpistemicState["recommendedAction"] {
    if (hasFlawedMentalModel && divergence > BELIEF_DIVERGENCE_THRESHOLD) {
      return mastery > ActionConstraintConfig.CONFUSED_STUDENT_THRESHOLD
        ? "confused_student"
        : "probe";
    }
    if (activeMisconceptionCount > 0) return "probe";
    if (mastery < 0.25) return "explain";
    if (mastery < ActionConstraintConfig.SOCRATIC_RESTRAINT_THRESHOLD) return "probe";
    if (mastery < 0.75) return "socratic";
    if (mastery >= MASTERY_THRESHOLD) return "advance";
    return "review";
  }

  private createDefaultState(studentId: string, conceptId: string): EpistemicState {
    return {
      studentId,
      conceptId,
      masteryProbability: 0.5,
      masteryConfidenceInterval: [0.3, 0.7],
      observationCount: 0,
      lastUpdated: Date.now(),
      studentSelfAssessedMastery: 0.5,
      studentBelievesTheyKnowIt: false,
      hasFlawedMentalModel: false,
      beliefRealityDivergence: 0,
      activeMisconceptions: [],
      resolvedMisconceptions: [],
      learningVelocity: 0,
      recommendedAction: "explain",
      estimatedDaysToMastery: 7,
    };
  }

  private masteryLabel(mastery: number): string {
    if (mastery < 0.25) return "novice";
    if (mastery < 0.50) return "developing";
    if (mastery < 0.75) return "approaching";
    if (mastery < 0.85) return "proficient";
    return "mastered";
  }

  /** Get all epistemic states for a student (for dashboard / analytics). */
  getAllStates(studentId: string): EpistemicState[] {
    return [...(this.states.get(studentId)?.values() ?? [])];
  }

  /** Average mastery across all concepts for a student. */
  averageMastery(studentId: string): number {
    const states = this.getAllStates(studentId);
    if (states.length === 0) return 0.5;
    return states.reduce((s, e) => s + e.masteryProbability, 0) / states.length;
  }
} 

// Export type so it can be imported in pedagogical-action-space
export type { EpistemicState };

// Singleton instance
export const epistemicStateTracker = new EpistemicStateTracker();
