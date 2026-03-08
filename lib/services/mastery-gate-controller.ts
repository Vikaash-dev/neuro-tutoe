/**
 * Mastery Gate Controller
 *
 * Implements Bloom's (1984) Mastery Learning gates within an LLM-tutoring context.
 * Students must achieve ≥85% mastery probability (Wilson et al. 2019 — the 85%-Rule)
 * before advancing to the next concept in the prerequisite chain.
 *
 * Research basis:
 *   - Bloom, B.S. (1984). "The 2 Sigma Problem." Educational Researcher.
 *     Mastery Learning: students advance only after demonstrating 80–90% competence.
 *   - Wilson et al. (2019). "Humans learn better at 85% challenge rate."
 *     Nature Human Behaviour — optimal challenge zone for neuroplasticity.
 *   - Vygotsky (1978). Zone of Proximal Development (ZPD) — advance into the
 *     next achievable difficulty band, not beyond.
 *   - Sarkar (2025). "Evolution of Mastery Learning + DARTS ITS." IIS 26(4).
 *   - SP-TeachLLM (2025). Multi-module LLM tutoring framework. MDPI Information.
 *   - Corrective loop: Bloom's original corrective feedback model.
 *
 * Architecture:
 *   MasteryGateController  — checks/updates gates, records corrective loops
 *   CorrectiveLoopManager  — creates and resolves targeted correction cycles
 *   LearningPathAdvancer   — determines when and which concept to advance to
 *   ZPDCalculator          — computes the Zone of Proximal Development band
 */

import {
  CorrectiveLoopEntry,
  LearningPathAdvancement,
  MasteryGate,
  MasteryGateStatus,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants (Bloom + Wilson)
// ---------------------------------------------------------------------------

/** Bloom (1984) mastery gate threshold: advance only when p_mastered ≥ this. */
export const MASTERY_THRESHOLD = 0.85;

/** Wilson et al. (2019) 85%-Rule: optimal accuracy band [0.60, 0.95]. */
export const OPTIMAL_ACCURACY_MIN = 0.60;
export const OPTIMAL_ACCURACY_MAX = 0.95;

/**
 * Minimum attempts before a gate status can transition to "mastered".
 * Prevents premature advancement from a single lucky correct answer.
 */
export const MIN_ATTEMPTS_FOR_MASTERY = 3;

/** Cold-start mastery probability (new concepts). */
export const COLD_START_P_MASTERED = 0.10;

// ---------------------------------------------------------------------------
// Mastery Gate Controller
// ---------------------------------------------------------------------------

/**
 * MasteryGateController
 *
 * Creates and updates MasteryGate records, applies Bloom's corrective loop,
 * and enforces prerequisite chains before unlocking a concept.
 */
export class MasteryGateController {
  /**
   * Create a new MasteryGate for a concept.
   *
   * @param conceptId          Unique ID of the concept.
   * @param prerequisiteIds    IDs of concepts that must be mastered first.
   * @param masteredConceptIds Set of already-mastered concept IDs.
   */
  static createGate(
    conceptId: string,
    prerequisiteIds: string[],
    masteredConceptIds: Set<string>
  ): MasteryGate {
    const unmetPrerequisites = prerequisiteIds.filter(
      (id) => !masteredConceptIds.has(id)
    );
    const prerequisitesMet = unmetPrerequisites.length === 0;
    const status: MasteryGateStatus = prerequisitesMet ? "available" : "locked";

    return {
      conceptId,
      status,
      pMastered: COLD_START_P_MASTERED,
      correctAttempts: 0,
      totalAttempts: 0,
      accuracyRate: 0,
      gatePassed: false,
      prerequisitesMet,
      unmetPrerequisites,
      lastAttemptAt: 0,
    };
  }

  /**
   * Record a quiz/Feynman attempt and update the gate.
   *
   * @param gate         Current gate state.
   * @param correct      Whether the attempt was correct.
   * @param pMasteredNew Updated BKT/IKT posterior mastery probability.
   */
  static recordAttempt(
    gate: MasteryGate,
    correct: boolean,
    pMasteredNew: number
  ): MasteryGate {
    const correctAttempts = gate.correctAttempts + (correct ? 1 : 0);
    const totalAttempts = gate.totalAttempts + 1;
    const accuracyRate = correctAttempts / totalAttempts;
    const pMastered = Math.max(0, Math.min(1, pMasteredNew));

    const gatePassed =
      gate.prerequisitesMet &&
      pMastered >= MASTERY_THRESHOLD &&
      totalAttempts >= MIN_ATTEMPTS_FOR_MASTERY;

    let status: MasteryGateStatus;
    if (!gate.prerequisitesMet) {
      status = "locked";
    } else if (gatePassed) {
      status = "mastered";
    } else {
      status = "in_progress";
    }

    return {
      ...gate,
      pMastered,
      correctAttempts,
      totalAttempts,
      accuracyRate,
      gatePassed,
      status,
      lastAttemptAt: Date.now(),
      masteredAt: gatePassed && !gate.gatePassed ? Date.now() : gate.masteredAt,
    };
  }

  /**
   * Update the prerequisite status of a gate (e.g. after another concept is mastered).
   */
  static updatePrerequisites(
    gate: MasteryGate,
    masteredConceptIds: Set<string>
  ): MasteryGate {
    const unmetPrerequisites = gate.unmetPrerequisites.filter(
      (id) => !masteredConceptIds.has(id)
    );
    const prerequisitesMet = unmetPrerequisites.length === 0;

    // Unlock if prerequisites are now met and concept hasn't been started
    const status: MasteryGateStatus =
      prerequisitesMet && gate.status === "locked" ? "available" : gate.status;

    return { ...gate, prerequisitesMet, unmetPrerequisites, status };
  }

  /**
   * Determine whether the student is in the optimal challenge zone
   * for this concept (Wilson et al. 2019 — 85%-Rule).
   */
  static isInOptimalZone(gate: MasteryGate): boolean {
    if (gate.totalAttempts === 0) return true; // no data yet — assume OK
    return (
      gate.accuracyRate >= OPTIMAL_ACCURACY_MIN &&
      gate.accuracyRate <= OPTIMAL_ACCURACY_MAX
    );
  }

  /**
   * Determine whether the student needs remediation (accuracy < 60%).
   */
  static needsRemediation(gate: MasteryGate): boolean {
    return gate.totalAttempts >= MIN_ATTEMPTS_FOR_MASTERY &&
      gate.accuracyRate < OPTIMAL_ACCURACY_MIN;
  }

  /**
   * Build a summary of all gates including which are unlocked, in progress,
   * and mastered — useful for the learning path / knowledge graph UI.
   */
  static summarise(gates: Map<string, MasteryGate>): {
    locked: string[];
    available: string[];
    inProgress: string[];
    mastered: string[];
    needsReview: string[];
  } {
    const result = {
      locked: [] as string[],
      available: [] as string[],
      inProgress: [] as string[],
      mastered: [] as string[],
      needsReview: [] as string[],
    };
    for (const [id, gate] of gates) {
      result[camelStatus(gate.status)].push(id);
    }
    return result;
  }
}

function camelStatus(s: MasteryGateStatus): keyof ReturnType<typeof MasteryGateController.summarise> {
  switch (s) {
    case "locked":       return "locked";
    case "available":    return "available";
    case "in_progress":  return "inProgress";
    case "mastered":     return "mastered";
    case "needs_review": return "needsReview";
  }
}

// ---------------------------------------------------------------------------
// Corrective Loop Manager
// ---------------------------------------------------------------------------

/**
 * CorrectiveLoopManager
 *
 * When a student answers incorrectly, creates a targeted corrective loop:
 *   wrong answer → identify gap → provide correction → serve variant question
 *
 * This is Bloom's original corrective feedback model, adapted for LLM tutoring.
 */
export class CorrectiveLoopManager {
  private loops: Map<string, CorrectiveLoopEntry[]> = new Map();

  /**
   * Open a new corrective loop after a wrong answer.
   *
   * @param conceptId         Concept where the error occurred.
   * @param gapDescription    The specific knowledge gap that was identified.
   * @param correctionText    The targeted re-explanation to provide.
   * @param retryQuestionId   ID of a variant question to serve after correction.
   */
  openLoop(
    conceptId: string,
    gapDescription: string,
    correctionText: string,
    retryQuestionId: string
  ): CorrectiveLoopEntry {
    const entry: CorrectiveLoopEntry = {
      conceptId,
      wrongAnswerAt: Date.now(),
      gapDescription,
      correctionProvided: correctionText,
      retryQuestionId,
      resolved: false,
    };

    const entries = this.loops.get(conceptId) ?? [];
    entries.push(entry);
    this.loops.set(conceptId, entries);

    return entry;
  }

  /**
   * Mark the most recent open corrective loop for a concept as resolved
   * (student answered the retry question correctly).
   */
  resolveLoop(conceptId: string): CorrectiveLoopEntry | null {
    const entries = this.loops.get(conceptId);
    if (!entries) return null;

    const open = entries.findLast((e) => !e.resolved);
    if (!open) return null;

    open.resolved = true;
    return open;
  }

  /**
   * Return all unresolved corrective loops for a concept.
   * If there are active loops, the tutor should present the corrective
   * explanation before moving on.
   */
  getActiveLoops(conceptId: string): CorrectiveLoopEntry[] {
    return (this.loops.get(conceptId) ?? []).filter((e) => !e.resolved);
  }

  /** True if there are unresolved corrective loops that need attention. */
  hasActiveLoops(conceptId: string): boolean {
    return this.getActiveLoops(conceptId).length > 0;
  }

  /**
   * Generate a corrective explanation text for a given gap.
   * In production, this should call the LLM; here it returns a structured
   * template that can be injected into the system prompt.
   */
  static buildCorrectionPrompt(
    conceptId: string,
    gapDescription: string,
    studentDepth: number
  ): string {
    return [
      `The student just answered incorrectly on concept "${conceptId}".`,
      `Identified knowledge gap: ${gapDescription}`,
      `Depth level: ${studentDepth}/10.`,
      "",
      "Provide a targeted, focused re-explanation that:",
      "1. Directly addresses only the identified gap (not the whole concept).",
      "2. Uses a different approach or analogy from the previous explanation.",
      `3. Is calibrated to depth ${studentDepth}/10 — ${studentDepth <= 4 ? "use concrete everyday examples" : "use appropriate technical precision"}.`,
      "4. Ends with: 'Does that make more sense? Try this question again:'",
    ].join("\n");
  }
}

// ---------------------------------------------------------------------------
// Learning Path Advancer
// ---------------------------------------------------------------------------

/**
 * LearningPathAdvancer
 *
 * Determines the next concept to advance to after a mastery gate is passed.
 * Uses topological ordering of the prerequisite graph (Bloom sequencing).
 */
export class LearningPathAdvancer {
  /**
   * Get the list of concepts that become unlocked when `masteredConceptId` is mastered.
   *
   * @param masteredConceptId     The concept just mastered.
   * @param prerequisiteGraph     Map<conceptId, prerequisiteIds[]>
   * @param gates                 Current gate map.
   */
  static getUnlockedBy(
    masteredConceptId: string,
    prerequisiteGraph: Map<string, string[]>,
    gates: Map<string, MasteryGate>
  ): string[] {
    const unlocked: string[] = [];
    for (const [conceptId, prereqs] of prerequisiteGraph) {
      if (!prereqs.includes(masteredConceptId)) continue;
      const gate = gates.get(conceptId);
      if (!gate || gate.status !== "locked") continue;
      // Check if ALL prerequisites are now mastered
      const allMet = prereqs.every((p) => {
        if (p === masteredConceptId) return true;
        return gates.get(p)?.status === "mastered";
      });
      if (allMet) unlocked.push(conceptId);
    }
    return unlocked;
  }

  /**
   * Record a learning path advancement event.
   */
  static recordAdvancement(
    fromConceptId: string,
    toConceptId: string,
    pMastered: number,
    reason: LearningPathAdvancement["triggerReason"] = "mastery_gate_passed"
  ): LearningPathAdvancement {
    return {
      fromConceptId,
      toConceptId,
      advancedAt: Date.now(),
      triggerReason: reason,
      masteryAtAdvancement: pMastered,
    };
  }

  /**
   * Topological sort of concepts based on the prerequisite graph.
   * Returns an ordered array of concept IDs (most foundational first).
   */
  static topologicalOrder(
    conceptIds: string[],
    prerequisiteGraph: Map<string, string[]>
  ): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (id: string, stack: Set<string>): void => {
      if (stack.has(id)) return; // cycle detection — skip
      if (visited.has(id)) return;
      stack.add(id);
      const prereqs = prerequisiteGraph.get(id) ?? [];
      for (const prereq of prereqs) {
        visit(prereq, new Set(stack));
      }
      visited.add(id);
      result.push(id);
    };

    for (const id of conceptIds) {
      visit(id, new Set());
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// ZPD Calculator (Vygotsky 1978)
// ---------------------------------------------------------------------------

/**
 * ZPDCalculator
 *
 * Calculates the Zone of Proximal Development band for a student.
 *
 * ZPD = the space between:
 *   - "independent performance" (already mastered, pMastered ≥ MASTERY_THRESHOLD)
 *   - "beyond reach" (pMastered < COLD_START_P_MASTERED after exposure)
 * The ZPD band contains concepts where pMastered is in [0.30, MASTERY_THRESHOLD).
 */
export class ZPDCalculator {
  /** True if the concept is within the student's ZPD. */
  static isInZPD(pMastered: number): boolean {
    return pMastered >= 0.30 && pMastered < MASTERY_THRESHOLD;
  }

  /** True if the concept is already mastered (above ZPD). */
  static isMastered(pMastered: number): boolean {
    return pMastered >= MASTERY_THRESHOLD;
  }

  /** True if the concept is too far beyond current knowledge (below ZPD). */
  static isOutOfReach(pMastered: number, totalAttempts: number): boolean {
    return pMastered < 0.30 && totalAttempts >= MIN_ATTEMPTS_FOR_MASTERY;
  }

  /**
   * Given a set of concept mastery probabilities, return the subset
   * that lies within the ZPD — these are the best candidates for the
   * next learning session.
   */
  static filterZPDConcepts(
    masteryMap: Map<string, number>
  ): Map<string, number> {
    const zpd = new Map<string, number>();
    for (const [id, p] of masteryMap) {
      if (ZPDCalculator.isInZPD(p)) zpd.set(id, p);
    }
    return zpd;
  }

  /**
   * Recommend the single best concept for the next session.
   * Picks the ZPD concept with the highest mastery (closest to the gate).
   * Falls back to the least-mastered available concept if ZPD is empty.
   */
  static recommendNextConcept(
    masteryMap: Map<string, number>,
    availableConceptIds: string[]
  ): string | null {
    const available = new Map(
      availableConceptIds
        .filter((id) => masteryMap.has(id))
        .map((id) => [id, masteryMap.get(id)!])
    );

    const zpdConcepts = ZPDCalculator.filterZPDConcepts(available);
    if (zpdConcepts.size > 0) {
      // Highest mastery in ZPD → closest to gate
      return [...zpdConcepts.entries()].sort(([, a], [, b]) => b - a)[0][0];
    }

    // Fallback: lowest mastery among available (most needs attention)
    if (available.size > 0) {
      return [...available.entries()].sort(([, a], [, b]) => a - b)[0][0];
    }

    return null;
  }
}
