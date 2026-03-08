/**
 * Implicit Knowledge Tracing (IKT)
 * Enables LLMs to trace student knowledge states from natural dialogue
 * without explicit BKT/DKT supervision labels.
 *
 * Research basis:
 *  - Li et al. (2025) "CIKT: A Collaborative and Iterative KT Framework with LLMs"
 *  - Wang et al. (2025) "LLM-KT: Aligning LLMs with KT using Plug-and-Play Instruction"
 *  - Han et al. (2025) "Contrastive Cross-Course KT via Concept Graph (TransKT)"
 *  - Scarlatos et al. (2025) "Exploring KT in Tutor-Student Dialogues using LLMs" (LAK 2025)
 */

import type {
  KnowledgeComponent,
  IKTState,
  DialogueTurnKC,
  KGEdge,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum CIKT refinement iterations before state is considered stable */
const MAX_CIKT_ITERATIONS = 5;

/** Minimum mastery change that justifies a new CIKT iteration */
const CIKT_CONVERGENCE_DELTA = 0.02;

/** Confidence bonus applied when a KC is evidenced explicitly vs. inferred */
const EXPLICIT_EVIDENCE_BONUS = 0.15;

// ---------------------------------------------------------------------------
// CIKTEngine
// ---------------------------------------------------------------------------

/**
 * Implements the Collaborative and Iterative Knowledge Tracing (CIKT) framework.
 * Li et al. (2025): LLMs iteratively refine student state representations —
 * unlike static embeddings, the model "re-thinks" mastery based on new interactions.
 */
export class CIKTEngine {
  /**
   * Create an initial (empty) IKT state for a student.
   */
  static createState(studentId: string): IKTState {
    return {
      studentId,
      knowledgeComponents: new Map(),
      iterationCount: 0,
      stateSummary: "No interactions recorded yet.",
      lastRefined: Date.now(),
    };
  }

  /**
   * Register a known KC into the state with a prior mastery estimate.
   */
  static addKnowledgeComponent(
    state: IKTState,
    kc: KnowledgeComponent
  ): IKTState {
    state.knowledgeComponents.set(kc.id, { ...kc });
    return state;
  }

  /**
   * CIKT iterative refinement: given new evidence (a set of KC observations),
   * update mastery estimates and increment the iteration counter.
   *
   * Each call simulates one "re-think" pass as described in Li et al. (2025).
   *
   * @param state   Current IKT state.
   * @param evidence  Array of (kcId, correct, confidence) observations.
   * @returns Updated IKTState and whether the state converged.
   */
  static refineState(
    state: IKTState,
    evidence: Array<{ kcId: string; correct: boolean; confidence: number }>
  ): { state: IKTState; converged: boolean } {
    let totalDelta = 0;

    for (const obs of evidence) {
      const kc = state.knowledgeComponents.get(obs.kcId);
      if (!kc) continue;

      const prior = kc.masteryEstimate;
      // Bayesian-style update: P(L | correct) higher when confidence is high
      const likelihood = obs.correct
        ? 0.7 + obs.confidence * 0.2
        : 0.3 - obs.confidence * 0.1;
      const updated = (prior * likelihood) / (prior * likelihood + (1 - prior) * (1 - likelihood));
      const delta = Math.abs(updated - prior);
      totalDelta += delta;

      state.knowledgeComponents.set(obs.kcId, { ...kc, masteryEstimate: updated });
    }

    state.iterationCount += 1;
    state.lastRefined = Date.now();

    const converged =
      state.iterationCount >= MAX_CIKT_ITERATIONS || totalDelta < CIKT_CONVERGENCE_DELTA;

    // Update narrative summary
    const masteredCount = [...state.knowledgeComponents.values()].filter(
      (kc) => kc.masteryEstimate >= 0.8
    ).length;
    state.stateSummary = `Iteration ${state.iterationCount}: ${masteredCount}/${state.knowledgeComponents.size} KCs mastered. Δ=${totalDelta.toFixed(3)}.`;

    return { state, converged };
  }

  /**
   * Run the full CIKT refinement loop until convergence or MAX_CIKT_ITERATIONS.
   */
  static runRefinementLoop(
    state: IKTState,
    evidence: Array<{ kcId: string; correct: boolean; confidence: number }>
  ): IKTState {
    let current = state;
    for (let i = 0; i < MAX_CIKT_ITERATIONS; i++) {
      const { state: next, converged } = this.refineState(current, evidence);
      current = next;
      if (converged) break;
    }
    return current;
  }
}

// ---------------------------------------------------------------------------
// LLMKTAligner
// ---------------------------------------------------------------------------

/**
 * LLM-KT "plug-and-play" instruction alignment.
 * Wang et al. (2025): specialist instructions align a general-purpose LLM
 * with KT tasks without expensive retraining.
 */
export class LLMKTAligner {
  /**
   * Generate a plug-and-play KT system prompt for a generalist LLM.
   * This replaces the need to fine-tune the model on KT datasets.
   */
  static generateKTSystemPrompt(studentName: string, conceptLabel: string): string {
    return `You are performing Knowledge Tracing (KT) for ${studentName} on the topic: "${conceptLabel}".

Your goal is NOT to tutor, but to **assess mastery** from the student's responses.

For each student message, output a JSON object:
{
  "kcId": "<knowledge-component-id>",
  "masteryEvidence": "demonstrated" | "partial" | "absent" | "ambiguous",
  "confidence": <0-1>,
  "reasoning": "<brief explanation>"
}

Rules:
- "demonstrated": student explains correctly and completely without prompting.
- "partial": student shows some understanding but misses key aspects.
- "absent": student is clearly wrong or says they do not know.
- "ambiguous": insufficient information to make a determination.
- Be conservative: default to "partial" over "demonstrated" if in doubt.
- Track reasoning gaps as separate KCs (e.g., "can-apply" vs "can-recall").`;
  }

  /**
   * Parse an LLM KT response string into a structured KC observation.
   * Returns null if parsing fails.
   */
  static parseKTResponse(llmResponse: string): {
    kcId: string;
    masteryEvidence: "demonstrated" | "partial" | "absent" | "ambiguous";
    confidence: number;
    reasoning: string;
  } | null {
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        kcId: String(parsed.kcId ?? ""),
        masteryEvidence: parsed.masteryEvidence ?? "ambiguous",
        confidence: Number(parsed.confidence ?? 0.5),
        reasoning: String(parsed.reasoning ?? ""),
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// DialogueKCExtractor
// ---------------------------------------------------------------------------

/**
 * Extracts Knowledge Components from unstructured tutor-student dialogue.
 * Scarlatos et al. (2025): LLMs can identify KCs dynamically from open-ended
 * dialogue, enabling "invisible" assessment during tutoring sessions.
 */
export class DialogueKCExtractor {
  /**
   * Annotate a sequence of student utterances with KC evidence.
   * In production this would call an LLM; here we implement the structural logic.
   */
  static annotateDialogue(
    utterances: string[],
    candidateKCs: KnowledgeComponent[]
  ): DialogueTurnKC[] {
    return utterances.map((utterance, index) => {
      const lower = utterance.toLowerCase();
      const matched: KnowledgeComponent[] = [];
      let masteryEvidence: DialogueTurnKC["masteryEvidence"] = "absent";

      for (const kc of candidateKCs) {
        const kcWords = kc.label.toLowerCase().split(/\s+/);
        const matchCount = kcWords.filter((w) => lower.includes(w)).length;
        if (matchCount > 0) {
          // Estimate mastery from keyword coverage + sentence complexity
          const wordCount = utterance.split(/\s+/).length;
          const coverage = matchCount / kcWords.length;
          const masteryEstimate = Math.min(1, coverage * 0.6 + (wordCount > 15 ? 0.3 : 0) + EXPLICIT_EVIDENCE_BONUS);
          matched.push({ ...kc, masteryEstimate, source: "dialogue_extracted" });
        }
      }

      if (matched.length > 0) {
        const avgMastery = matched.reduce((s, k) => s + k.masteryEstimate, 0) / matched.length;
        if (avgMastery >= 0.8) masteryEvidence = "demonstrated";
        else if (avgMastery >= 0.5) masteryEvidence = "partial";
        else masteryEvidence = "ambiguous";
      }

      return {
        turnIndex: index,
        utterance,
        extractedKCs: matched,
        masteryEvidence,
      };
    });
  }

  /**
   * Aggregate per-turn KC evidence into a consolidated mastery map.
   */
  static aggregateMastery(
    annotatedTurns: DialogueTurnKC[]
  ): Map<string, number> {
    const masteryMap = new Map<string, number>();

    for (const turn of annotatedTurns) {
      for (const kc of turn.extractedKCs) {
        const existing = masteryMap.get(kc.id) ?? 0;
        // Take the max evidence across all turns (optimistic tracing)
        masteryMap.set(kc.id, Math.max(existing, kc.masteryEstimate));
      }
    }
    return masteryMap;
  }
}

// ---------------------------------------------------------------------------
// CrossDomainTransferEngine (TransKT)
// ---------------------------------------------------------------------------

/**
 * TransKT cross-course knowledge transfer.
 * Han et al. (2025): contrastive learning guided by concept graphs allows
 * implicit tracing even in sparse-data scenarios.
 */
export class CrossDomainTransferEngine {
  /**
   * Identify source-domain KCs that semantically relate to a target KC
   * by traversing concept graph edges.
   *
   * @param targetKCId  The KC we want to predict mastery for.
   * @param edges       Concept graph edges (both courses).
   * @param sourceKCMasteries  Known mastery levels from the source domain.
   * @returns Transferred mastery estimate for the target KC.
   */
  static transferMastery(
    targetKCId: string,
    edges: KGEdge[],
    sourceKCMasteries: Map<string, number>
  ): number {
    // Find all nodes connected to targetKCId in the graph
    const connected = edges
      .filter(
        (e) =>
          (e.targetId === targetKCId || e.sourceId === targetKCId) &&
          (e.relationshipType === "related_to" || e.relationshipType === "part_of")
      )
      .map((e) => (e.targetId === targetKCId ? e.sourceId : e.targetId));

    if (connected.length === 0) return 0.5; // prior if no graph evidence

    // Weighted average of connected node mastery
    let weightedSum = 0;
    let totalWeight = 0;
    for (const nodeId of connected) {
      const mastery = sourceKCMasteries.get(nodeId);
      if (mastery !== undefined) {
        const edge = edges.find(
          (e) =>
            (e.sourceId === nodeId && e.targetId === targetKCId) ||
            (e.targetId === nodeId && e.sourceId === targetKCId)
        );
        const weight = edge?.weight ?? 0.5;
        weightedSum += mastery * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }
}
