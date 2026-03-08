/**
 * Hybrid Knowledge Tracing (KT) Engine
 * Combines BKT/IKT structural rigor with LLM generative capabilities.
 *
 * Research basis:
 *  - Lee et al. (2024) "Language Model Can Do Knowledge Tracing"
 *  - Zanellati et al. (2024) "Hybrid Models for KT: A Systematic Literature Review"
 *  - Bhattacharyya et al. (2025) "Faster, Cheaper, More Accurate: Specialised KT Models"
 *
 * Three hybrid modes (Zanellati 2024 taxonomy):
 *  1. Input-Augmented  — LLM features enhance BKT/DKT inputs
 *  2. Structure-Augmented — LLM defines causal structure (prerequisite graphs) for BKT
 *  3. Output-Augmented  — BKT states guide LLM response generation
 */

import type {
  HybridKTMode,
  HybridKTState,
  LLMSemanticFeature,
  BKTState,
  KTAlignmentScore,
  KGEdge,
  KnowledgeComponent,
} from "@/lib/types/learning";
import { BKTInferenceEngine, DEFAULT_BKT_PARAMETERS } from "./bayesian-knowledge-tracing";

// ---------------------------------------------------------------------------
// LLMEncoder
// ---------------------------------------------------------------------------

/**
 * LLM-as-Encoder: extracts rich semantic features from question text.
 * Lee et al. (2024): the dominant hybrid trend uses LLMs as feature extractors
 * feeding into lightweight specialised KT models — "LLM-as-Encoder" approach.
 *
 * In production this calls an embedding model; here we implement the
 * structural logic for offline / deterministic processing.
 */
export class LLMEncoder {
  /**
   * Extract semantic features from a question string.
   * Returns a fixed-dimension pseudo-embedding + metadata.
   *
   * The embedding is deterministic (hash-based) so tests are reproducible.
   */
  static extractFeatures(
    questionId: string,
    questionText: string,
    conceptTags: string[] = []
  ): LLMSemanticFeature {
    // Deterministic pseudo-embedding from character codes (simulates dense vector)
    const embedding = this.computePseudoEmbedding(questionText, 64);

    // Difficulty estimation: longer sentences + rare words → higher difficulty
    const words = questionText.split(/\s+/);
    const avgWordLength = words.reduce((s, w) => s + w.length, 0) / Math.max(1, words.length);
    const difficultySignal = Math.min(1, (avgWordLength - 3) / 7 + words.length / 50);

    return {
      questionId,
      embedding,
      conceptTags: conceptTags.length > 0 ? conceptTags : this.extractConceptTags(questionText),
      difficultySignal: Math.min(1, Math.max(0, difficultySignal)),
    };
  }

  /** Compute a deterministic pseudo-embedding (sine/cosine hash). */
  private static computePseudoEmbedding(text: string, dim: number): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < dim; i++) {
      let val = 0;
      for (let j = 0; j < text.length; j++) {
        val += text.charCodeAt(j) * Math.sin((i + 1) * (j + 1));
      }
      embedding.push(Math.tanh(val / (text.length * 10)));
    }
    return embedding;
  }

  /** Simple keyword-based concept tag extraction. */
  private static extractConceptTags(text: string): string[] {
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "what", "how", "why", "when", "where"]);
    const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 4 && !stopWords.has(w));
    return [...new Set(words)].slice(0, 5);
  }

  /**
   * Cosine similarity between two LLM feature vectors.
   * Used to find semantically similar questions in Input-Augmented mode.
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
    const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return normA > 0 && normB > 0 ? dot / (normA * normB) : 0;
  }
}

// ---------------------------------------------------------------------------
// InputAugmentedKT
// ---------------------------------------------------------------------------

/**
 * Input-Augmented hybrid: LLM semantic features enhance BKT input.
 * The LLM-derived difficulty signal adjusts BKT parameters before inference.
 */
export class InputAugmentedKT {
  /**
   * Augment BKT parameters with LLM-derived difficulty signal.
   * Higher LLM difficulty → higher p_slip, lower p_guess (harder task).
   */
  static augmentParameters(
    baseParams: typeof DEFAULT_BKT_PARAMETERS,
    llmFeature: LLMSemanticFeature
  ): typeof DEFAULT_BKT_PARAMETERS {
    const d = llmFeature.difficultySignal;
    return {
      ...baseParams,
      pSlip: Math.min(0.4, baseParams.pSlip + d * 0.1),
      pGuess: Math.max(0.05, baseParams.pGuess - d * 0.1),
    };
  }

  /**
   * Run BKT update with LLM-augmented parameters.
   */
  static update(
    priorMastery: number,
    correct: boolean,
    llmFeature: LLMSemanticFeature
  ): number {
    const augmented = this.augmentParameters(DEFAULT_BKT_PARAMETERS, llmFeature);
    return BKTInferenceEngine.update(priorMastery, correct, augmented);
  }
}

// ---------------------------------------------------------------------------
// StructureAugmentedKT
// ---------------------------------------------------------------------------

/**
 * Structure-Augmented hybrid: LLM defines the causal prerequisite graph for BKT.
 * The KT model uses this structure to propagate mastery across related KCs.
 */
export class StructureAugmentedKT {
  /**
   * Propagate mastery from prerequisite KCs to a target KC.
   * If prerequisites are not mastered, the target KC's mastery is penalised.
   *
   * @param targetKCMastery  Current mastery estimate for the target KC.
   * @param prerequisiteKCs  KCs that must be mastered before the target.
   * @param edges            Graph edges defining the prerequisite structure.
   */
  static propagateMastery(
    targetKCId: string,
    targetKCMastery: number,
    prerequisiteKCs: KnowledgeComponent[],
    edges: KGEdge[]
  ): number {
    const prereqEdges = edges.filter(
      (e) => e.targetId === targetKCId && e.relationshipType === "prerequisite_of"
    );

    if (prereqEdges.length === 0) return targetKCMastery;

    // Average mastery of direct prerequisites
    let prereqMasterySum = 0;
    let prereqCount = 0;
    for (const edge of prereqEdges) {
      const prereq = prerequisiteKCs.find((kc) => kc.id === edge.sourceId);
      if (prereq) {
        prereqMasterySum += prereq.masteryEstimate * edge.weight;
        prereqCount += edge.weight;
      }
    }

    const avgPrereqMastery = prereqCount > 0 ? prereqMasterySum / prereqCount : 1;
    // Penalty: if prerequisites not mastered, current KC mastery is scaled down
    const structurePenalty = Math.max(0, 1 - (1 - avgPrereqMastery) * 0.5);
    return targetKCMastery * structurePenalty;
  }
}

// ---------------------------------------------------------------------------
// OutputAugmentedKT
// ---------------------------------------------------------------------------

/**
 * Output-Augmented hybrid: BKT mastery state guides LLM response generation.
 * Bhattacharyya et al. (2025): LLMs excel when the task requires *explanation*
 * or *remediation* based on the traced state.
 */
export class OutputAugmentedKT {
  /**
   * Generate a prompt hint for the LLM tutor based on current BKT state.
   * The hint tells the LLM what level of explanation is appropriate.
   *
   * Zanellati (2024): "explain this concept because P(mastery) < 0.5"
   */
  static generateOutputHint(bktState: BKTState): string {
    const p = bktState.masteryProbability;
    const kcId = bktState.kcId;

    if (p < 0.3) {
      return `[KT HINT] Student has NOT acquired KC "${kcId}" (P(mastery)=${p.toFixed(2)}). Re-teach from fundamentals, use concrete examples, check for misconceptions.`;
    }
    if (p < 0.6) {
      return `[KT HINT] Student is ACQUIRING KC "${kcId}" (P(mastery)=${p.toFixed(2)}). Provide targeted practice with corrective feedback.`;
    }
    if (p < 0.85) {
      return `[KT HINT] Student has ACQUIRED KC "${kcId}" (P(mastery)=${p.toFixed(2)}). Reinforce with application tasks and connections to related KCs.`;
    }
    return `[KT HINT] Student has MASTERED KC "${kcId}" (P(mastery)=${p.toFixed(2)}). Challenge with higher-order synthesis or move to next KC.`;
  }

  /**
   * Compute alignment score: how well LLM explanation matches KT prediction.
   * EDM 2025 metric: |BKT mastery – LLM inferred mastery| mapped to alignment.
   */
  static computeAlignmentScore(
    bktMastery: number,
    llmInferredMastery: number
  ): KTAlignmentScore {
    const alignmentScore = Math.max(0, 1 - Math.abs(bktMastery - llmInferredMastery));
    return {
      ktPredictedMastery: bktMastery,
      llmExplainedMastery: llmInferredMastery,
      alignmentScore,
      discrepancyFlag: Math.abs(bktMastery - llmInferredMastery) > 0.3,
    };
  }
}

// ---------------------------------------------------------------------------
// HybridKTEngine
// ---------------------------------------------------------------------------

/**
 * Top-level Hybrid KT Engine supporting all three hybrid modes.
 */
export class HybridKTEngine {
  /**
   * Create an initial HybridKTState for a KC.
   */
  static createState(
    kcId: string,
    mode: HybridKTMode = "output_augmented"
  ): HybridKTState {
    const bktState: BKTState = {
      kcId,
      masteryProbability: DEFAULT_BKT_PARAMETERS.pInit,
      parameters: DEFAULT_BKT_PARAMETERS,
      observationHistory: [],
      confidenceInterval: [0.1, 0.5],
    };

    return {
      mode,
      bktState,
      llmFeatures: null,
      outputHint: OutputAugmentedKT.generateOutputHint(bktState),
      alignmentScore: 1.0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Process one observation through the hybrid engine.
   * The behaviour varies by mode as per Zanellati (2024) taxonomy.
   */
  static processObservation(
    state: HybridKTState,
    correct: boolean,
    llmFeature: LLMSemanticFeature | null = null,
    prerequisiteKCs: KnowledgeComponent[] = [],
    edges: KGEdge[] = []
  ): HybridKTState {
    let newMastery: number;

    switch (state.mode) {
      case "input_augmented": {
        if (llmFeature) {
          newMastery = InputAugmentedKT.update(
            state.bktState.masteryProbability,
            correct,
            llmFeature
          );
        } else {
          newMastery = BKTInferenceEngine.update(
            state.bktState.masteryProbability,
            correct,
            state.bktState.parameters
          );
        }
        break;
      }
      case "structure_augmented": {
        const rawUpdate = BKTInferenceEngine.update(
          state.bktState.masteryProbability,
          correct,
          state.bktState.parameters
        );
        newMastery = StructureAugmentedKT.propagateMastery(
          state.bktState.kcId,
          rawUpdate,
          prerequisiteKCs,
          edges
        );
        break;
      }
      case "output_augmented":
      default: {
        newMastery = BKTInferenceEngine.update(
          state.bktState.masteryProbability,
          correct,
          state.bktState.parameters
        );
        break;
      }
    }

    const updatedBKT: BKTState = {
      ...state.bktState,
      masteryProbability: newMastery,
      observationHistory: [
        ...state.bktState.observationHistory,
        { correct, timestamp: Date.now() },
      ],
    };

    return {
      ...state,
      bktState: updatedBKT,
      llmFeatures: llmFeature ?? state.llmFeatures,
      outputHint: OutputAugmentedKT.generateOutputHint(updatedBKT),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Compute and attach the KT alignment score when LLM-inferred mastery is available.
   */
  static attachAlignmentScore(
    state: HybridKTState,
    llmInferredMastery: number
  ): HybridKTState {
    const ktAlignment = OutputAugmentedKT.computeAlignmentScore(
      state.bktState.masteryProbability,
      llmInferredMastery
    );
    return { ...state, alignmentScore: ktAlignment.alignmentScore };
  }
}
