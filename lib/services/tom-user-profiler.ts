/**
 * ToM User Profiler — Three-Tier Memory Architecture
 *
 * Implements the "perception layer" of OpenHands' ToM-SWE module, adapted from
 * SWE-agent intent-tracking to *pedagogical* psychological profiling.
 *
 * Architecture (stolen from ToM-SWE, rewritten for tutoring):
 *
 *   Tier 1 — Cleaned Sessions
 *     Raw dialogue turns and quiz events, stored as-is.
 *
 *   Tier 2 — Session Analyses
 *     Mid-level extraction: learning intent, friction points, misconception signals,
 *     emotional state, and immediate goals distilled from a single session window.
 *     Equivalent to ToM-SWE "Session Analyses" but driven by pedagogy not code.
 *
 *   Tier 3 — User Profiles
 *     Long-term, LLM-distilled psychological insights: working style, communication
 *     preferences, implicit needs, frustration triggers, and preferred modalities.
 *     Asynchronously updated after each session — never blocks real-time interaction.
 *
 * Reference:
 *   OpenHands TomCodeActAgent / ToM-SWE (github.com/All-Hands-AI/OpenHands)
 *   ProfiLLM implicit profiling pattern (arXiv:2412.xxxxx)
 *   "Theory of Mind in Large Language Models" (arXiv:2302.02083)
 */

// ============================================================================
// TIER 1: CLEANED SESSION DATA TYPES
// ============================================================================

/** A single conversational turn or learning event in a session. */
export type SessionEventType =
  | "student_message"   // free-form text from the learner
  | "tutor_response"    // agent response
  | "quiz_attempt"      // quiz answer submission
  | "concept_visited"   // learner navigated to a concept
  | "hint_requested"    // learner asked for a hint
  | "frustration_signal" // explicit or implicit frustration detected
  | "breakthrough"      // learner expressed understanding
  | "session_start"
  | "session_end";

export interface SessionEvent {
  id: string;
  sessionId: string;
  studentId: string;
  type: SessionEventType;
  timestamp: number;
  content: string;
  /** Optional metadata (concept ID, quiz score, response time, etc.) */
  metadata: Record<string, unknown>;
}

export interface CleanedSession {
  sessionId: string;
  studentId: string;
  startedAt: number;
  endedAt?: number;
  events: SessionEvent[];
  /** Concepts touched in this session. */
  conceptIds: string[];
}

// ============================================================================
// TIER 2: SESSION ANALYSIS TYPES
// ============================================================================

export type FrustrationLevel = "none" | "mild" | "moderate" | "high" | "overwhelmed";
export type EngagementLevel = "disengaged" | "passive" | "active" | "deeply_engaged";

export interface SessionAnalysis {
  sessionId: string;
  studentId: string;
  analysedAt: number;

  /** What the student was trying to accomplish in this session. */
  learningIntent: string;
  /** Concepts where friction / difficulty was observed. */
  frictionPoints: string[];
  /** Misconceptions explicitly or implicitly detected. */
  detectedMisconceptions: string[];
  /** Immediate goal inferred from the session (e.g., "pass recursion quiz"). */
  immediateGoal: string;
  /** Inferred emotional / engagement state. */
  frustrationLevel: FrustrationLevel;
  engagementLevel: EngagementLevel;
  /** Whether the student appeared to reach a moment of understanding. */
  hadBreakthrough: boolean;
  /** Teaching strategies that appeared to *work* in this session. */
  effectiveStrategies: string[];
  /** Teaching strategies that appeared to *fail*. */
  ineffectiveStrategies: string[];
  /** Preferred explanation modality inferred from engagement signals. */
  inferredModality: "visual" | "verbal" | "example-based" | "formal" | "unknown";
  /** Preferred communication pace ("slow" = student needed re-explains). */
  inferredPace: "slow" | "moderate" | "fast";
  /** Summary sentence for long-term profile update. */
  summaryForProfile: string;
}

// ============================================================================
// TIER 3: USER PROFILE TYPES
// ============================================================================

export type CommunicationStyle = "encouraging" | "neutral" | "formal" | "socratic" | "direct";
export type WorkingStyle = "exploratory" | "systematic" | "goal-driven" | "collaborative";

export interface UserProfile {
  studentId: string;
  createdAt: number;
  updatedAt: number;
  /** Version counter — incremented every time LLM rewrites the profile. */
  version: number;

  // ── Psychological dimensions ──────────────────────────────────────────────
  /** Preferred explanation depth (1=very simple, 10=expert technical). */
  depthPreference: number;
  /** Preferred communication style with the tutor agent. */
  communicationStyle: CommunicationStyle;
  /** Working style when attacking new problems. */
  workingStyle: WorkingStyle;
  /** Preferred content modality for new concepts. */
  preferredModality: "visual" | "verbal" | "example-based" | "formal" | "mixed";
  /** Preferred learning pace. */
  preferredPace: "slow" | "moderate" | "fast";

  // ── Motivational dimensions ───────────────────────────────────────────────
  /** 0–100: current overall motivation level (decays, refreshed by achievements). */
  motivationLevel: number;
  /** Typical frustration triggers observed across sessions. */
  frustrationTriggers: string[];
  /** What re-engages the student when disengaged. */
  reengagementStrategies: string[];

  // ── Cognitive dimensions ──────────────────────────────────────────────────
  /** Concepts the student has incorrectly thought they mastered. */
  falselyMasteredConcepts: string[];
  /** Persistent misconceptions that resurface across sessions. */
  persistentMisconceptions: Record<string, string>; // conceptId → misconception text
  /** Topics where analogies were particularly effective. */
  analogyResonanceTopics: string[];

  // ── Session statistics ────────────────────────────────────────────────────
  totalSessions: number;
  totalStudyMinutes: number;
  averageFrustrationLevel: FrustrationLevel;
  averageEngagementLevel: EngagementLevel;

  // ── LLM-distilled narrative ───────────────────────────────────────────────
  /** 2–3 sentence psychological summary generated asynchronously by an LLM. */
  psychologicalSummary: string;
  /** Concrete instructions the tutoring agent should follow for this student. */
  agentInstructions: string[];
}

// ============================================================================
// TIER 1: SESSION STORE
// ============================================================================

export class SessionStore {
  private sessions: Map<string, CleanedSession> = new Map();

  /** Start a new session for a student. */
  startSession(studentId: string): CleanedSession {
    const session: CleanedSession = {
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      studentId,
      startedAt: Date.now(),
      events: [],
      conceptIds: [],
    };
    this.sessions.set(session.sessionId, session);
    this.addEvent(session.sessionId, "session_start", "", {});
    return session;
  }

  /** Record a new event in a session. */
  addEvent(
    sessionId: string,
    type: SessionEventType,
    content: string,
    metadata: Record<string, unknown> = {}
  ): SessionEvent | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const event: SessionEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
      studentId: session.studentId,
      type,
      timestamp: Date.now(),
      content,
      metadata,
    };

    session.events.push(event);

    // Track concepts visited
    if (metadata["conceptId"] && typeof metadata["conceptId"] === "string") {
      if (!session.conceptIds.includes(metadata["conceptId"])) {
        session.conceptIds.push(metadata["conceptId"]);
      }
    }

    return event;
  }

  /** End a session. */
  endSession(sessionId: string): CleanedSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.endedAt = Date.now();
    this.addEvent(sessionId, "session_end", "", {});
    return session;
  }

  /** Get all sessions for a student, sorted by recency (insertion order as tiebreaker). */
  getStudentSessions(studentId: string): CleanedSession[] {
    const all = [...this.sessions.values()].filter((s) => s.studentId === studentId);
    // Stable sort: primary key = startedAt desc, secondary = insertion order desc
    return all.reverse().sort((a, b) => b.startedAt - a.startedAt);
  }

  getSession(sessionId: string): CleanedSession | undefined {
    return this.sessions.get(sessionId);
  }
}

// ============================================================================
// TIER 2: SESSION ANALYSER
// ============================================================================

/**
 * Distils a single `CleanedSession` into a `SessionAnalysis`.
 *
 * In production this method would call an LLM with the raw session transcript;
 * here we implement a rule-based heuristic that can be transparently unit-tested
 * and replaced with an async LLM call when an API key is available.
 */
export class SessionAnalyser {
  analyse(session: CleanedSession): SessionAnalysis {
    const events = session.events;

    // ── Detect friction ─────────────────────────────────────────────────────
    const hintEvents = events.filter((e) => e.type === "hint_requested").length;
    const frustrationEvents = events.filter((e) => e.type === "frustration_signal").length;
    const breakthroughEvents = events.filter((e) => e.type === "breakthrough");

    // ── Quiz performance ────────────────────────────────────────────────────
    const quizEvents = events.filter((e) => e.type === "quiz_attempt");
    const correctAnswers = quizEvents.filter((e) => e.metadata["correct"] === true).length;
    const quizAccuracy =
      quizEvents.length > 0 ? correctAnswers / quizEvents.length : 0.5;

    // ── Frustration level ───────────────────────────────────────────────────
    let frustrationLevel: FrustrationLevel = "none";
    if (frustrationEvents > 4 || hintEvents > 5) frustrationLevel = "overwhelmed";
    else if (frustrationEvents > 2 || hintEvents > 3) frustrationLevel = "high";
    else if (frustrationEvents > 0 || hintEvents > 1) frustrationLevel = "moderate";
    else if (hintEvents === 1) frustrationLevel = "mild";

    // ── Engagement level ────────────────────────────────────────────────────
    const studentMessages = events.filter((e) => e.type === "student_message");
    const avgMessageLength =
      studentMessages.reduce((s, e) => s + e.content.length, 0) /
      Math.max(1, studentMessages.length);
    let engagementLevel: EngagementLevel = "passive";
    if (avgMessageLength > 200 || quizEvents.length > 5) engagementLevel = "deeply_engaged";
    else if (avgMessageLength > 80) engagementLevel = "active";
    else if (studentMessages.length < 2) engagementLevel = "disengaged";

    // ── Misconceptions ──────────────────────────────────────────────────────
    const detectedMisconceptions: string[] = events
      .filter((e) => e.metadata["misconception"] && typeof e.metadata["misconception"] === "string")
      .map((e) => e.metadata["misconception"] as string);

    // ── Effective strategies ────────────────────────────────────────────────
    const effectiveStrategies: string[] = [];
    const ineffectiveStrategies: string[] = [];
    if (breakthroughEvents.length > 0) {
      // Look for the preceding tutor response to infer what worked
      breakthroughEvents.forEach((bt) => {
        const idx = events.indexOf(bt);
        const prev = events[idx - 1];
        if (prev?.type === "tutor_response" && prev.metadata["strategy"]) {
          effectiveStrategies.push(prev.metadata["strategy"] as string);
        }
      });
    }
    if (quizAccuracy < 0.4 && hintEvents > 2) {
      ineffectiveStrategies.push("direct_explanation");
    }

    // ── Modality preference ─────────────────────────────────────────────────
    const modalities = events
      .filter((e) => e.metadata["modality"])
      .map((e) => e.metadata["modality"] as string);
    const mostFrequentModality =
      modalities.length > 0
        ? (Object.entries(
            modalities.reduce<Record<string, number>>((acc, m) => {
              acc[m] = (acc[m] ?? 0) + 1;
              return acc;
            }, {})
          ).sort(([, a], [, b]) => b - a)[0]?.[0] as SessionAnalysis["inferredModality"]) ??
          "unknown"
        : "unknown";

    // ── Friction points ─────────────────────────────────────────────────────
    // Concepts where quiz accuracy for that specific concept was below 50%
    const frictionPoints = session.conceptIds.filter((conceptId) => {
      const conceptQuizzes = quizEvents.filter(
        (e) => e.metadata["conceptId"] === conceptId
      );
      if (conceptQuizzes.length === 0) return false;
      const cAccuracy =
        conceptQuizzes.filter((e) => e.metadata["correct"]).length / conceptQuizzes.length;
      return cAccuracy < 0.5;
    });

    const summaryForProfile =
      `Session ${session.sessionId}: frustration=${frustrationLevel}, engagement=${engagementLevel}, ` +
      `quiz accuracy=${Math.round(quizAccuracy * 100)}%, hints=${hintEvents}, breakthroughs=${breakthroughEvents.length}. ` +
      `Friction on: ${frictionPoints.join(", ") || "none"}.`;

    return {
      sessionId: session.sessionId,
      studentId: session.studentId,
      analysedAt: Date.now(),
      learningIntent: this.inferLearningIntent(events),
      frictionPoints,
      detectedMisconceptions,
      immediateGoal: this.inferImmediateGoal(events, session.conceptIds),
      frustrationLevel,
      engagementLevel,
      hadBreakthrough: breakthroughEvents.length > 0,
      effectiveStrategies,
      ineffectiveStrategies,
      inferredModality: mostFrequentModality,
      inferredPace: hintEvents > 2 || quizAccuracy < 0.4 ? "slow" : quizAccuracy > 0.8 ? "fast" : "moderate",
      summaryForProfile,
    };
  }

  private inferLearningIntent(events: SessionEvent[]): string {
    const firstStudentMsg = events.find((e) => e.type === "student_message");
    if (firstStudentMsg?.content) {
      return firstStudentMsg.content.slice(0, 120);
    }
    const visitedConcepts = events
      .filter((e) => e.type === "concept_visited")
      .map((e) => e.metadata["conceptName"] ?? e.metadata["conceptId"] ?? "unknown")
      .slice(0, 3)
      .join(", ");
    return visitedConcepts ? `Studied: ${visitedConcepts}` : "General learning session";
  }

  private inferImmediateGoal(events: SessionEvent[], conceptIds: string[]): string {
    if (conceptIds.length > 0) {
      return `Master ${conceptIds.slice(0, 2).join(" and ")}`;
    }
    const quizEvents = events.filter((e) => e.type === "quiz_attempt");
    if (quizEvents.length > 0) {
      const conceptId = quizEvents[0]?.metadata["conceptId"];
      return conceptId ? `Pass quiz on ${conceptId}` : "Complete quiz session";
    }
    return "Continue learning";
  }
}

// ============================================================================
// TIER 3: PROFILE MANAGER
// ============================================================================

/**
 * Asynchronously maintains and updates the long-term `UserProfile` by
 * distilling a stream of `SessionAnalysis` objects into psychological insights.
 *
 * Design principles (from ToM-SWE):
 *  - Never blocks the live tutoring session (async update, fire-and-forget).
 *  - Rewrites the profile periodically via LLM (mocked here), not by appending.
 *  - Generates concrete `agentInstructions` the tutoring agent can consume.
 */
export class ProfileManager {
  private profiles: Map<string, UserProfile> = new Map();
  private analyses: Map<string, SessionAnalysis[]> = new Map(); // studentId → analyses

  /** Store a new session analysis for a student. */
  recordAnalysis(analysis: SessionAnalysis): void {
    const list = this.analyses.get(analysis.studentId) ?? [];
    list.push(analysis);
    // Keep only the last 20 session analyses to control context size
    if (list.length > 20) list.shift();
    this.analyses.set(analysis.studentId, list);
  }

  /**
   * Update the user profile asynchronously.
   * Call this after a session ends — it should NOT block the tutoring loop.
   * In production: call an LLM with the full analysis history.
   */
  async updateProfile(studentId: string): Promise<UserProfile> {
    const analyses = this.analyses.get(studentId) ?? [];
    const existing = this.profiles.get(studentId);

    const profile = this.distilProfile(studentId, analyses, existing);
    this.profiles.set(studentId, profile);
    return profile;
  }

  /** Get the current profile (may be slightly stale — that's intentional). */
  getProfile(studentId: string): UserProfile | undefined {
    return this.profiles.get(studentId);
  }

  /** Get or initialise a profile (returns a sensible default if none exists yet). */
  getOrInitProfile(studentId: string): UserProfile {
    return this.profiles.get(studentId) ?? this.createDefaultProfile(studentId);
  }

  /**
   * Distil accumulated session analyses into an updated `UserProfile`.
   * In production this calls an LLM; here it uses deterministic aggregation.
   */
  private distilProfile(
    studentId: string,
    analyses: SessionAnalysis[],
    existing: UserProfile | undefined
  ): UserProfile {
    if (analyses.length === 0) {
      return existing ?? this.createDefaultProfile(studentId);
    }

    // ── Aggregate frustration ─────────────────────────────────────────────
    const frustrationScores: Record<FrustrationLevel, number> = {
      none: 0, mild: 1, moderate: 2, high: 3, overwhelmed: 4,
    };
    const avgFrustration =
      analyses.reduce((s, a) => s + frustrationScores[a.frustrationLevel], 0) / analyses.length;
    const avgFrustrationLevel: FrustrationLevel =
      avgFrustration < 0.5 ? "none" :
      avgFrustration < 1.5 ? "mild" :
      avgFrustration < 2.5 ? "moderate" :
      avgFrustration < 3.5 ? "high" : "overwhelmed";

    // ── Aggregate engagement ───────────────────────────────────────────────
    const engagementScores: Record<EngagementLevel, number> = {
      disengaged: 0, passive: 1, active: 2, deeply_engaged: 3,
    };
    const avgEngagement =
      analyses.reduce((s, a) => s + engagementScores[a.engagementLevel], 0) / analyses.length;
    const avgEngagementLevel: EngagementLevel =
      avgEngagement < 0.5 ? "disengaged" :
      avgEngagement < 1.5 ? "passive" :
      avgEngagement < 2.5 ? "active" : "deeply_engaged";

    // ── Effective strategies (deduplicated) ────────────────────────────────
    const allEffective = [...new Set(analyses.flatMap((a) => a.effectiveStrategies))];
    const allIneffective = [...new Set(analyses.flatMap((a) => a.ineffectiveStrategies))];

    // ── Persistent misconceptions ─────────────────────────────────────────
    const misconceptionFrequency: Record<string, number> = {};
    for (const a of analyses) {
      for (const m of a.detectedMisconceptions) {
        misconceptionFrequency[m] = (misconceptionFrequency[m] ?? 0) + 1;
      }
    }
    const persistentMisconceptions: Record<string, string> = {};
    for (const [m, count] of Object.entries(misconceptionFrequency)) {
      if (count >= 2) persistentMisconceptions[m] = m; // conceptId → description
    }

    // ── Preferred modality ─────────────────────────────────────────────────
    const modalityCounts: Record<string, number> = {};
    for (const a of analyses) {
      if (a.inferredModality !== "unknown") {
        modalityCounts[a.inferredModality] = (modalityCounts[a.inferredModality] ?? 0) + 1;
      }
    }
    const modalityEntries = Object.entries(modalityCounts).sort(([, a], [, b]) => b - a);
    const topModality = modalityEntries[0]?.[0] as UserProfile["preferredModality"] | undefined;
    const dominantModality: UserProfile["preferredModality"] =
      topModality ?? existing?.preferredModality ?? "mixed";

    // ── Preferred pace ─────────────────────────────────────────────────────
    const paceCounts: Record<string, number> = { slow: 0, moderate: 0, fast: 0 };
    for (const a of analyses) paceCounts[a.inferredPace]++;
    const dominantPace = Object.entries(paceCounts).sort(([, a], [, b]) => b - a)[0]?.[0] as UserProfile["preferredPace"] ?? "moderate";

    // ── Agent instructions (the actionable outputs consumed by the agent) ──
    const agentInstructions: string[] = [];
    if (avgFrustrationLevel === "high" || avgFrustrationLevel === "overwhelmed") {
      agentInstructions.push("Use shorter explanations and more frequent check-ins.");
      agentInstructions.push("Offer analogies and visual metaphors before formal definitions.");
    }
    if (allEffective.includes("socratic_questioning")) {
      agentInstructions.push("Prefer Socratic questioning over direct explanations.");
    }
    if (allIneffective.includes("direct_explanation")) {
      agentInstructions.push("Avoid long direct explanations — use examples and guided discovery instead.");
    }
    if (Object.keys(persistentMisconceptions).length > 0) {
      agentInstructions.push(
        `Address persistent misconceptions early in each session: ${Object.keys(persistentMisconceptions).slice(0, 2).join(", ")}.`
      );
    }
    if (avgEngagementLevel === "disengaged" || avgEngagementLevel === "passive") {
      agentInstructions.push("Open each session with a compelling real-world hook to re-engage.");
    }

    // ── Depth preference ───────────────────────────────────────────────────
    // Infer from engagement: deeply engaged students can handle more depth
    const depthBase = existing?.depthPreference ?? 5;
    const engagementAdjust = avgEngagement > 2 ? 1 : avgEngagement < 1 ? -1 : 0;
    const depthPreference = Math.max(1, Math.min(10, depthBase + engagementAdjust));

    // ── Psychological summary (in production: LLM call) ───────────────────
    const recentAnalysisSummaries = analyses
      .slice(-3)
      .map((a) => a.summaryForProfile)
      .join(" ");
    const psychologicalSummary =
      `Student shows ${avgEngagementLevel} engagement and ${avgFrustrationLevel} frustration. ` +
      `Responds well to ${dominantModality} content at ${dominantPace} pace. ` +
      (Object.keys(persistentMisconceptions).length > 0
        ? `Persistent misconceptions detected in: ${Object.keys(persistentMisconceptions).slice(0, 2).join(", ")}.`
        : "No persistent misconceptions flagged.");

    return {
      studentId,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      version: (existing?.version ?? 0) + 1,
      depthPreference,
      communicationStyle: avgFrustrationLevel === "overwhelmed" ? "encouraging" : (existing?.communicationStyle ?? "neutral"),
      workingStyle: existing?.workingStyle ?? "exploratory",
      preferredModality: dominantModality,
      preferredPace: dominantPace,
      motivationLevel: Math.max(10, Math.min(100,
        (existing?.motivationLevel ?? 70) + (avgEngagement > 2 ? 5 : avgEngagement < 1 ? -5 : 0)
      )),
      frustrationTriggers: [...new Set([
        ...(existing?.frustrationTriggers ?? []),
        ...analyses.filter((a) => a.frustrationLevel === "high").flatMap((a) => a.frictionPoints),
      ])].slice(0, 10),
      reengagementStrategies: allEffective.filter((s) => !allIneffective.includes(s)),
      falselyMasteredConcepts: existing?.falselyMasteredConcepts ?? [],
      persistentMisconceptions,
      analogyResonanceTopics: existing?.analogyResonanceTopics ?? [],
      totalSessions: (existing?.totalSessions ?? 0) + 1,
      totalStudyMinutes: existing?.totalStudyMinutes ?? 0,
      averageFrustrationLevel: avgFrustrationLevel,
      averageEngagementLevel: avgEngagementLevel,
      psychologicalSummary,
      agentInstructions,
    };
  }

  private createDefaultProfile(studentId: string): UserProfile {
    return {
      studentId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 0,
      depthPreference: 5,
      communicationStyle: "encouraging",
      workingStyle: "exploratory",
      preferredModality: "mixed",
      preferredPace: "moderate",
      motivationLevel: 70,
      frustrationTriggers: [],
      reengagementStrategies: [],
      falselyMasteredConcepts: [],
      persistentMisconceptions: {},
      analogyResonanceTopics: [],
      totalSessions: 0,
      totalStudyMinutes: 0,
      averageFrustrationLevel: "none",
      averageEngagementLevel: "passive",
      psychologicalSummary: "No sessions recorded yet. Using default profile.",
      agentInstructions: [
        "Start with a simple, encouraging explanation to calibrate student level.",
        "Ask one clarifying question after each explanation.",
      ],
    };
  }
}

// Singleton instances
export const sessionStore = new SessionStore();
export const sessionAnalyser = new SessionAnalyser();
export const profileManager = new ProfileManager();
