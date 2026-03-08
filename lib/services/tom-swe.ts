/**
 * ToM-SWE: Theory of Mind for Software Engineering Agents
 * Adapted for Pedagogical Use — ADA-7 / DeepFeynman V2
 *
 * This module implements the Three-Tier Memory Architecture from OpenHands'
 * ToM-SWE module, repurposed for LLM-based tutoring:
 *
 *   Tier 1 — SessionCleaner:    raw dialogue → CleanedSession
 *   Tier 2 — SessionAnalyser:   CleanedSession → SessionAnalysis
 *   Tier 3 — TomProfileBuilder: SessionAnalysis[] → TomUserProfile
 *
 * Key architectural change vs OpenHands:
 *   - Strips the "execution drive" (git/npm tool-calls).
 *   - Maps the ToM profile to EPISTEMIC STATE (concept mastery), not code state.
 *   - Adds HIGH-ORDER ToM (second-order beliefs: student's flawed mental model
 *     vs ground truth) required for Socratic restraint and misconception detection.
 *
 * Research basis:
 *   - OpenHands ToM-SWE (All-Hands AI, 2025): Three-Tier Memory Architecture
 *   - ProfiLLM (arXiv:2506.13980): implicit profiling from conversation
 *   - COMEDY (2025): LLM memory compression for long sessions
 *   - Borchers et al. (2025): LLMs as "overly coherent" vs student divergence
 *   - Hegde & Jayalath (2025): affective computing from textual cues
 *   - Jin et al. (2025): LLMs diagnosing cognitive skills
 *   - Wellman (1992): Theory of Mind taxonomy (0th / 1st / 2nd order)
 */

import {
  CleanedSession,
  SessionAnalysis,
  TomUserProfile,
  HighOrderToMState,
  NestedBelief,
  EpistemicState,
  PedagogicalAction,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum sessions before the profile is considered reliable */
export const MIN_SESSIONS_FOR_PROFILE = 2;

/** Context coherence degrades at this rate per detected contradiction */
export const COHERENCE_DECAY_PER_CONTRADICTION = 0.12;

/** False-confidence threshold: p_mastered ≥ this AND belief is flawed */
export const FALSE_CONFIDENCE_MASTERY_THRESHOLD = 0.65;

// ---------------------------------------------------------------------------
// Tier 1 — Session Cleaner
// ---------------------------------------------------------------------------

const PII_PATTERNS: RegExp[] = [
  /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi,       // emails
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,     // phone numbers
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,           // IP addresses
];

/** SWE tool names that are irrelevant to pedagogy — stripped in cleaning */
const SWE_TOOL_NAMES = new Set([
  "bash", "git", "npm", "pip", "file_editor", "browser", "execute_command",
  "read_file", "write_file", "list_directory",
]);

/**
 * SessionCleaner — Tier 1
 *
 * Cleans raw conversation + tool logs into a normalised form suitable for
 * semantic analysis.  Strips PII, removes SWE execution artefacts, and
 * normalises whitespace.
 */
export class SessionCleaner {
  /**
   * Clean raw messages into a CleanedSession.
   *
   * @param sessionId   Unique session identifier.
   * @param rawMessages Raw conversation messages with role + content.
   * @param toolEvents  Optional raw tool-use logs.
   * @param startedAt   Session start timestamp (defaults to now).
   */
  static clean(
    sessionId: string,
    rawMessages: Array<{ role: string; content: string }>,
    toolEvents: Array<{ tool: string; input: string; output: string; turnIndex: number }> = [],
    startedAt: number = Date.now()
  ): CleanedSession {
    let turnIndex = 0;

    const messages = rawMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: SessionCleaner.stripPII(m.content.trim()),
        turnIndex: turnIndex++,
      }));

    // Remove SWE-specific tool events (irrelevant to pedagogy)
    const pedagogicalToolEvents = toolEvents.filter(
      (e) => !SWE_TOOL_NAMES.has(e.tool.toLowerCase())
    );

    return {
      sessionId,
      startedAt,
      endedAt: 0,
      messages,
      toolEvents: pedagogicalToolEvents,
    };
  }

  /** Mark a session as ended. */
  static finalize(session: CleanedSession, endedAt: number = Date.now()): CleanedSession {
    return { ...session, endedAt };
  }

  /** Strip PII from a text string. */
  static stripPII(text: string): string {
    let cleaned = text;
    for (const pattern of PII_PATTERNS) {
      cleaned = cleaned.replace(pattern, "[REDACTED]");
    }
    return cleaned;
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — Session Analyser
// ---------------------------------------------------------------------------

const FRICTION_PATTERNS: ReadonlyArray<{ pattern: string; severity: "low" | "medium" | "high" }> = [
  { pattern: "i don't understand",    severity: "high"   },
  { pattern: "i dont understand",     severity: "high"   },
  { pattern: "i'm lost",              severity: "high"   },
  { pattern: "this doesn't make sense", severity: "high" },
  { pattern: "confused",              severity: "medium" },
  { pattern: "what does that mean",   severity: "medium" },
  { pattern: "can you explain",       severity: "medium" },
  { pattern: "not sure",              severity: "low"    },
  { pattern: "wait",                  severity: "low"    },
  { pattern: "huh",                   severity: "low"    },
  { pattern: "i think",               severity: "low"    },
];

const POSITIVE_AFFECT: readonly string[] = [
  "i get it", "makes sense", "got it", "i see", "oh!", "interesting",
  "that's helpful", "thank you", "great", "perfect", "exactly",
];

const DISENGAGED_SIGNALS: readonly string[] = [
  "ok", "fine", "sure", "whatever", "idk", "i don't care",
  "just tell me", "just give me the answer",
];

/**
 * SessionAnalyser — Tier 2
 *
 * Extracts intent, friction points, and immediate goals from a CleanedSession.
 * Provides an affect signal using textual cues (Hegde & Jayalath 2025).
 */
export class SessionAnalyser {
  /**
   * Analyse a cleaned session and produce a SessionAnalysis.
   */
  static analyse(session: CleanedSession): SessionAnalysis {
    const userMessages = session.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content);

    const allUserText = userMessages.join(" ");
    const lowerText = allUserText.toLowerCase();

    // ---- Friction points -----------------------------------------------
    const frictionPoints: SessionAnalysis["frictionPoints"] = [];
    for (const { pattern, severity } of FRICTION_PATTERNS) {
      session.messages.forEach((msg) => {
        if (msg.role === "user" && msg.content.toLowerCase().includes(pattern)) {
          frictionPoints.push({
            turnIndex: msg.turnIndex,
            description: `Student expressed: "${pattern}"`,
            severity,
          });
        }
      });
    }

    // ---- Affect signal --------------------------------------------------
    const positiveHits = POSITIVE_AFFECT.filter((p) => lowerText.includes(p)).length;
    const disengagedHits = DISENGAGED_SIGNALS.filter((p) => lowerText.includes(p)).length;
    const highFriction = frictionPoints.filter((f) => f.severity === "high").length;
    const medFriction  = frictionPoints.filter((f) => f.severity === "medium").length;

    let affectSignal: SessionAnalysis["affectSignal"];
    if (disengagedHits >= 2) {
      affectSignal = "disengaged";
    } else if (highFriction >= 2) {
      affectSignal = "frustrated";
    } else if (medFriction >= 3 || highFriction >= 1) {
      affectSignal = "confused";
    } else if (positiveHits >= 2) {
      affectSignal = "positive";
    } else {
      affectSignal = "neutral";
    }

    // ---- Inferred intent ------------------------------------------------
    let inferredIntent = "general learning";
    if (lowerText.includes("how does") || lowerText.includes("explain")) {
      inferredIntent = "conceptual understanding";
    } else if (lowerText.includes("how do i") || lowerText.includes("step by step")) {
      inferredIntent = "procedural practice";
    } else if (
      /\bwhy\b/.test(lowerText) &&
      !/\bwhy\s+(don'?t|doesn'?t|won'?t|can'?t|couldn'?t|isn'?t|aren'?t)\b/.test(lowerText)
    ) {
      inferredIntent = "causal reasoning";
    } else if (lowerText.includes("difference between") || lowerText.includes("compare")) {
      inferredIntent = "comparative analysis";
    } else if (lowerText.includes("quiz") || lowerText.includes("test me")) {
      inferredIntent = "self-assessment";
    }

    // ---- Immediate goals ------------------------------------------------
    const immediateGoals: string[] = [];
    const questionMatches = allUserText.match(/\b(how|why|what|where|when|can)\b[^.!?]{5,60}[?]/gi) ?? [];
    questionMatches.slice(0, 5).forEach((q) => immediateGoals.push(q.trim()));

    // ---- Active concepts (capitalised proper nouns likely to be topics) ----
    const activeConceptIds = Array.from(
      new Set(
        (allUserText.match(/\b[A-Z][a-z]{2,}\b/g) ?? [])
          .filter((w) => !["What", "How", "Why", "Can", "The", "I", "This", "That"].includes(w))
          .slice(0, 10)
      )
    );

    // ---- Quality score --------------------------------------------------
    const avgMessageLen =
      userMessages.length > 0
        ? userMessages.reduce((s, m) => s + m.length, 0) / userMessages.length
        : 0;
    const engagementScore = Math.min(avgMessageLen / 150, 1);
    const clarityScore = 1 - Math.min(frictionPoints.length * 0.1, 0.8);
    const qualityScore = (engagementScore + clarityScore) / 2;

    return {
      sessionId: session.sessionId,
      analyzedAt: Date.now(),
      inferredIntent,
      frictionPoints,
      immediateGoals,
      activeConceptIds,
      affectSignal,
      qualityScore,
    };
  }
}

// ---------------------------------------------------------------------------
// Tier 3 — ToM Profile Builder
// ---------------------------------------------------------------------------

/**
 * TomProfileBuilder — Tier 3
 *
 * Aggregates multiple SessionAnalysis records into a persistent
 * psychological TomUserProfile.
 *
 * Equivalent to OpenHands' "User Profiles" tier but mapped to pedagogy:
 * working style, communication preferences, frustration triggers,
 * deep interest topics, and implicit learning needs.
 */
export class TomProfileBuilder {
  /**
   * Build or update a TomUserProfile from an array of session analyses.
   *
   * @param userId      Student/user identifier.
   * @param analyses    All session analyses for this user.
   * @param existing    Optional existing profile to update (incremental).
   */
  static build(
    userId: string,
    analyses: SessionAnalysis[],
    existing?: TomUserProfile
  ): TomUserProfile {
    if (analyses.length === 0) {
      return existing ?? TomProfileBuilder.coldStart(userId);
    }

    // ---- Working style --------------------------------------------------
    const allIntents = analyses.map((a) => a.inferredIntent);
    const intentFreq = TomProfileBuilder.frequency(allIntents);
    const dominantIntent = Object.entries(intentFreq).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "";
    const workingStyle: TomUserProfile["workingStyle"] = (
      dominantIntent.includes("procedural") ? "example-driven" :
      dominantIntent.includes("causal")     ? "theory-first" :
      dominantIntent.includes("conceptual") ? "systematic" :
      "mixed"
    );

    // ---- Communication preferences --------------------------------------
    const avgQuality = analyses.reduce((s, a) => s + a.qualityScore, 0) / analyses.length;
    const allUserTexts = analyses.flatMap((a) => a.immediateGoals).join(" ").toLowerCase();

    const analogyAffinity = allUserTexts.includes("like") || allUserTexts.includes("similar to") ||
      allUserTexts.includes("analogy") || allUserTexts.includes("example");
    const exampleAffinity = allUserTexts.includes("example") || allUserTexts.includes("show me");

    const verbosity: TomUserProfile["communicationPreferences"]["verbosity"] =
      avgQuality > 0.7 ? "detailed" : avgQuality < 0.4 ? "concise" : "moderate";

    const formalWords = ["therefore", "hence", "thus", "formally", "rigorously"];
    const formalHits = formalWords.filter((w) => allUserTexts.includes(w)).length;
    const formality: TomUserProfile["communicationPreferences"]["formality"] =
      formalHits >= 2 ? "formal" : formalHits === 0 ? "casual" : "mixed";

    // ---- Frustration triggers ------------------------------------------
    const highFrictionDescriptions = analyses
      .flatMap((a) => a.frictionPoints.filter((f) => f.severity === "high").map((f) => f.description))
      .slice(0, 8);

    // ---- Deep interests -------------------------------------------------
    const allConcepts = analyses.flatMap((a) => a.activeConceptIds);
    const conceptFreq = TomProfileBuilder.frequency(allConcepts);
    const deepInterestTopics = Object.entries(conceptFreq)
      .filter(([, count]) => count >= Math.ceil(analyses.length / 3))
      .map(([concept]) => concept)
      .slice(0, 8);

    // ---- Implicit needs -------------------------------------------------
    const implicitNeeds: string[] = [];
    const frustrationRate = analyses.filter(
      (a) => a.affectSignal === "frustrated" || a.affectSignal === "confused"
    ).length / analyses.length;

    if (frustrationRate > 0.4) implicitNeeds.push("More scaffolded explanations");
    if (frustrationRate < 0.2 && deepInterestTopics.length > 3) {
      implicitNeeds.push("Advanced challenge problems");
    }
    if (analogyAffinity) implicitNeeds.push("Concrete analogies for abstract concepts");
    if (exampleAffinity) implicitNeeds.push("Worked examples before theory");

    const confidence = Math.min(0.4 + analyses.length * 0.12, 0.95);

    return {
      userId,
      updatedAt: Date.now(),
      workingStyle,
      communicationPreferences: {
        verbosity,
        formality,
        analogyAffinity,
        exampleAffinity,
      },
      implicitNeeds,
      frustrationTriggers: highFrictionDescriptions,
      deepInterestTopics,
      sessionIds: analyses.map((a) => a.sessionId),
      profileConfidence: confidence,
    };
  }

  /** Cold-start profile with neutral defaults. */
  static coldStart(userId: string): TomUserProfile {
    return {
      userId,
      updatedAt: Date.now(),
      workingStyle: "mixed",
      communicationPreferences: {
        verbosity: "moderate",
        formality: "mixed",
        analogyAffinity: false,
        exampleAffinity: false,
      },
      implicitNeeds: [],
      frustrationTriggers: [],
      deepInterestTopics: [],
      sessionIds: [],
      profileConfidence: 0,
    };
  }

  private static frequency(items: string[]): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item] = (acc[item] ?? 0) + 1;
      return acc;
    }, {});
  }
}

// ---------------------------------------------------------------------------
// High-Order ToM — Nested Belief Tracker
// ---------------------------------------------------------------------------

/**
 * HighOrderToMTracker
 *
 * Maintains a dual model per student:
 *   1. Ground truth (what the tutor knows is correct)
 *   2. Student's belief (what the student thinks — possibly flawed)
 *
 * Detects "false confidence" — when the student thinks they understand
 * but their expressed model diverges from ground truth.  This is the most
 * dangerous learning state and the primary trigger for Socratic intervention.
 *
 * Research basis:
 *   - Wellman (1992): ToM taxonomy
 *   - Borchers et al. (2025): LLMs are "overly coherent"; student overload
 *     manifests as divergence from coherence (fragmentation, circular logic)
 *   - Jin et al. (2025): LLMs diagnosing cognitive skill breakdowns
 */
export class HighOrderToMTracker {
  /**
   * Create an empty HighOrderToMState for a student.
   */
  static create(studentId: string): HighOrderToMState {
    return {
      studentId,
      updatedAt: Date.now(),
      groundTruthMap: {},
      studentBeliefMap: {},
      falseConfidenceConcepts: [],
      contextCoherenceScore: 1.0,
    };
  }

  /**
   * Register or update the ground truth for a concept.
   */
  static setGroundTruth(
    state: HighOrderToMState,
    conceptId: string,
    groundTruth: string
  ): HighOrderToMState {
    return {
      ...state,
      groundTruthMap: { ...state.groundTruthMap, [conceptId]: groundTruth },
      updatedAt: Date.now(),
    };
  }

  /**
   * Record the student's expressed belief about a concept.
   * Compares against ground truth to determine if belief is flawed.
   *
   * @param state          Current HighOrderToMState.
   * @param conceptId      Concept the student expressed a belief about.
   * @param studentModel   The student's expressed understanding (text).
   * @param pMastered      Current BKT mastery probability for this concept.
   */
  static recordStudentBelief(
    state: HighOrderToMState,
    conceptId: string,
    studentModel: string,
    pMastered: number
  ): HighOrderToMState {
    const groundTruth = state.groundTruthMap[conceptId] ?? "";
    const isFlawed = HighOrderToMTracker.detectBeliefFlaw(studentModel, groundTruth);

    const belief: NestedBelief = {
      conceptId,
      studentModel,
      groundTruth,
      isFlawed,
      correctionProbability: isFlawed ? 0 : 1,
      observedAt: Date.now(),
    };

    // False confidence: student model is flawed BUT mastery p is high
    // (student THINKS they know it, but they're wrong)
    const hasFalseConfidence =
      isFlawed && pMastered >= FALSE_CONFIDENCE_MASTERY_THRESHOLD;

    const falseConfidenceConcepts = hasFalseConfidence
      ? Array.from(new Set([...state.falseConfidenceConcepts, conceptId]))
      : state.falseConfidenceConcepts.filter((id) => id !== conceptId);

    // Context coherence degrades when a contradiction is detected
    const contextCoherenceScore = isFlawed
      ? Math.max(0, state.contextCoherenceScore - COHERENCE_DECAY_PER_CONTRADICTION)
      : Math.min(1, state.contextCoherenceScore + 0.05);

    return {
      ...state,
      studentBeliefMap: { ...state.studentBeliefMap, [conceptId]: belief },
      falseConfidenceConcepts,
      contextCoherenceScore,
      updatedAt: Date.now(),
    };
  }

  /**
   * Mark a belief as corrected (e.g., after a successful corrective loop).
   */
  static markCorrected(
    state: HighOrderToMState,
    conceptId: string
  ): HighOrderToMState {
    const belief = state.studentBeliefMap[conceptId];
    if (!belief) return state;

    const updatedBelief: NestedBelief = {
      ...belief,
      isFlawed: false,
      correctionProbability: 1,
      observedAt: Date.now(),
    };

    return {
      ...state,
      studentBeliefMap: { ...state.studentBeliefMap, [conceptId]: updatedBelief },
      falseConfidenceConcepts: state.falseConfidenceConcepts.filter((id) => id !== conceptId),
      contextCoherenceScore: Math.min(1, state.contextCoherenceScore + 0.08),
      updatedAt: Date.now(),
    };
  }

  /**
   * Get all concepts where the student has a flawed belief.
   */
  static getFlawedBeliefs(state: HighOrderToMState): NestedBelief[] {
    return Object.values(state.studentBeliefMap).filter((b) => b.isFlawed);
  }

  /**
   * Determine the recommended action based on the belief state.
   * Returns the most urgent pedagogical intervention.
   */
  static recommendIntervention(
    state: HighOrderToMState,
    masteryMap: Record<string, number>
  ): { conceptId: string; action: PedagogicalAction } | null {
    // Priority 1: false confidence (student thinks they know but is wrong)
    if (state.falseConfidenceConcepts.length > 0) {
      const conceptId = state.falseConfidenceConcepts[0];
      const belief = state.studentBeliefMap[conceptId];
      return {
        conceptId,
        action: {
          type: "ask_socratic_question",
          conceptId,
          targetGap: belief?.studentModel ?? "expressed understanding",
          questionText: `Let's test your understanding — ${
            belief?.groundTruth
              ? `what happens when we apply this to a case where ${belief.groundTruth.substring(0, 60)}?`
              : "can you walk me through a concrete example?"
          }`,
        },
      };
    }

    // Priority 2: flawed beliefs needing correction
    const flawed = HighOrderToMTracker.getFlawedBeliefs(state);
    if (flawed.length > 0) {
      const belief = flawed[0];
      const pMastered = masteryMap[belief.conceptId] ?? 0.1;
      if (pMastered < 0.5) {
        return {
          conceptId: belief.conceptId,
          action: {
            type: "provide_correction",
            conceptId: belief.conceptId,
            gapDescription: `Belief: "${belief.studentModel.substring(0, 80)}"`,
            correctionText: belief.groundTruth,
            retryQuestionId: `retry-${belief.conceptId}`,
          },
        };
      }
    }

    return null;
  }

  /**
   * Heuristic check: does the student's expressed model deviate meaningfully
   * from the ground truth?
   *
   * Production: this should be an LLM call. Here: simple keyword mismatch.
   */
  private static detectBeliefFlaw(studentModel: string, groundTruth: string): boolean {
    if (!groundTruth) return false;

    const studentWords = new Set(
      studentModel.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
    );
    const truthWords = groundTruth.toLowerCase().split(/\W+/).filter((w) => w.length > 3);

    if (truthWords.length === 0) return false;

    const overlap = truthWords.filter((w) => studentWords.has(w)).length;
    const overlapRatio = overlap / truthWords.length;

    // Heuristic: less than 20% keyword overlap = likely flawed
    return overlapRatio < 0.20;
  }
}

// ---------------------------------------------------------------------------
// Epistemic State Tracker
// ---------------------------------------------------------------------------

/**
 * EpistemicStateTracker
 *
 * Maps a TomUserProfile (psychological) + mastery probabilities (BKT)
 * into a unified EpistemicState.
 *
 * This is the bridge between OpenHands-style psychological ToM and the
 * educational knowledge tracing (BKT/DKT) layer.
 *
 * Key insight from the problem statement:
 *   "instead of asking 'What is the user's preferred coding style?',
 *    it must ask 'What is the probability the user actually understands
 *    the concept of recursion?'"
 */
export class EpistemicStateTracker {
  /**
   * Build an EpistemicState by fusing psychological ToM data with BKT mastery.
   *
   * @param studentId        Student identifier.
   * @param conceptMasteryMap  BKT mastery probabilities per concept.
   * @param tomProfile       ToM profile (Tier 3).
   */
  static build(
    studentId: string,
    conceptMasteryMap: Record<string, number>,
    tomProfile: TomUserProfile
  ): EpistemicState {
    // Identify concepts that overlap with frustration triggers
    const frustrationConcepts = Object.keys(conceptMasteryMap).filter((conceptId) =>
      tomProfile.frustrationTriggers.some((trigger) =>
        trigger.toLowerCase().includes(conceptId.toLowerCase())
      )
    );

    // Affect-adjusted mastery: reduce mastery estimate for frustrated concepts
    // (frustration impairs retrieval and performance — Hegde & Jayalath 2025)
    const adjustedMasteryMap: Record<string, number> = {};
    for (const [conceptId, pMastered] of Object.entries(conceptMasteryMap)) {
      const isFrustrationTrigger = frustrationConcepts.includes(conceptId);
      adjustedMasteryMap[conceptId] = isFrustrationTrigger
        ? Math.max(0, pMastered * 0.85) // 15% penalty for frustrated concepts
        : pMastered;
    }

    return {
      studentId,
      conceptMasteryMap: { ...conceptMasteryMap },
      adjustedMasteryMap,
      frustrationConcepts,
      updatedAt: Date.now(),
    };
  }

  /**
   * Update epistemic state after a learning event (correct/incorrect quiz answer).
   */
  static updateAfterAttempt(
    state: EpistemicState,
    conceptId: string,
    newPMastered: number,
    isFrustrated: boolean
  ): EpistemicState {
    const adjusted = isFrustrated ? Math.max(0, newPMastered * 0.85) : newPMastered;
    return {
      ...state,
      conceptMasteryMap: { ...state.conceptMasteryMap, [conceptId]: newPMastered },
      adjustedMasteryMap: { ...state.adjustedMasteryMap, [conceptId]: adjusted },
      updatedAt: Date.now(),
    };
  }

  /**
   * Get the weakest concepts (lowest adjusted mastery) — primary targets for
   * the next teaching action.
   */
  static getWeakestConcepts(state: EpistemicState, topN = 3): Array<{ conceptId: string; pMastered: number }> {
    return Object.entries(state.adjustedMasteryMap)
      .sort(([, a], [, b]) => a - b)
      .slice(0, topN)
      .map(([conceptId, pMastered]) => ({ conceptId, pMastered }));
  }
}
