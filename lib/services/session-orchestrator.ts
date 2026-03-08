/**
 * Session Orchestrator
 *
 * The main pipeline that wires together all DeepFeynman V2 services in a
 * single, coherent per-turn decision loop:
 *
 *   Input (user message)
 *     → APE (profile update)
 *     → SessionAnalyser (Tier 2 ToM)
 *     → TomProfileBuilder (Tier 3 ToM)
 *     → EpistemicStateTracker (ToM ↔ BKT fusion)
 *     → CoTutor DKT (mastery update from signal events)
 *     → DifficultyAdjuster (85%-rule depth check)
 *     → HighOrderToMTracker (false-confidence / nested beliefs)
 *     → TomMasteryBridge (unified action decision)
 *     → PedagogicalActionSelector (concrete action output)
 *     → FeynmanModeEngine (mode-aware system prompt)
 *     → COMEDY Memory (periodic session compression)
 *   Output → { systemPrompt, action, modeInstruction, decision }
 *
 * Design:
 *   - All state is immutable-style (new objects on update).
 *   - No external I/O; all LLM calls are injectable (production pattern).
 *   - Fully unit-testable without network access.
 *   - COMEDY compression fires every COMEDY_INTERVAL turns.
 *
 * Research basis:
 *   - DeepFeynman V2 plan (2026-03-08): sprint integration requirements
 *   - CoTutor (arXiv:2509.23996): control-theoretic DKT
 *   - OpenHands ToM-SWE: TomCodeActAgent interception pattern
 *   - ProfiLLM (arXiv:2506.13980): APE every-5-turns update cycle
 *   - COMEDY (2025): memory compression for LLMs
 */

import {
  AdaptivePromptEngine,
  ConversationRecord,
  COLD_START_PROFILE,
} from "./adaptive-prompt-engine";
import {
  SessionCleaner,
  SessionAnalyser,
  TomProfileBuilder,
  HighOrderToMTracker,
  EpistemicStateTracker,
} from "./tom-swe";
import { TomMasteryBridge, TomCodeActAgent, ContextCoherenceMonitor } from "./tom-mastery-bridge";
import { FeynmanModeEngine, CommandParser } from "./feynman-mode-engine";
import { CoTutorDKT, DifficultyAdjuster, MasterySignalWeighter, SignalEvent } from "./cotutor-dkt";
import { MemoryMemoGenerator } from "./adaptive-prompt-engine";
import type {
  CleanedSession,
  SessionAnalysis,
  TomUserProfile,
  HighOrderToMState,
  EpistemicState,
  FeynmanMode,
  FeynmanModeConfig,
  UserLearningProfile,
  TomMasteryDecision,
  PedagogicalAction,
  ConversationMemoryMemo,
  DepthLevel,
} from "@/lib/types/learning";
import type { CoTutorMasteryState } from "./cotutor-dkt";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** COMEDY memory compression fires every N turns. */
export const COMEDY_INTERVAL = 20;

/** APE re-analyses every N turns (same as AdaptivePromptEngine's interval). */
export const APE_INTERVAL = 5;

/** Mastery state starts with this cold-start p_mastered. */
export const MASTERY_COLD_START = 0.10;

// ---------------------------------------------------------------------------
// Session State
// ---------------------------------------------------------------------------

/**
 * Full orchestration state for one student session.
 * All fields are immutable-style — updates produce a new object.
 */
export interface SessionState {
  sessionId: string;
  studentId: string;
  turnCount: number;
  activeConceptId: string;

  // Tier 1: Cleaned session messages
  cleanedSession: CleanedSession;

  // Tier 2: Latest session analysis
  latestAnalysis: SessionAnalysis | null;

  // Tier 3: ToM user profile
  tomProfile: TomUserProfile;

  // BKT mastery per concept
  masteryStates: Map<string, CoTutorMasteryState>;

  // Epistemic state (ToM-fused)
  epistemicState: EpistemicState;

  // High-order ToM
  highOrderToM: HighOrderToMState;

  // APE learning profile
  apeProfile: UserLearningProfile;

  // Current Feynman mode
  activeMode: FeynmanMode;

  // Current depth level (may be adjusted by 85%-rule)
  activeDepth: DepthLevel;

  // Past session analyses (for profile building)
  sessionAnalysisHistory: SessionAnalysis[];

  // COMEDY memos
  memos: ConversationMemoryMemo[];

  // Pending signal events (flushed each turn)
  pendingSignals: SignalEvent[];
}

// ---------------------------------------------------------------------------
// Orchestration output
// ---------------------------------------------------------------------------

export interface OrchestratorOutput {
  /** The system prompt to inject into the LLM call. */
  systemPrompt: string;

  /** The recommended pedagogical action for this turn. */
  action: PedagogicalAction;

  /** Human-readable rationale for the action. */
  rationale: string;

  /** The ToM–BKT unified decision. */
  decision: TomMasteryDecision;

  /** Whether the Feynman mode changed this turn. */
  modeChanged: boolean;

  /** Active mode after this turn. */
  activeMode: FeynmanMode;

  /** Current depth level. */
  activeDepth: DepthLevel;

  /** Whether a COMEDY memo was generated this turn. */
  memoryCompressed: boolean;

  /** Context coherence status. */
  coherenceLevel: "ok" | "warning" | "critical";

  /** System prompt injection from ToM-SWE agent. */
  tomInjection: string;
}

// ---------------------------------------------------------------------------
// Session Orchestrator
// ---------------------------------------------------------------------------

/**
 * SessionOrchestrator
 *
 * The main entry point for the DeepFeynman V2 tutoring pipeline.
 * Call `processTurn()` on every user message to get the next system prompt
 * and recommended action.
 */
export class SessionOrchestrator {
  private ape: AdaptivePromptEngine;
  private tomAgent: TomCodeActAgent;
  private state: SessionState;

  constructor(
    sessionId: string,
    studentId: string,
    initialConceptId: string,
    initialMode: FeynmanMode = "explainer",
    initialDepth: DepthLevel = 5
  ) {
    this.ape = new AdaptivePromptEngine();
    this.tomAgent = new TomCodeActAgent(initialMode);

    const emptySession = SessionCleaner.clean(sessionId, []);
    const coldProfile = TomProfileBuilder.coldStart(studentId);
    const coldApeProfile = { ...COLD_START_PROFILE };
    const coldEpistemicState = EpistemicStateTracker.build(
      studentId, {}, coldProfile
    );

    this.state = {
      sessionId,
      studentId,
      turnCount: 0,
      activeConceptId: initialConceptId,
      cleanedSession: emptySession,
      latestAnalysis: null,
      tomProfile: coldProfile,
      masteryStates: new Map([
        [initialConceptId, CoTutorDKT.createState(initialConceptId, MASTERY_COLD_START)],
      ]),
      epistemicState: coldEpistemicState,
      highOrderToM: HighOrderToMTracker.create(studentId),
      apeProfile: coldApeProfile,
      activeMode: initialMode,
      activeDepth: initialDepth,
      sessionAnalysisHistory: [],
      memos: [],
      pendingSignals: [],
    };
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------

  /**
   * Process one conversation turn and return the orchestration output.
   *
   * @param userMessage     The student's message text.
   * @param signalEvents    Any mastery signal events from this turn
   *                        (quiz results, feynman student scores, etc.).
   */
  processTurn(
    userMessage: string,
    signalEvents: SignalEvent[] = []
  ): OrchestratorOutput {
    this.state = { ...this.state, turnCount: this.state.turnCount + 1 };
    const turn = this.state.turnCount;

    // ---- 0. Command parsing -----------------------------------------------
    const parsed = CommandParser.parse(userMessage);
    if (parsed.valid && parsed.command) {
      if (parsed.command === "mode" && parsed.argument) {
        const VALID_MODES: ReadonlySet<string> = new Set(["explainer", "student", "socratic", "duck"]);
        if (VALID_MODES.has(parsed.argument)) {
          const newMode = parsed.argument as FeynmanMode;
          this.state = { ...this.state, activeMode: newMode };
          this.tomAgent = new TomCodeActAgent(newMode);
        }
      }
      if (parsed.command === "depth" && parsed.argument) {
        const d = parseInt(parsed.argument, 10);
        if (d >= 1 && d <= 10) {
          this.state = { ...this.state, activeDepth: d as DepthLevel };
        }
      }
    }

    // ---- 1. Update cleaned session ----------------------------------------
    const newMessage: CleanedSession["messages"][0] = {
      role: "user",
      content: SessionCleaner.stripPII(userMessage),
      turnIndex: turn,
    };
    this.state = {
      ...this.state,
      cleanedSession: {
        ...this.state.cleanedSession,
        messages: [...this.state.cleanedSession.messages, newMessage],
      },
    };

    // ---- 2. APE profile update (every APE_INTERVAL turns) -----------------
    const convoHistory: ConversationRecord[] = this.state.cleanedSession.messages.map(
      (m) => ({ role: m.role, content: m.content })
    );
    const { profile: updatedApeProfile } = this.ape.onNewTurn(
      convoHistory,
      this.state.apeProfile
    );
    this.state = { ...this.state, apeProfile: updatedApeProfile };

    // ---- 3. Session analysis (Tier 2 ToM) ---------------------------------
    const analysis = SessionAnalyser.analyse(this.state.cleanedSession);
    this.state = { ...this.state, latestAnalysis: analysis };

    // ---- 4. ToM profile update (Tier 3) — every APE_INTERVAL turns --------
    if (turn % APE_INTERVAL === 0) {
      const updatedHistory = [...this.state.sessionAnalysisHistory, analysis];
      const updatedTomProfile = TomProfileBuilder.build(
        this.state.studentId,
        updatedHistory,
        this.state.tomProfile
      );
      this.state = {
        ...this.state,
        tomProfile: updatedTomProfile,
        sessionAnalysisHistory: updatedHistory,
      };
    }

    // ---- 5. CoTutor DKT mastery update from signal events -----------------
    const allSignals = [...this.state.pendingSignals, ...signalEvents];
    for (const event of allSignals) {
      const current = this.state.masteryStates.get(event.conceptId)
        ?? CoTutorDKT.createState(event.conceptId, MASTERY_COLD_START);
      const updated = CoTutorDKT.processEvent(current, event);
      this.state.masteryStates.set(event.conceptId, updated);
    }
    this.state = { ...this.state, pendingSignals: [] };

    // ---- 6. Build mastery map for epistemic state -------------------------
    const masteryMap: Record<string, number> = {};
    for (const [id, ms] of this.state.masteryStates) {
      masteryMap[id] = ms.pMastered;
    }

    // ---- 7. Epistemic state (ToM-fused BKT) -------------------------------
    const epistemicState = EpistemicStateTracker.build(
      this.state.studentId,
      masteryMap,
      this.state.tomProfile
    );
    this.state = { ...this.state, epistemicState };

    // ---- 8. 85%-Rule depth adjustment -------------------------------------
    const activeConceptMastery =
      masteryMap[this.state.activeConceptId] ?? MASTERY_COLD_START;
    const { newDepth, direction: diffDirection } = DifficultyAdjuster.recommend(
      activeConceptMastery,
      this.state.activeDepth
    );
    if (newDepth !== this.state.activeDepth) {
      this.state = { ...this.state, activeDepth: newDepth };
    }

    // ---- 9. TomCodeActAgent — per-turn decision ---------------------------
    const { decision, systemPromptInjection, modeChanged } = this.tomAgent.processTurn(
      this.state.studentId,
      this.state.activeConceptId,
      activeConceptMastery,
      analysis.affectSignal,
      this.state.tomProfile,
      this.state.epistemicState,
      this.state.highOrderToM
    );

    if (modeChanged) {
      this.state = { ...this.state, activeMode: this.tomAgent.mode };
    }

    // ---- 10. Generate Feynman system prompt -------------------------------
    const modeConfig: FeynmanModeConfig = {
      mode: this.state.activeMode,
      profile: this.state.apeProfile,
      currentTopic: this.state.activeConceptId,
      knownConcepts: Object.keys(masteryMap).filter(
        (id) => (masteryMap[id] ?? 0) >= 0.85
      ),
      inProgressConcepts: Object.keys(masteryMap).filter(
        (id) => { const p = masteryMap[id] ?? 0; return p >= 0.3 && p < 0.85; }
      ),
    };
    const { systemPrompt } = FeynmanModeEngine.buildSystemPrompt(modeConfig);

    // Append the depth adjustment instruction
    const depthNote = diffDirection !== "maintain"
      ? `\n\n[System: Depth ${diffDirection}d to ${newDepth}/10 based on 85%-rule]`
      : "";

    // ---- 11. COMEDY memory compression (every COMEDY_INTERVAL turns) ------
    let memoryCompressed = false;
    if (turn % COMEDY_INTERVAL === 0 && turn > 0) {
      const memo = MemoryMemoGenerator.generate(
        this.state.sessionId,
        convoHistory,
        this.state.apeProfile,
        this.ape.lastKnownAnalysis ?? {
          inferredDepth: this.state.apeProfile.depth,
          inferredLearningStyle: this.state.apeProfile.learningStyle,
          inferredCommunication: this.state.apeProfile.communication,
          confusionLevel: 0,
          engagementLevel: 0.5,
          conceptsMentioned: [],
          suggestedModeSwitch: null,
          confidence: 0.5,
        }
      );
      this.state = { ...this.state, memos: [...this.state.memos, memo] };
      memoryCompressed = true;
    }

    // ---- 12. Context coherence check ------------------------------------
    const coherenceAssessment = ContextCoherenceMonitor.assess(this.state.highOrderToM);

    // ---- Compose final output -------------------------------------------
    return {
      systemPrompt: systemPrompt + depthNote,
      action: decision.recommendedAction,
      rationale: decision.rationale,
      decision,
      modeChanged,
      activeMode: this.state.activeMode,
      activeDepth: this.state.activeDepth,
      memoryCompressed,
      coherenceLevel: coherenceAssessment.level,
      tomInjection: systemPromptInjection,
    };
  }

  // -------------------------------------------------------------------------
  // State queries
  // -------------------------------------------------------------------------

  /** Get the current mastery probability for a concept. */
  getMastery(conceptId: string): number {
    return this.state.masteryStates.get(conceptId)?.pMastered ?? MASTERY_COLD_START;
  }

  /** Get all mastery states. */
  getAllMasteryStates(): Map<string, CoTutorMasteryState> {
    return new Map(this.state.masteryStates);
  }

  /** Queue a signal event to be processed next turn. */
  queueSignal(event: SignalEvent): void {
    this.state = {
      ...this.state,
      pendingSignals: [...this.state.pendingSignals, event],
    };
  }

  /** Set the active concept (e.g. when student moves to a new topic). */
  setActiveConcept(conceptId: string): void {
    if (!this.state.masteryStates.has(conceptId)) {
      this.state.masteryStates.set(
        conceptId,
        CoTutorDKT.createState(conceptId, MASTERY_COLD_START)
      );
    }
    this.state = { ...this.state, activeConceptId: conceptId };
  }

  /** Register ground truth for a concept (used by HighOrderToMTracker). */
  setGroundTruth(conceptId: string, groundTruth: string): void {
    this.state = {
      ...this.state,
      highOrderToM: HighOrderToMTracker.setGroundTruth(
        this.state.highOrderToM,
        conceptId,
        groundTruth
      ),
    };
  }

  /** Record a student's expressed belief (for high-order ToM tracking). */
  recordStudentBelief(conceptId: string, studentModel: string): void {
    const pMastered = this.getMastery(conceptId);
    this.state = {
      ...this.state,
      highOrderToM: HighOrderToMTracker.recordStudentBelief(
        this.state.highOrderToM,
        conceptId,
        studentModel,
        pMastered
      ),
    };
  }

  get currentState(): SessionState {
    return { ...this.state };
  }

  get currentMode(): FeynmanMode {
    return this.state.activeMode;
  }

  get currentDepth(): DepthLevel {
    return this.state.activeDepth;
  }

  get turnCount(): number {
    return this.state.turnCount;
  }
}
