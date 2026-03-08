import { describe, it, expect } from "vitest";
import {
  LLMEncoder,
  InputAugmentedKT,
  StructureAugmentedKT,
  OutputAugmentedKT,
  HybridKTEngine,
} from "../hybrid-kt-engine";
import { DEFAULT_BKT_PARAMETERS } from "../bayesian-knowledge-tracing";
import type { KnowledgeComponent, KGEdge, BKTState } from "@/lib/types/learning";

const makeBKTState = (kcId: string, mastery: number): BKTState => ({
  kcId,
  masteryProbability: mastery,
  parameters: DEFAULT_BKT_PARAMETERS,
  observationHistory: [],
  confidenceInterval: [mastery - 0.1, mastery + 0.1],
});

const makeKC = (id: string, mastery: number): KnowledgeComponent => ({
  id,
  label: id,
  conceptId: id,
  masteryEstimate: mastery,
  source: "explicit",
  lastObserved: Date.now(),
});

describe("LLMEncoder", () => {
  describe("extractFeatures", () => {
    it("should produce an embedding of the requested dimension", () => {
      const feature = LLMEncoder.extractFeatures("q1", "What is the derivative of x squared?");
      expect(feature.embedding).toHaveLength(64);
    });

    it("should produce a difficulty signal in [0, 1]", () => {
      const feature = LLMEncoder.extractFeatures("q1", "What is 2 + 2?");
      expect(feature.difficultySignal).toBeGreaterThanOrEqual(0);
      expect(feature.difficultySignal).toBeLessThanOrEqual(1);
    });

    it("should use provided concept tags", () => {
      const feature = LLMEncoder.extractFeatures("q1", "Text", ["algebra", "derivatives"]);
      expect(feature.conceptTags).toContain("algebra");
      expect(feature.conceptTags).toContain("derivatives");
    });

    it("should produce deterministic embeddings for the same input", () => {
      const f1 = LLMEncoder.extractFeatures("q1", "Photosynthesis");
      const f2 = LLMEncoder.extractFeatures("q1", "Photosynthesis");
      expect(f1.embedding).toEqual(f2.embedding);
    });
  });

  describe("cosineSimilarity", () => {
    it("should return 1 for identical vectors", () => {
      const v = [1, 2, 3, 4];
      expect(LLMEncoder.cosineSimilarity(v, v)).toBeCloseTo(1, 5);
    });

    it("should return 0 for orthogonal vectors", () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(LLMEncoder.cosineSimilarity(a, b)).toBeCloseTo(0, 5);
    });

    it("should return 0 for empty vectors", () => {
      expect(LLMEncoder.cosineSimilarity([], [])).toBe(0);
    });
  });
});

describe("InputAugmentedKT", () => {
  it("should produce higher pSlip for high-difficulty questions", () => {
    const easyFeature = LLMEncoder.extractFeatures("easy", "What is 1 + 1?");
    const hardFeature = LLMEncoder.extractFeatures("hard", "Derive the Euler-Lagrange equation from first principles considering variational calculus.");

    const easyParams = InputAugmentedKT.augmentParameters(DEFAULT_BKT_PARAMETERS, easyFeature);
    const hardParams = InputAugmentedKT.augmentParameters(DEFAULT_BKT_PARAMETERS, hardFeature);
    expect(hardParams.pSlip).toBeGreaterThanOrEqual(easyParams.pSlip);
  });

  it("should produce a mastery update in [0, 1]", () => {
    const feature = LLMEncoder.extractFeatures("q1", "What is photosynthesis?");
    const mastery = InputAugmentedKT.update(0.5, true, feature);
    expect(mastery).toBeGreaterThanOrEqual(0);
    expect(mastery).toBeLessThanOrEqual(1);
  });
});

describe("StructureAugmentedKT", () => {
  it("should reduce mastery when prerequisites are not mastered", () => {
    const prereqKCs: KnowledgeComponent[] = [makeKC("algebra", 0.2)]; // low mastery prereq
    const edges: KGEdge[] = [
      { sourceId: "algebra", targetId: "calculus", relationshipType: "prerequisite_of", weight: 0.8, inferredByLLM: false },
    ];
    const propagated = StructureAugmentedKT.propagateMastery("calculus", 0.8, prereqKCs, edges);
    expect(propagated).toBeLessThan(0.8);
  });

  it("should not reduce mastery when prerequisites are fully mastered", () => {
    const prereqKCs: KnowledgeComponent[] = [makeKC("algebra", 1.0)];
    const edges: KGEdge[] = [
      { sourceId: "algebra", targetId: "calculus", relationshipType: "prerequisite_of", weight: 0.8, inferredByLLM: false },
    ];
    const propagated = StructureAugmentedKT.propagateMastery("calculus", 0.8, prereqKCs, edges);
    expect(propagated).toBeCloseTo(0.8, 1);
  });

  it("should return original mastery when no prerequisite edges exist", () => {
    const result = StructureAugmentedKT.propagateMastery("calculus", 0.7, [], []);
    expect(result).toBe(0.7);
  });
});

describe("OutputAugmentedKT", () => {
  describe("generateOutputHint", () => {
    it("should recommend re-teach for very low mastery", () => {
      const hint = OutputAugmentedKT.generateOutputHint(makeBKTState("kc1", 0.2));
      expect(hint.toLowerCase()).toContain("re-teach");
    });

    it("should recommend challenge for mastered KC", () => {
      const hint = OutputAugmentedKT.generateOutputHint(makeBKTState("kc1", 0.95));
      expect(hint).toContain("MASTERED");
    });
  });

  describe("computeAlignmentScore", () => {
    it("should give score 1 when KT and LLM mastery match exactly", () => {
      const score = OutputAugmentedKT.computeAlignmentScore(0.7, 0.7);
      expect(score.alignmentScore).toBeCloseTo(1, 5);
      expect(score.discrepancyFlag).toBe(false);
    });

    it("should set discrepancyFlag when difference > 0.3", () => {
      const score = OutputAugmentedKT.computeAlignmentScore(0.9, 0.4);
      expect(score.discrepancyFlag).toBe(true);
    });
  });
});

describe("HybridKTEngine", () => {
  describe("createState", () => {
    it("should create a valid initial state", () => {
      const state = HybridKTEngine.createState("kc-photo", "output_augmented");
      expect(state.bktState.kcId).toBe("kc-photo");
      expect(state.mode).toBe("output_augmented");
      expect(state.outputHint).toBeTruthy();
    });
  });

  describe("processObservation", () => {
    it("should update mastery after a correct observation", () => {
      let state = HybridKTEngine.createState("kc1", "output_augmented");
      const initial = state.bktState.masteryProbability;
      state = HybridKTEngine.processObservation(state, true);
      expect(state.bktState.masteryProbability).toBeGreaterThan(initial);
    });

    it("should add the observation to history", () => {
      let state = HybridKTEngine.createState("kc1", "input_augmented");
      state = HybridKTEngine.processObservation(state, true);
      state = HybridKTEngine.processObservation(state, false);
      expect(state.bktState.observationHistory).toHaveLength(2);
    });

    it("should update timestamp on each observation", () => {
      let state = HybridKTEngine.createState("kc1", "structure_augmented");
      const t0 = state.lastUpdated;
      state = HybridKTEngine.processObservation(state, true);
      expect(state.lastUpdated).toBeGreaterThanOrEqual(t0);
    });
  });

  describe("attachAlignmentScore", () => {
    it("should set alignment score based on LLM inferred mastery", () => {
      let state = HybridKTEngine.createState("kc1", "output_augmented");
      // Process some observations to move mastery from default
      state = HybridKTEngine.processObservation(state, true);
      state = HybridKTEngine.attachAlignmentScore(state, state.bktState.masteryProbability);
      expect(state.alignmentScore).toBeCloseTo(1, 3);
    });
  });
});
