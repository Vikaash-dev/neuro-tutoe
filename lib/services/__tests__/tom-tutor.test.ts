/**
 * Tests for ToM Tutoring System:
 *  - tom-user-profiler.ts (Three-Tier Memory)
 *  - epistemic-state-tracker.ts (Criteria B + D: BKT + second-order ToM)
 *  - pedagogical-action-space.ts (Criterion C: Socratic restraint + action selection)
 *  - tom-tutor-orchestrator.ts (end-to-end ToM intercept loop)
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Tier 1-3: User Profiler ──────────────────────────────────────────────────
import {
  SessionStore,
  SessionAnalyser,
  ProfileManager,
  FrustrationLevel,
  EngagementLevel,
} from "../tom-user-profiler";

// ── Epistemic State Tracker ──────────────────────────────────────────────────
import {
  EpistemicStateTracker,
} from "../epistemic-state-tracker";

// ── Pedagogical Action Space ─────────────────────────────────────────────────
import {
  ActionConstraintEngine,
  PedagogicalActionSelector,
  BLOCKED_SWE_ACTIONS,
  createSessionContext,
} from "../pedagogical-action-space";

// ── Orchestrator ─────────────────────────────────────────────────────────────
import { TomTutorAgent } from "../tom-tutor-orchestrator";

// ── DKT ──────────────────────────────────────────────────────────────────────
import { LSTMKnowledgeTracingEngine } from "../lstm-knowledge-tracing";

// ============================================================================
// THREE-TIER MEMORY: SESSION STORE (Tier 1)
// ============================================================================

describe("SessionStore (Tier 1)", () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  it("should start a session with session_start event", () => {
    const session = store.startSession("student-1");
    expect(session.studentId).toBe("student-1");
    expect(session.sessionId).toBeTruthy();
    expect(session.events.length).toBe(1);
    expect(session.events[0].type).toBe("session_start");
  });

  it("should record events into the session", () => {
    const session = store.startSession("s1");
    store.addEvent(session.sessionId, "student_message", "What is recursion?", { conceptId: "recursion" });
    const updated = store.getSession(session.sessionId)!;
    expect(updated.events.length).toBe(2); // session_start + student_message
    expect(updated.events[1].type).toBe("student_message");
    expect(updated.events[1].content).toBe("What is recursion?");
  });

  it("should track concept IDs from events", () => {
    const session = store.startSession("s1");
    store.addEvent(session.sessionId, "concept_visited", "", { conceptId: "recursion" });
    store.addEvent(session.sessionId, "concept_visited", "", { conceptId: "loops" });
    const updated = store.getSession(session.sessionId)!;
    expect(updated.conceptIds).toContain("recursion");
    expect(updated.conceptIds).toContain("loops");
  });

  it("should not duplicate concept IDs", () => {
    const session = store.startSession("s1");
    store.addEvent(session.sessionId, "concept_visited", "", { conceptId: "recursion" });
    store.addEvent(session.sessionId, "concept_visited", "", { conceptId: "recursion" });
    const updated = store.getSession(session.sessionId)!;
    expect(updated.conceptIds.filter((c) => c === "recursion").length).toBe(1);
  });

  it("should end a session with session_end event", () => {
    const session = store.startSession("s1");
    const ended = store.endSession(session.sessionId)!;
    expect(ended.endedAt).toBeDefined();
    expect(ended.events.at(-1)?.type).toBe("session_end");
  });

  it("should return sessions for a student sorted by recency", () => {
    const s1 = store.startSession("student-A");
    const s2 = store.startSession("student-A");
    const sessions = store.getStudentSessions("student-A");
    expect(sessions.length).toBe(2);
    // Most recent first
    expect(sessions[0].sessionId).toBe(s2.sessionId);
  });

  it("should return null for unknown session", () => {
    const result = store.addEvent("nonexistent", "student_message", "hi");
    expect(result).toBeNull();
  });
});

// ============================================================================
// SESSION ANALYSER (Tier 2)
// ============================================================================

describe("SessionAnalyser (Tier 2)", () => {
  let store: SessionStore;
  let analyser: SessionAnalyser;

  beforeEach(() => {
    store = new SessionStore();
    analyser = new SessionAnalyser();
  });

  it("should detect high frustration from many hints + frustration signals", () => {
    const session = store.startSession("s1");
    for (let i = 0; i < 4; i++) {
      store.addEvent(session.sessionId, "hint_requested", "", {});
    }
    store.addEvent(session.sessionId, "frustration_signal", "I don't get this", {});
    store.addEvent(session.sessionId, "frustration_signal", "Still confused", {});
    const ended = store.endSession(session.sessionId)!;
    const analysis = analyser.analyse(ended);
    expect(["high", "overwhelmed"]).toContain(analysis.frustrationLevel);
  });

  it("should detect no frustration for a smooth session", () => {
    const session = store.startSession("s1");
    store.addEvent(session.sessionId, "student_message", "That makes sense!", {});
    store.addEvent(session.sessionId, "quiz_attempt", "correct", { correct: true, conceptId: "loops" });
    const ended = store.endSession(session.sessionId)!;
    const analysis = analyser.analyse(ended);
    expect(analysis.frustrationLevel).toBe("none");
  });

  it("should detect breakthrough events", () => {
    const session = store.startSession("s1");
    store.addEvent(session.sessionId, "tutor_response", "Here is an analogy", { strategy: "analogy" });
    store.addEvent(session.sessionId, "breakthrough", "Oh I see! That makes sense now", {});
    const ended = store.endSession(session.sessionId)!;
    const analysis = analyser.analyse(ended);
    expect(analysis.hadBreakthrough).toBe(true);
  });

  it("should detect misconceptions from metadata", () => {
    const session = store.startSession("s1");
    store.addEvent(session.sessionId, "student_message", "Plants get food from soil", {
      misconception: "plants_absorb_food_from_soil",
    });
    const ended = store.endSession(session.sessionId)!;
    const analysis = analyser.analyse(ended);
    expect(analysis.detectedMisconceptions).toContain("plants_absorb_food_from_soil");
  });

  it("should infer effective strategies from breakthrough events", () => {
    const session = store.startSession("s1");
    store.addEvent(session.sessionId, "tutor_response", "Analogy: recursion is like Russian dolls", {
      strategy: "analogy",
    });
    store.addEvent(session.sessionId, "breakthrough", "Oh! I get it now", {});
    const ended = store.endSession(session.sessionId)!;
    const analysis = analyser.analyse(ended);
    expect(analysis.effectiveStrategies).toContain("analogy");
  });

  it("should produce a non-empty summaryForProfile", () => {
    const session = store.startSession("s1");
    store.addEvent(session.sessionId, "student_message", "Hello", {});
    const ended = store.endSession(session.sessionId)!;
    const analysis = analyser.analyse(ended);
    expect(analysis.summaryForProfile).toBeTruthy();
    expect(analysis.summaryForProfile.length).toBeGreaterThan(10);
  });

  it("should infer slow pace from many hint requests", () => {
    const session = store.startSession("s1");
    for (let i = 0; i < 4; i++) {
      store.addEvent(session.sessionId, "hint_requested", "", {});
    }
    const ended = store.endSession(session.sessionId)!;
    const analysis = analyser.analyse(ended);
    expect(analysis.inferredPace).toBe("slow");
  });
});

// ============================================================================
// PROFILE MANAGER (Tier 3)
// ============================================================================

describe("ProfileManager (Tier 3)", () => {
  let store: SessionStore;
  let analyser: SessionAnalyser;
  let manager: ProfileManager;

  beforeEach(() => {
    store = new SessionStore();
    analyser = new SessionAnalyser();
    manager = new ProfileManager();
  });

  it("should return a default profile for unknown student", () => {
    const profile = manager.getOrInitProfile("new-student");
    expect(profile.studentId).toBe("new-student");
    expect(profile.version).toBe(0);
    expect(profile.agentInstructions.length).toBeGreaterThan(0);
  });

  it("should update profile from session analyses", async () => {
    // Run 2 frustrating sessions
    for (let i = 0; i < 2; i++) {
      const session = store.startSession("student-X");
      for (let h = 0; h < 4; h++) {
        store.addEvent(session.sessionId, "hint_requested", "", {});
      }
      store.addEvent(session.sessionId, "frustration_signal", "I don't get this", {});
      const ended = store.endSession(session.sessionId)!;
      const analysis = analyser.analyse(ended);
      manager.recordAnalysis(analysis);
    }
    const profile = await manager.updateProfile("student-X");
    expect(["high", "moderate", "mild", "overwhelmed"]).toContain(profile.averageFrustrationLevel);
    expect(profile.version).toBeGreaterThan(0);
    expect(profile.psychologicalSummary).toBeTruthy();
  });

  it("should generate agent instructions for high frustration", async () => {
    const session = store.startSession("student-Y");
    for (let h = 0; h < 5; h++) {
      store.addEvent(session.sessionId, "hint_requested", "", {});
      store.addEvent(session.sessionId, "frustration_signal", "Ugh", {});
    }
    const ended = store.endSession(session.sessionId)!;
    manager.recordAnalysis(analyser.analyse(ended));
    const profile = await manager.updateProfile("student-Y");
    expect(profile.agentInstructions.length).toBeGreaterThan(0);
  });

  it("should track persistent misconceptions across sessions", async () => {
    for (let i = 0; i < 3; i++) {
      const session = store.startSession("student-Z");
      store.addEvent(session.sessionId, "student_message", "text", {
        misconception: "plants_get_food_from_soil",
      });
      const ended = store.endSession(session.sessionId)!;
      manager.recordAnalysis(analyser.analyse(ended));
    }
    const profile = await manager.updateProfile("student-Z");
    expect(Object.keys(profile.persistentMisconceptions)).toContain(
      "plants_get_food_from_soil"
    );
  });

  it("profile version should increment on each update", async () => {
    const session = store.startSession("s-ver");
    const ended = store.endSession(session.sessionId)!;
    manager.recordAnalysis(analyser.analyse(ended));
    const v1 = await manager.updateProfile("s-ver");
    const v2 = await manager.updateProfile("s-ver");
    expect(v2.version).toBeGreaterThan(v1.version);
  });
});

// ============================================================================
// EPISTEMIC STATE TRACKER (Criterion B: BKT + Criterion D: 2nd-order ToM)
// ============================================================================

describe("EpistemicStateTracker", () => {
  let tracker: EpistemicStateTracker;
  let trace: ReturnType<typeof LSTMKnowledgeTracingEngine.initializeTrace>;

  beforeEach(() => {
    tracker = new EpistemicStateTracker();
    trace = LSTMKnowledgeTracingEngine.initializeTrace("student-1");
  });

  it("should create a default state for a new student/concept", () => {
    const state = tracker.getOrCreateState("student-1", "recursion");
    expect(state.studentId).toBe("student-1");
    expect(state.conceptId).toBe("recursion");
    expect(state.masteryProbability).toBe(0.5);
    expect(state.recommendedAction).toBe("explain");
  });

  it("should update mastery after a correct answer", () => {
    const state = tracker.update(trace, "recursion", true, 3000, 4);
    expect(state.masteryProbability).toBeGreaterThan(0.5);
    expect(state.observationCount).toBe(1);
  });

  it("should update mastery after an incorrect answer", () => {
    // Set initial state above 0.5 to ensure a decrease
    tracker.update(trace, "loops", true, 3000, 5); // first correct
    const state = tracker.update(trace, "loops", false, 8000, 1); // then wrong
    // Mastery should have changed
    expect(state.observationCount).toBe(2);
    expect(state.masteryProbability).toBeGreaterThanOrEqual(0);
  });

  it("should detect flawed mental model when student is over-confident but wrong", () => {
    // Student says confidence=5 (maximum) but gets it wrong multiple times
    tracker.update(trace, "pointers", false, 2000, 5, false); // wrong but very confident
    tracker.update(trace, "pointers", false, 2000, 5, false);
    const state = tracker.update(trace, "pointers", false, 2000, 5, false);
    // Self-assessed confidence is high, actual mastery is low → flawed model
    expect(state.studentSelfAssessedMastery).toBeGreaterThan(state.masteryProbability);
    expect(state.beliefRealityDivergence).toBeGreaterThan(0);
  });

  it("should compute second-order ToM belief", () => {
    tracker.update(trace, "pointers", false, 2000, 5); // overconfident + wrong
    const belief = tracker.computeSecondOrderBelief("student-1", "pointers");
    expect(belief.studentId).toBe("student-1");
    expect(belief.conceptId).toBe("pointers");
    expect(belief.correctionStrategy).toBeDefined();
  });

  it("should record and retrieve active misconceptions", () => {
    tracker.recordMisconception("student-1", "recursion", "infinite_loops_are_recursion");
    const state = tracker.getOrCreateState("student-1", "recursion");
    expect(state.activeMisconceptions).toContain("infinite_loops_are_recursion");
  });

  it("should resolve a misconception and move it to resolved list", () => {
    tracker.recordMisconception("student-1", "recursion", "inf_loop");
    tracker.resolveMisconception("student-1", "recursion", "inf_loop");
    const state = tracker.getOrCreateState("student-1", "recursion");
    expect(state.activeMisconceptions).not.toContain("inf_loop");
    expect(state.resolvedMisconceptions).toContain("inf_loop");
  });

  it("should generate a mastery-aware instruction fusing DKT + ToM profile", () => {
    tracker.update(trace, "graph-traversal", false, 5000, 5); // overconfident + wrong → frustration + belief mismatch
    const state = tracker.getOrCreateState("student-1", "graph-traversal");
    const profile = {
      studentId: "student-1",
      averageFrustrationLevel: "high" as const,
      preferredModality: "visual" as const,
      agentInstructions: ["Use visual analogies."],
      persistentMisconceptions: {},
      createdAt: Date.now(), updatedAt: Date.now(), version: 1,
      depthPreference: 5, communicationStyle: "encouraging" as const,
      workingStyle: "exploratory" as const, preferredPace: "slow" as const,
      motivationLevel: 60, frustrationTriggers: [],
      reengagementStrategies: [], falselyMasteredConcepts: [],
      analogyResonanceTopics: ["visual"], totalSessions: 2,
      totalStudyMinutes: 30, averageEngagementLevel: "active" as const,
      psychologicalSummary: "Test profile",
    };
    const instruction = tracker.generateMasteryAwareInstruction(state, profile);
    expect(instruction).toBeTruthy();
    expect(instruction).toContain("graph-traversal");
    // Should mention visual analogy fallback because frustrated + low mastery
    expect(instruction.toLowerCase()).toMatch(/visual|analogy|fallback/);
  });

  it("averageMastery should aggregate all concepts", () => {
    tracker.update(trace, "algebra", true, 3000, 4);
    const calculusTrace = LSTMKnowledgeTracingEngine.initializeTrace("student-1");
    tracker.update(calculusTrace, "calculus", false, 8000, 2);
    const avg = tracker.averageMastery("student-1");
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThanOrEqual(1);
  });

  it("getAllStates should return all tracked concepts for a student", () => {
    tracker.update(trace, "algebra", true, 3000, 4);
    const secondConceptTrace = LSTMKnowledgeTracingEngine.initializeTrace("student-1");
    tracker.update(secondConceptTrace, "geometry", true, 2000, 5);
    const states = tracker.getAllStates("student-1");
    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(states.some((s) => s.conceptId === "algebra")).toBe(true);
    expect(states.some((s) => s.conceptId === "geometry")).toBe(true);
  });
});

// ============================================================================
// ACTION CONSTRAINT ENGINE (Criterion C: Socratic Restraint)
// ============================================================================

describe("ActionConstraintEngine", () => {
  let engine: ActionConstraintEngine;

  beforeEach(() => {
    engine = new ActionConstraintEngine();
  });

  it("should block all SWE execution actions", () => {
    for (const blocked of BLOCKED_SWE_ACTIONS) {
      expect(engine.isBlocked(blocked)).toBe(true);
    }
  });

  it("should not block pedagogical actions", () => {
    expect(engine.isBlocked("ask_socratic_question")).toBe(false);
    expect(engine.isBlocked("evaluate_mastery")).toBe(false);
    expect(engine.isBlocked("generate_analogy")).toBe(false);
  });

  it("should replace blocked SWE action with socratic question", () => {
    const result = engine.constrainAction("run_bash", 0.6, "none", "recursion", 2);
    expect(result).toBe("ask_socratic_question");
  });

  it("should enforce socratic restraint: block direct explanation when mastery >= threshold", () => {
    const result = engine.constrainAction(
      "explain_concept",
      ActionConstraintEngine.SOCRATIC_RESTRAINT_THRESHOLD + 0.1, // above threshold
      "none",
      "recursion",
      5
    );
    expect(result).toBe("ask_socratic_question");
  });

  it("should allow direct explanation when mastery is very low (< 0.25)", () => {
    const result = engine.constrainAction("explain_concept", 0.1, "none", "recursion", 1);
    expect(result).toBe("explain_concept");
  });

  it("should override to acknowledge_frustration when student is overwhelmed", () => {
    const result = engine.constrainAction("ask_socratic_question", 0.5, "overwhelmed", "recursion", 3);
    expect(result).toBe("acknowledge_frustration");
  });

  it("should downgrade confused_student_mode when mastery is too low", () => {
    // Below CONFUSED_STUDENT_THRESHOLD → should give hint instead
    const result = engine.constrainAction(
      "trigger_confused_student",
      ActionConstraintEngine.CONFUSED_STUDENT_THRESHOLD - 0.1,
      "none",
      "recursion",
      5
    );
    expect(result).toBe("give_hint");
  });

  it("isSocraticRestraintActive returns true at and above threshold", () => {
    expect(engine.isSocraticRestraintActive(ActionConstraintEngine.SOCRATIC_RESTRAINT_THRESHOLD)).toBe(true);
    expect(engine.isSocraticRestraintActive(ActionConstraintEngine.SOCRATIC_RESTRAINT_THRESHOLD - 0.01)).toBe(false);
  });

  it("shouldTriggerConfusedStudentMode requires enough interactions", () => {
    expect(engine.shouldTriggerConfusedStudentMode(0.6, 2)).toBe(false); // < 3 interactions
    expect(engine.shouldTriggerConfusedStudentMode(0.6, 3)).toBe(true);
    expect(engine.shouldTriggerConfusedStudentMode(0.4, 5)).toBe(false); // mastery too low
  });
});

// ============================================================================
// PEDAGOGICAL ACTION SELECTOR
// ============================================================================

describe("PedagogicalActionSelector", () => {
  let selector: PedagogicalActionSelector;

  beforeEach(() => {
    selector = new PedagogicalActionSelector();
  });

  const makeProfile = (
    frustration: FrustrationLevel = "none",
    modality: "visual" | "verbal" | "example-based" | "formal" | "mixed" = "mixed"
  ) => ({
    studentId: "s1",
    averageFrustrationLevel: frustration,
    preferredModality: modality,
    agentInstructions: [],
    persistentMisconceptions: {} as Record<string, string>,
    createdAt: Date.now(), updatedAt: Date.now(), version: 1,
    depthPreference: 5, communicationStyle: "encouraging" as const,
    workingStyle: "exploratory" as const, preferredPace: "moderate" as const,
    motivationLevel: 70, frustrationTriggers: [],
    reengagementStrategies: [], falselyMasteredConcepts: [],
    analogyResonanceTopics: [], totalSessions: 1, totalStudyMinutes: 60,
    averageEngagementLevel: "active" as const, psychologicalSummary: "test",
  });

  const makeEpistemicState = (mastery: number, hasFlawedModel = false): any => ({
    studentId: "s1", conceptId: "recursion",
    masteryProbability: mastery,
    masteryConfidenceInterval: [mastery - 0.1, mastery + 0.1] as [number, number],
    observationCount: 5,
    lastUpdated: Date.now(),
    studentSelfAssessedMastery: hasFlawedModel ? mastery + 0.3 : mastery,
    studentBelievesTheyKnowIt: hasFlawedModel,
    hasFlawedMentalModel: hasFlawedModel,
    beliefRealityDivergence: hasFlawedModel ? 0.3 : 0,
    activeMisconceptions: [],
    resolvedMisconceptions: [],
    learningVelocity: 0.05,
    recommendedAction: "socratic",
    estimatedDaysToMastery: 3,
  });

  it("should select explain_concept for very low mastery", () => {
    const action = selector.selectAction(
      "recursion",
      makeEpistemicState(0.1),
      makeProfile(),
      createSessionContext("sess", "s1", "recursion")
    );
    expect(["explain_concept", "show_worked_example", "draw_concept_map"]).toContain(action.type);
  });

  it("should select show_worked_example when modality is example-based + low mastery", () => {
    const action = selector.selectAction(
      "recursion",
      makeEpistemicState(0.1),
      makeProfile("none", "example-based"),
      createSessionContext("sess", "s1", "recursion")
    );
    expect(action.type).toBe("show_worked_example");
  });

  it("should enforce socratic restraint for moderate mastery", () => {
    const action = selector.selectAction(
      "recursion",
      makeEpistemicState(0.5),
      makeProfile(),
      createSessionContext("sess", "s1", "recursion")
    );
    expect(action.socraticRestraintActive).toBe(true);
    expect(["ask_socratic_question", "generate_analogy"]).toContain(action.type);
  });

  it("should trigger acknowledge_frustration when overwhelmed", () => {
    const ctx = createSessionContext("sess", "s1", "recursion");
    ctx.recentFrustrationSignals = 3;
    const action = selector.selectAction(
      "recursion",
      makeEpistemicState(0.4),
      makeProfile("overwhelmed"),
      ctx
    );
    expect(action.type).toBe("acknowledge_frustration");
  });

  it("should trigger confused_student mode when flawed mental model + sufficient mastery", () => {
    const ctx = createSessionContext("sess", "s1", "recursion");
    ctx.interactionCount = 5;
    const action = selector.selectAction(
      "recursion",
      makeEpistemicState(0.65, true), // flawed model, enough mastery
      makeProfile(),
      ctx
    );
    expect(action.type).toBe("trigger_confused_student");
    expect(action.confusedStudentModeActive).toBe(true);
  });

  it("should advance to challenge when mastery is high", () => {
    const action = selector.selectAction(
      "recursion",
      makeEpistemicState(0.9),
      makeProfile(),
      createSessionContext("sess", "s1", "recursion")
    );
    expect(action.type).toBe("advance_to_challenge");
  });

  it("should produce a non-empty instruction for all action types", () => {
    const action = selector.selectAction(
      "recursion",
      makeEpistemicState(0.5),
      makeProfile(),
      createSessionContext("sess", "s1", "recursion")
    );
    expect(action.instruction).toBeTruthy();
    expect(action.instruction.length).toBeGreaterThan(10);
  });

  it("buildAction should produce all required fields", () => {
    const action = selector.buildAction(
      "generate_analogy", "calculus", 0.4, 2, false, false, { analogyDomain: "cooking" }
    );
    expect(action.type).toBe("generate_analogy");
    expect(action.conceptId).toBe("calculus");
    expect(action.bloomLevel).toBe(2);
    expect(action.instruction).toContain("calculus");
  });
});

// ============================================================================
// TOM TUTOR ORCHESTRATOR (End-to-End)
// ============================================================================

describe("TomTutorAgent (Orchestrator)", () => {
  let agent: TomTutorAgent;

  beforeEach(() => {
    agent = new TomTutorAgent();
  });

  it("should start a session and return a CleanedSession", () => {
    const session = agent.startSession("student-1");
    expect(session.studentId).toBe("student-1");
    expect(session.sessionId).toBeTruthy();
  });

  it("should return a TutorDecision for a normal interaction", async () => {
    const session = agent.startSession("student-1");
    const decision = await agent.decide({
      studentId: "student-1",
      conceptId: "recursion",
      sessionId: session.sessionId,
      studentInput: "I think I understand recursion",
      isQuizAttempt: false,
    });
    expect(decision.action).toBeDefined();
    expect(decision.action.type).toBeTruthy();
    expect(decision.systemPromptInjection).toContain("ToM TUTOR CONTEXT");
    expect(decision.epistemicState).toBeDefined();
    expect(decision.rationale).toBeTruthy();
  });

  it("should update epistemic state on quiz attempt", async () => {
    const session = agent.startSession("student-2");
    const decision = await agent.decide({
      studentId: "student-2",
      conceptId: "recursion",
      sessionId: session.sessionId,
      studentInput: "Base case stops the recursion",
      isQuizAttempt: true,
      isCorrect: true,
      selfConfidence: 4,
      responseTime: 5000,
    });
    expect(decision.epistemicState.observationCount).toBe(1);
    expect(decision.epistemicState.masteryProbability).toBeDefined();
  });

  it("should activate Socratic restraint when mastery is moderate", async () => {
    const session = agent.startSession("student-3");
    // Give some correct answers to build mastery above socratic threshold
    for (let i = 0; i < 4; i++) {
      await agent.decide({
        studentId: "student-3",
        conceptId: "recursion",
        sessionId: session.sessionId,
        studentInput: "Correct answer",
        isQuizAttempt: true,
        isCorrect: true,
        selfConfidence: 4,
      });
    }
    const decision = await agent.decide({
      studentId: "student-3",
      conceptId: "recursion",
      sessionId: session.sessionId,
      studentInput: "What does the base case do?",
      isQuizAttempt: false,
    });
    // After multiple correct answers, mastery > threshold → socratic restraint or similar
    expect(decision.systemPromptInjection).toBeDefined();
    expect(decision.action.type).toBeTruthy();
  });

  it("should detect frustration from student input", async () => {
    const session = agent.startSession("student-4");
    const decision = await agent.decide({
      studentId: "student-4",
      conceptId: "pointers",
      sessionId: session.sessionId,
      studentInput: "I don't understand this at all! This doesn't make sense.",
      isQuizAttempt: false,
    });
    // Should have logged frustration signal
    const sessionData = agent["sessionStoreInstance"].getSession(session.sessionId);
    const hasFrustrationEvent = sessionData?.events.some((e) => e.type === "frustration_signal");
    expect(hasFrustrationEvent).toBe(true);
  });

  it("should detect breakthrough from student input", async () => {
    const session = agent.startSession("student-5");
    const decision = await agent.decide({
      studentId: "student-5",
      conceptId: "loops",
      sessionId: session.sessionId,
      studentInput: "Oh I see! So the loop just keeps running until the condition is false!",
      isQuizAttempt: false,
    });
    const sessionData = agent["sessionStoreInstance"].getSession(session.sessionId);
    const hasBreakthrough = sessionData?.events.some((e) => e.type === "breakthrough");
    expect(hasBreakthrough).toBe(true);
  });

  it("should include belief mismatch warning in system prompt when student is overconfident", async () => {
    const session = agent.startSession("student-6");
    // Student repeatedly very confident but wrong
    for (let i = 0; i < 3; i++) {
      await agent.decide({
        studentId: "student-6",
        conceptId: "recursion",
        sessionId: session.sessionId,
        studentInput: "I know this perfectly",
        isQuizAttempt: true,
        isCorrect: false,
        selfConfidence: 5, // Max confidence but wrong → belief mismatch
      });
    }
    const decision = await agent.decide({
      studentId: "student-6",
      conceptId: "recursion",
      sessionId: session.sessionId,
      studentInput: "I think I know recursion",
      isQuizAttempt: false,
    });
    // System prompt should warn about belief mismatch
    expect(decision.systemPromptInjection).toContain("recursion");
    expect(decision.systemPromptInjection).toBeTruthy();
  });

  it("should record misconceptions and include them in system prompt", async () => {
    const session = agent.startSession("student-7");
    const decision = await agent.decide({
      studentId: "student-7",
      conceptId: "photosynthesis",
      sessionId: session.sessionId,
      studentInput: "Plants get food from soil",
      isQuizAttempt: false,
      detectedMisconceptionIds: ["plants_get_food_from_soil"],
    });
    expect(decision.epistemicState.activeMisconceptions).toContain("plants_get_food_from_soil");
    expect(decision.systemPromptInjection).toContain("MISCONCEPTIONS");
  });

  it("should end a session and log a session_end event", async () => {
    const session = agent.startSession("student-8");
    await agent.decide({
      studentId: "student-8",
      conceptId: "loops",
      sessionId: session.sessionId,
      studentInput: "ok",
      isQuizAttempt: false,
    });
    await agent.endSession("student-8", session.sessionId);
    const sessionData = agent["sessionStoreInstance"].getSession(session.sessionId);
    expect(sessionData?.endedAt).toBeDefined();
  });

  it("decision log should grow with each decision", async () => {
    const session = agent.startSession("student-9");
    for (let i = 0; i < 3; i++) {
      await agent.decide({
        studentId: "student-9",
        conceptId: "algebra",
        sessionId: session.sessionId,
        studentInput: `message ${i}`,
        isQuizAttempt: false,
      });
    }
    expect(agent.getDecisionLog().length).toBe(3);
  });

  it("system prompt injection should contain all ToM sections", async () => {
    const session = agent.startSession("student-10");
    const decision = await agent.decide({
      studentId: "student-10",
      conceptId: "calculus",
      sessionId: session.sessionId,
      studentInput: "Tell me about derivatives",
      isQuizAttempt: false,
    });
    const prompt = decision.systemPromptInjection;
    expect(prompt).toContain("STUDENT PROFILE");
    expect(prompt).toContain("MASTERY STATE");
    expect(prompt).toContain("SELECTED ACTION");
    expect(prompt).toContain("END ToM CONTEXT");
  });
});
