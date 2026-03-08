/**
 * ToM Tutor Orchestrator
 *
 * The unified entry point that ties all three ToM layers together:
 *
 *   1. ToM User Profiler (Three-Tier Memory: Sessions → Analyses → Profile)
 *   2. Epistemic State Tracker (DKT mastery + second-order belief)
 *   3. Pedagogical Action Space (constrained, Socratic action selector)
 *
 * Role in the system (from the problem statement):
 *   "Intercepts the agent's decision loop, using the TomCodeActAgent to inject
 *    personalised instructions before the agent acts."
 *
 *   Here the "TomCodeActAgent" equivalent is the `TomTutorAgent.decide()` method:
 *   it receives the raw conversational context and returns a `TutorDecision` —
 *   a structured object containing:
 *     - The selected `PedagogicalAction` (what to do next)
 *     - A personalised system prompt injection (the ToM layer injected before LLM call)
 *     - Mastery-aware context (why the action was chosen)
 *     - Whether Socratic Restraint or Confused Student Mode is active
 *
 * Design choices:
 *   - Async profile updates NEVER block the decision loop (fire-and-forget pattern).
 *   - The mastery loop injection fuses DKT + ToM profile, as described:
 *     "They are frustrated because mastery of 'Graph Traversal' is 0.45,
 *      triggering fallback to 'Visual Analogies' (Mr. Ranedeer parameters)."
 *   - Every decision is logged for later session analysis.
 *
 * References:
 *   OpenHands TomCodeActAgent intercept pattern
 *   Mr. Ranedeer AI Tutor system prompt injection
 *   "Socratic Tutoring with LLMs" arXiv:2406.10934
 *   "Theory of Mind in LLMs" arXiv:2302.02083
 */

import {
  sessionStore,
  sessionAnalyser,
  profileManager,
  SessionStore,
  SessionAnalyser,
  ProfileManager,
  CleanedSession,
  UserProfile,
  SessionEventType,
} from "./tom-user-profiler";

import {
  EpistemicStateTracker,
  EpistemicState,
  SecondOrderBelief,
  epistemicStateTracker,
} from "./epistemic-state-tracker";

import {
  PedagogicalActionSelector,
  ActionConstraintEngine,
  PedagogicalAction,
  SessionContext,
  ActionOutcome,
  createSessionContext,
  actionConstraintEngine,
  pedagogicalActionSelector,
} from "./pedagogical-action-space";

import {
  LSTMKnowledgeTracingEngine,
  StudentKnowledgeTrace,
} from "./lstm-knowledge-tracing";

// ============================================================================
// TUTOR DECISION TYPES
// ============================================================================

/** The output of one complete ToM orchestration cycle. */
export interface TutorDecision {
  /** Unique decision ID for logging / replay. */
  decisionId: string;
  /** Student this decision is for. */
  studentId: string;
  /** Concept this decision concerns. */
  conceptId: string;
  /** The selected pedagogical action. */
  action: PedagogicalAction;
  /**
   * The personalised system prompt injection.
   * Prepend this to the LLM system prompt before generating a response.
   * This is the ToM "intercept" — like ToM-SWE injecting profile context
   * before CodeActAgent executes.
   */
  systemPromptInjection: string;
  /** Current epistemic state for the student/concept. */
  epistemicState: EpistemicState;
  /** Second-order ToM belief for the student/concept. */
  secondOrderBelief: SecondOrderBelief;
  /** Whether Socratic Restraint is currently enforced. */
  socraticRestraintActive: boolean;
  /** Whether Confused Student Mode is active. */
  confusedStudentModeActive: boolean;
  /** Human-readable rationale for why this decision was made. */
  rationale: string;
  timestamp: number;
}

/** Input context for a single orchestration cycle. */
export interface DecisionInput {
  studentId: string;
  conceptId: string;
  sessionId: string;
  /** The student's latest message / response. */
  studentInput: string;
  /** Whether the student just answered a quiz question. */
  isQuizAttempt: boolean;
  /** Quiz correctness (undefined if not a quiz attempt). */
  isCorrect?: boolean;
  /** Time taken to respond in ms. */
  responseTime?: number;
  /** Student's self-reported confidence (1-5). */
  selfConfidence?: number;
  /** Whether the student expressed uncertainty ("I think...", "maybe..."). */
  expressedUncertainty?: boolean;
  /** Any misconception IDs explicitly detected (from text analysis). */
  detectedMisconceptionIds?: string[];
}

// ============================================================================
// TOM TUTOR AGENT
// ============================================================================

/**
 * The central ToM Tutor Agent.
 *
 * Call `agent.decide(input)` once per interaction turn.
 * The returned `TutorDecision` contains everything the LLM needs to
 * generate a pedagogically correct, personalised response.
 *
 * ```typescript
 * const agent = new TomTutorAgent();
 * const session = agent.startSession("student-1");
 *
 * // Each turn:
 * const decision = await agent.decide({
 *   studentId: "student-1",
 *   conceptId: "recursion",
 *   sessionId: session.sessionId,
 *   studentInput: "I think I get it...",
 *   isQuizAttempt: true,
 *   isCorrect: false,
 *   selfConfidence: 4, // student was confident but wrong → belief mismatch!
 * });
 *
 * const llmResponse = await callLLM(decision.systemPromptInjection, decision.action.instruction);
 * ```
 */
export class TomTutorAgent {
  private sessionStoreInstance: SessionStore;
  private analyserInstance: SessionAnalyser;
  private profileManagerInstance: ProfileManager;
  private epistemicTracker: EpistemicStateTracker;
  private actionSelector: PedagogicalActionSelector;
  private constraintEngine: ActionConstraintEngine;

  /** Active knowledge traces per student. */
  private knowledgeTraces: Map<string, StudentKnowledgeTrace> = new Map();
  /** Active session contexts per (studentId + sessionId). */
  private sessionContexts: Map<string, SessionContext> = new Map();
  /** Decision log for replay and analysis. */
  private decisionLog: TutorDecision[] = [];

  constructor(
    store?: SessionStore,
    analyser?: SessionAnalyser,
    profileMgr?: ProfileManager,
    tracker?: EpistemicStateTracker,
    selector?: PedagogicalActionSelector,
    constraintEng?: ActionConstraintEngine
  ) {
    this.sessionStoreInstance = store ?? sessionStore;
    this.analyserInstance = analyser ?? sessionAnalyser;
    this.profileManagerInstance = profileMgr ?? profileManager;
    this.epistemicTracker = tracker ?? epistemicStateTracker;
    this.actionSelector = selector ?? pedagogicalActionSelector;
    this.constraintEngine = constraintEng ?? actionConstraintEngine;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Start a new tutoring session for a student. */
  startSession(studentId: string): CleanedSession {
    const session = this.sessionStoreInstance.startSession(studentId);

    // Initialise session context
    const contextKey = `${studentId}:${session.sessionId}`;
    this.sessionContexts.set(contextKey, createSessionContext(session.sessionId, studentId, ""));

    // Ensure knowledge trace exists
    if (!this.knowledgeTraces.has(studentId)) {
      this.knowledgeTraces.set(
        studentId,
        LSTMKnowledgeTracingEngine.initializeTrace(studentId)
      );
    }

    return session;
  }

  /**
   * Core decision method — the ToM intercept loop.
   *
   * Called once per interaction turn. Returns a `TutorDecision` ready for
   * injection into the LLM system prompt.
   */
  async decide(input: DecisionInput): Promise<TutorDecision> {
    const {
      studentId,
      conceptId,
      sessionId,
      studentInput,
      isQuizAttempt,
      isCorrect,
      responseTime = 5000,
      selfConfidence = 3,
      expressedUncertainty = false,
      detectedMisconceptionIds = [],
    } = input;

    // ── 1. Log student interaction to Tier 1 ────────────────────────────────
    this.sessionStoreInstance.addEvent(
      sessionId,
      "student_message",
      studentInput,
      { conceptId, isQuizAttempt }
    );
    if (isQuizAttempt && isCorrect !== undefined) {
      this.sessionStoreInstance.addEvent(sessionId, "quiz_attempt", studentInput, {
        conceptId,
        correct: isCorrect,
        responseTime,
        selfConfidence,
      });
    }

    // ── 2. Update DKT + epistemic state (Criterion B) ───────────────────────
    const trace = this.knowledgeTraces.get(studentId) ??
      LSTMKnowledgeTracingEngine.initializeTrace(studentId);

    let epistemicState: EpistemicState;
    if (isQuizAttempt && isCorrect !== undefined) {
      epistemicState = this.epistemicTracker.update(
        trace,
        conceptId,
        isCorrect,
        responseTime,
        selfConfidence,
        expressedUncertainty
      );
      this.knowledgeTraces.set(studentId, trace);
    } else {
      epistemicState = this.epistemicTracker.getOrCreateState(studentId, conceptId);
    }

    // ── 3. Record any detected misconceptions ────────────────────────────────
    for (const mId of detectedMisconceptionIds) {
      this.epistemicTracker.recordMisconception(studentId, conceptId, mId);
      this.sessionStoreInstance.addEvent(sessionId, "student_message", studentInput, {
        conceptId,
        misconception: mId,
      });
    }

    // Refresh epistemic state after misconception recording
    if (detectedMisconceptionIds.length > 0) {
      epistemicState = this.epistemicTracker.getOrCreateState(studentId, conceptId);
    }

    // ── 4. Detect frustration / breakthrough signals ─────────────────────────
    const isFrustration = this.detectFrustration(studentInput);
    const isBreakthrough = this.detectBreakthrough(studentInput);
    if (isFrustration) {
      this.sessionStoreInstance.addEvent(sessionId, "frustration_signal", studentInput, { conceptId });
    }
    if (isBreakthrough) {
      this.sessionStoreInstance.addEvent(sessionId, "breakthrough", studentInput, { conceptId });
    }

    // ── 5. Get / update ToM profile (Tier 3) ────────────────────────────────
    const profile = this.profileManagerInstance.getOrInitProfile(studentId);

    // ── 6. Update session context ────────────────────────────────────────────
    const contextKey = `${studentId}:${sessionId}`;
    const sessionCtx = this.sessionContexts.get(contextKey) ??
      createSessionContext(sessionId, studentId, conceptId);
    sessionCtx.conceptId = conceptId;
    sessionCtx.interactionCount++;
    if (isQuizAttempt) {
      if (isCorrect) {
        sessionCtx.consecutiveCorrectAnswers++;
        sessionCtx.consecutiveIncorrectAnswers = 0;
      } else {
        sessionCtx.consecutiveIncorrectAnswers++;
        sessionCtx.consecutiveCorrectAnswers = 0;
      }
    }
    if (isFrustration) sessionCtx.recentFrustrationSignals++;
    if (isBreakthrough) sessionCtx.recentBreakthroughs++;
    this.sessionContexts.set(contextKey, sessionCtx);

    // ── 7. Compute second-order ToM (Criterion D) ───────────────────────────
    const secondOrderBelief = this.epistemicTracker.computeSecondOrderBelief(studentId, conceptId);

    // ── 8. Select pedagogical action (Criterion C: Socratic Restraint) ──────
    const action = this.actionSelector.selectAction(
      conceptId,
      epistemicState,
      profile,
      sessionCtx
    );

    // ── 9. Build the system prompt injection ─────────────────────────────────
    const systemPromptInjection = this.buildSystemPromptInjection(
      epistemicState,
      profile,
      action,
      secondOrderBelief
    );

    // ── 10. Build rationale ──────────────────────────────────────────────────
    const rationale = this.buildRationale(epistemicState, action, secondOrderBelief, profile);

    const decision: TutorDecision = {
      decisionId: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      conceptId,
      action,
      systemPromptInjection,
      epistemicState,
      secondOrderBelief,
      socraticRestraintActive: action.socraticRestraintActive,
      confusedStudentModeActive: action.confusedStudentModeActive,
      rationale,
      timestamp: Date.now(),
    };

    this.decisionLog.push(decision);

    // ── 11. Async profile update (fire-and-forget — never blocks) ───────────
    this.asyncUpdateProfile(studentId, sessionId);

    return decision;
  }

  /** End a session, run Tier 2 analysis, and asynchronously update Tier 3 profile. */
  async endSession(studentId: string, sessionId: string): Promise<void> {
    this.sessionStoreInstance.endSession(sessionId);

    const session = this.sessionStoreInstance.getSession(sessionId);
    if (session) {
      const analysis = this.analyserInstance.analyse(session);
      this.profileManagerInstance.recordAnalysis(analysis);
    }

    // Update profile async
    this.asyncUpdateProfile(studentId, sessionId);
  }

  /** Get the current decision log (for debugging / analytics). */
  getDecisionLog(): TutorDecision[] {
    return [...this.decisionLog];
  }

  /** Get the student's current knowledge trace. */
  getKnowledgeTrace(studentId: string): StudentKnowledgeTrace | undefined {
    return this.knowledgeTraces.get(studentId);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildSystemPromptInjection(
    epistemicState: EpistemicState,
    profile: UserProfile,
    action: PedagogicalAction,
    secondOrder: SecondOrderBelief
  ): string {
    const lines: string[] = [];

    lines.push("=== ToM TUTOR CONTEXT (injected by TomTutorAgent) ===");

    // Psychological summary
    lines.push(`[STUDENT PROFILE] ${profile.psychologicalSummary}`);

    // Mastery-aware instruction (the DKT + ToM fusion)
    lines.push(
      `[MASTERY STATE] "${epistemicState.conceptId}": ` +
      `${Math.round(epistemicState.masteryProbability * 100)}% actual vs ` +
      `${Math.round(epistemicState.studentSelfAssessedMastery * 100)}% self-assessed.`
    );

    // Belief mismatch alert
    if (secondOrder.requiresBeliefCorrection) {
      lines.push(
        `[BELIEF MISMATCH ⚠️] Student believes they understand this concept but ` +
        `actual mastery is ${Math.round(secondOrder.actualMastery * 100)}%. ` +
        `Use ${secondOrder.correctionStrategy} to surface the gap WITHOUT telling them directly.`
      );
    }

    // Socratic restraint
    if (action.socraticRestraintActive) {
      lines.push(
        `[SOCRATIC RESTRAINT 🚫] You are PROHIBITED from giving a direct answer to this student right now. ` +
        `Guide via questioning only. Mastery is ${Math.round(epistemicState.masteryProbability * 100)}% — ` +
        `the student has enough knowledge to figure this out with guidance.`
      );
    }

    // Confused student mode
    if (action.confusedStudentModeActive) {
      lines.push(
        `[CONFUSED STUDENT MODE 🎭] ACT as a confused student who cannot grasp "${epistemicState.conceptId}". ` +
        `Ask the student to teach you. This triggers the Feynman teaching effect.`
      );
    }

    // Profile-driven agent instructions
    if (profile.agentInstructions.length > 0) {
      lines.push(`[AGENT INSTRUCTIONS] ${profile.agentInstructions.slice(0, 3).join(" | ")}`);
    }

    // Frustration + mastery fallback
    if (
      (profile.averageFrustrationLevel === "high" || profile.averageFrustrationLevel === "overwhelmed") &&
      epistemicState.masteryProbability < 0.55
    ) {
      const fallback =
        profile.preferredModality === "visual" ? "Visual Analogies" :
        profile.preferredModality === "example-based" ? "Worked Examples" :
        "Simplified Analogies";
      lines.push(
        `[FRUSTRATION FALLBACK] Student is frustrated because mastery is ${Math.round(epistemicState.masteryProbability * 100)}%. ` +
        `Switch to ${fallback} mode (${profile.preferredModality} modality).`
      );
    }

    // Active misconceptions
    if (epistemicState.activeMisconceptions.length > 0) {
      lines.push(
        `[MISCONCEPTIONS] Active: ${epistemicState.activeMisconceptions.join(", ")}. ` +
        `Do NOT confirm these. Surface them via targeted questions.`
      );
    }

    // Selected action
    lines.push(`[SELECTED ACTION] ${action.type.toUpperCase()}: ${action.instruction}`);
    lines.push("=== END ToM CONTEXT ===");

    return lines.join("\n");
  }

  private buildRationale(
    state: EpistemicState,
    action: PedagogicalAction,
    secondOrder: SecondOrderBelief,
    profile: UserProfile
  ): string {
    const mastery = Math.round(state.masteryProbability * 100);
    const parts: string[] = [
      `Action: ${action.type} | Mastery: ${mastery}%`,
    ];
    if (secondOrder.requiresBeliefCorrection) {
      parts.push(`Belief mismatch detected (self: ${Math.round(secondOrder.studentBeliefMastery * 100)}% vs actual: ${mastery}%)`);
    }
    if (action.socraticRestraintActive) parts.push("Socratic restraint active");
    if (action.confusedStudentModeActive) parts.push("Confused Student Mode active");
    if (profile.averageFrustrationLevel !== "none") {
      parts.push(`Frustration: ${profile.averageFrustrationLevel}`);
    }
    return parts.join(" | ");
  }

  private detectFrustration(text: string): boolean {
    const frustrationPhrases = [
      "i don't understand", "this doesn't make sense", "i give up",
      "i'm confused", "this is too hard", "i hate this", "why doesn't",
      "what the", "still don't get", "not getting it", "frustrating",
    ];
    const lower = text.toLowerCase();
    return frustrationPhrases.some((p) => lower.includes(p));
  }

  private detectBreakthrough(text: string): boolean {
    const breakthroughPhrases = [
      "oh i see", "i get it now", "that makes sense", "oh! so", "ah,",
      "now i understand", "i understand now", "that clicked", "got it",
      "oh wow", "so that's why",
    ];
    const lower = text.toLowerCase();
    return breakthroughPhrases.some((p) => lower.includes(p));
  }

  private asyncUpdateProfile(studentId: string, _sessionId: string): void {
    // Fire-and-forget: never blocks the decision loop.
    // _sessionId is reserved for future use (e.g., scoped analysis or audit logs).
    Promise.resolve().then(async () => {
      try {
        await this.profileManagerInstance.updateProfile(studentId);
      } catch {
        // Silently ignore profile update errors — they must never affect tutoring
      }
    });
  }
}

// Singleton instance
export const tomTutorAgent = new TomTutorAgent();
