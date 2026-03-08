/**
 * Cognitive Load Manager
 * Implements Cognitive Load Theory (CLT) as a real-time regulator for LLM-based tutoring.
 *
 * Research basis:
 *  - Delikoura et al. (2025) "From Superficial Outputs to Superficial Learning"
 *  - Wang et al. (2025) "Beyond Accuracy: A Cognitive Load Framework for Tool-use Agents"
 *  - Adapala (2025) "Cognitive Load Limits in Large Language Models"
 *  - Huang et al. (2025) / Mei et al. (2025) "A Survey of Context Engineering for LLMs"
 *  - Miller (1956) "The Magical Number Seven, Plus or Minus Two"
 */

import type {
  CognitiveLoadState,
  WorkingMemoryChunk,
  ContextSaturationMetrics,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Miller's Law: working memory span (items per chunk) */
const WORKING_MEMORY_SPAN = { min: 5, max: 9, optimal: 7 } as const;

/** Maximum safe total cognitive load before content should be simplified */
const MAX_SAFE_TOTAL_LOAD = 70;

/** Weight distribution across the three CLT components */
const LOAD_WEIGHTS = {
  intrinsic: 0.4,
  extraneous: 0.35,
  germane: 0.25,
} as const;

// ---------------------------------------------------------------------------
// CognitiveLoadRegulator
// ---------------------------------------------------------------------------

/**
 * Models and regulates the three CLT channels (intrinsic / extraneous / germane)
 * for every tutor turn, acting as the "cognitive load regulator" described by
 * Wang et al. (2025) adapted for student-tutor interactions.
 */
export class CognitiveLoadRegulator {
  /**
   * Estimate the intrinsic cognitive load for a concept at a given difficulty.
   * Intrinsic load = complexity inherent to the task, independent of presentation.
   * Formula adapted from the "Intrinsic Load" decomposition in Wang et al. (2025).
   */
  static estimateIntrinsicLoad(
    conceptDifficulty: number, // 1-10
    prerequisiteCount: number,
    studentMasteryLevel: number // 0-1, higher = lower effective intrinsic load
  ): number {
    const baseLoad = conceptDifficulty * 7; // scale to 0-70
    const prerequisiteComplexity = Math.min(prerequisiteCount * 3, 20);
    const masteryReduction = studentMasteryLevel * 30;
    return Math.min(100, Math.max(0, baseLoad + prerequisiteComplexity - masteryReduction));
  }

  /**
   * Estimate extraneous cognitive load from an LLM response.
   * Extraneous load = unnecessary complexity due to verbosity, ambiguity, hallucination risk.
   * Delikoura et al. (2025): LLMs often increase extraneous load through verbosity.
   */
  static estimateExtraneousLoad(
    responseWordCount: number,
    chunkCount: number, // number of distinct information chunks
    containsJargon: boolean,
    topicSwitchCount: number
  ): number {
    const verbosityPenalty = Math.min((responseWordCount / 100) * 5, 30); // cap at 30
    const chunkOverflowPenalty = Math.max(0, (chunkCount - WORKING_MEMORY_SPAN.max) * 8);
    const jargonPenalty = containsJargon ? 15 : 0;
    const topicSwitchPenalty = topicSwitchCount * 5;
    return Math.min(100, verbosityPenalty + chunkOverflowPenalty + jargonPenalty + topicSwitchPenalty);
  }

  /**
   * Estimate germane cognitive load — the "desirable difficulty" spent on schema formation.
   * Delikoura et al. (2025): reducing desirable difficulties leads to superficial learning.
   * Higher germane load = more active processing = better long-term retention.
   */
  static estimateGermaneLoad(
    activeSocraticQuestions: number,
    selfExplanationPrompts: number,
    elaborativeInterrogation: boolean
  ): number {
    const socraticBonus = activeSocraticQuestions * 10;
    const selfExplanationBonus = selfExplanationPrompts * 8;
    const elaborationBonus = elaborativeInterrogation ? 15 : 0;
    return Math.min(100, socraticBonus + selfExplanationBonus + elaborationBonus);
  }

  /**
   * Compute the composite CognitiveLoadState for a tutor turn.
   */
  static computeLoadState(
    intrinsicLoad: number,
    extraneousLoad: number,
    germaneLoad: number
  ): CognitiveLoadState {
    const totalLoad =
      intrinsicLoad * LOAD_WEIGHTS.intrinsic +
      extraneousLoad * LOAD_WEIGHTS.extraneous +
      germaneLoad * LOAD_WEIGHTS.germane;

    return {
      intrinsicLoad,
      extraneousLoad,
      germaneLoad,
      totalLoad: Math.min(100, totalLoad),
      timestamp: Date.now(),
    };
  }

  /**
   * Determine whether the current load state requires intervention.
   */
  static requiresIntervention(state: CognitiveLoadState): boolean {
    return state.totalLoad > MAX_SAFE_TOTAL_LOAD || state.extraneousLoad > 50;
  }

  /**
   * Generate a recommended action to reduce cognitive load.
   */
  static recommendLoadReduction(state: CognitiveLoadState): {
    action: "simplify" | "chunk" | "scaffold" | "none";
    reason: string;
  } {
    if (state.extraneousLoad > 60) {
      return {
        action: "simplify",
        reason: "High extraneous load: reduce verbosity and remove jargon.",
      };
    }
    if (state.intrinsicLoad > 70) {
      return {
        action: "scaffold",
        reason: "High intrinsic load: break the concept into smaller sub-goals.",
      };
    }
    if (state.totalLoad > MAX_SAFE_TOTAL_LOAD) {
      return {
        action: "chunk",
        reason: "Total load exceeds safe threshold: present information in smaller chunks.",
      };
    }
    return { action: "none", reason: "Cognitive load within acceptable range." };
  }
}

// ---------------------------------------------------------------------------
// WorkingMemoryChunker
// ---------------------------------------------------------------------------

/**
 * Chunks LLM output into working-memory-sized pieces based on Miller's Law (7±2).
 * Bridges the fundamental mismatch between LLM context windows (massive, static)
 * and human working memory (limited, active) — Huang et al. (2025) / Mei et al. (2025).
 */
export class WorkingMemoryChunker {
  /**
   * Split a flat list of information items into working-memory-sized chunks.
   * Each chunk holds between WORKING_MEMORY_SPAN.min and WORKING_MEMORY_SPAN.max items.
   */
  static chunkItems(
    items: string[],
    label: string = "Chunk"
  ): WorkingMemoryChunk[] {
    const chunkSize = WORKING_MEMORY_SPAN.optimal; // target 7 items per chunk
    const chunks: WorkingMemoryChunk[] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const slice = items.slice(i, i + chunkSize);
      chunks.push({
        id: `chunk-${i / chunkSize + 1}`,
        items: slice,
        chunkLabel: `${label} ${Math.floor(i / chunkSize) + 1}`,
        complexity: Math.ceil(slice.length / 3), // 1-3 complexity rating
      });
    }

    return chunks;
  }

  /**
   * Split a long LLM response paragraph into working-memory-sized sentence groups.
   * Implements the "Context Window Presentation" rules from Mei et al. (2025):
   * optimise the "information payload" delivered to the student.
   */
  static chunkResponse(responseText: string): WorkingMemoryChunk[] {
    // Split on sentence boundaries
    const sentences = responseText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return this.chunkItems(sentences, "Section");
  }

  /**
   * Validate that a chunk list respects working-memory limits.
   * Returns the chunks that exceed Miller's upper bound.
   */
  static findOverloadedChunks(chunks: WorkingMemoryChunk[]): WorkingMemoryChunk[] {
    return chunks.filter((c) => c.items.length > WORKING_MEMORY_SPAN.max);
  }

  /**
   * Compute the total information density of a set of chunks.
   * Used by ContextSaturationTracker to determine attentional residue.
   */
  static computeInformationDensity(chunks: WorkingMemoryChunk[]): number {
    const totalItems = chunks.reduce((sum, c) => sum + c.items.length, 0);
    const safeCapacity = WORKING_MEMORY_SPAN.optimal * chunks.length;
    return Math.min(1, totalItems / Math.max(1, safeCapacity));
  }
}

// ---------------------------------------------------------------------------
// ContextSaturationTracker
// ---------------------------------------------------------------------------

/**
 * Tracks "Context Saturation" and "Attentional Residue" — two mechanisms
 * from Adapala (2025) that degrade performance when context becomes too dense.
 *
 * For educational interfaces this defines the upper bound of information density
 * the LLM should present to a student in a single turn.
 */
export class ContextSaturationTracker {
  /**
   * Calculate saturation level based on unresolved topics and turn count.
   * Adapala (2025): saturation degrades comprehension above ~70%.
   */
  static calculateSaturation(
    unresolvedTopics: number,
    currentTurnCount: number,
    avgChunksPerTurn: number
  ): number {
    const topicPressure = Math.min(unresolvedTopics / 10, 0.5);
    const turnPressure = Math.min(currentTurnCount / 20, 0.3);
    const densityPressure = Math.min((avgChunksPerTurn - 1) / 10, 0.2);
    return Math.min(1, topicPressure + turnPressure + densityPressure);
  }

  /**
   * Compute attentional residue from prior unresolved topics.
   * Dsouza et al. (2024): student's active context diverges rapidly from chat history.
   */
  static computeAttentionalResidue(
    unresolvedTopicIds: string[],
    recentMissedResponseCount: number
  ): number {
    const baseResidue = unresolvedTopicIds.length * 8;
    const missedPenalty = recentMissedResponseCount * 5;
    return Math.min(100, baseResidue + missedPenalty);
  }

  /**
   * Produce a full ContextSaturationMetrics snapshot.
   */
  static evaluate(
    unresolvedTopics: number,
    unresolvedTopicIds: string[],
    currentTurnCount: number,
    avgChunksPerTurn: number,
    recentMissedResponseCount: number
  ): ContextSaturationMetrics {
    const saturationLevel = this.calculateSaturation(
      unresolvedTopics,
      currentTurnCount,
      avgChunksPerTurn
    );
    const attentionalResidue = this.computeAttentionalResidue(
      unresolvedTopicIds,
      recentMissedResponseCount
    );

    // Reduce recommended chunk count when saturated
    const maxNextTurnChunks = Math.max(
      1,
      Math.round(WORKING_MEMORY_SPAN.optimal * (1 - saturationLevel))
    );

    return {
      saturationLevel,
      attentionalResidue,
      maxNextTurnChunks,
      isOverloaded: saturationLevel > 0.7 || attentionalResidue > 60,
    };
  }

  /**
   * Determine whether the student's active context and the LLM chat history
   * have diverged to the point where a recap turn is necessary.
   * Dsouza et al. (2024): inference-time correction is needed when divergence is high.
   */
  static needsRecap(metrics: ContextSaturationMetrics): boolean {
    return metrics.isOverloaded || metrics.attentionalResidue > 70;
  }
}
