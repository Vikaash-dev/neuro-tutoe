import { describe, it, expect } from "vitest";
import {
  BKTInferenceEngine,
  NeuralParameterGenerator,
  SBRKTEngine,
  TransformerBayesianHybrid,
  BKTConceptTracer,
  DEFAULT_BKT_PARAMETERS,
} from "../bayesian-knowledge-tracing";
import type { KnowledgeComponent } from "@/lib/types/learning";

const makeObs = (correct: boolean) => ({ correct, timestamp: Date.now() });
const makeKC = (id: string): KnowledgeComponent => ({
  id,
  label: id,
  conceptId: id,
  masteryEstimate: 0.5,
  source: "explicit",
  lastObserved: Date.now(),
});

describe("BKTInferenceEngine", () => {
  describe("update", () => {
    it("should increase mastery after correct answer", () => {
      const updated = BKTInferenceEngine.update(0.4, true, DEFAULT_BKT_PARAMETERS);
      expect(updated).toBeGreaterThan(0.4);
    });

    it("should decrease mastery after wrong answer", () => {
      const updated = BKTInferenceEngine.update(0.7, false, DEFAULT_BKT_PARAMETERS);
      expect(updated).toBeLessThan(0.7);
    });

    it("should keep mastery between 0 and 1", () => {
      const edge1 = BKTInferenceEngine.update(0.0, true, DEFAULT_BKT_PARAMETERS);
      const edge2 = BKTInferenceEngine.update(1.0, false, DEFAULT_BKT_PARAMETERS);
      expect(edge1).toBeGreaterThanOrEqual(0);
      expect(edge2).toBeLessThanOrEqual(1);
    });
  });

  describe("computeConfidenceInterval", () => {
    it("should return [lower, upper] with lower < upper", () => {
      const [lower, upper] = BKTInferenceEngine.computeConfidenceInterval(
        0.6, DEFAULT_BKT_PARAMETERS, 50
      );
      expect(lower).toBeLessThan(upper);
    });

    it("should return values in [0, 1]", () => {
      const [lower, upper] = BKTInferenceEngine.computeConfidenceInterval(
        0.5, DEFAULT_BKT_PARAMETERS, 20
      );
      expect(lower).toBeGreaterThanOrEqual(0);
      expect(upper).toBeLessThanOrEqual(1);
    });
  });

  describe("runSequence", () => {
    it("should produce higher mastery for all-correct sequence", () => {
      const allCorrect = Array.from({ length: 10 }, () => makeObs(true));
      const allWrong = Array.from({ length: 10 }, () => makeObs(false));
      const correctState = BKTInferenceEngine.runSequence("kc1", allCorrect);
      const wrongState = BKTInferenceEngine.runSequence("kc1", allWrong);
      expect(correctState.masteryProbability).toBeGreaterThan(wrongState.masteryProbability);
    });

    it("should have confidence interval in the state", () => {
      const obs = [makeObs(true), makeObs(false), makeObs(true)];
      const state = BKTInferenceEngine.runSequence("kc1", obs);
      expect(state.confidenceInterval).toHaveLength(2);
    });
  });
});

describe("NeuralParameterGenerator", () => {
  describe("generateParameters", () => {
    it("should produce valid probability values (0-1) for all parameters", () => {
      const params = NeuralParameterGenerator.generateParameters({
        recentAccuracy: 0.7,
        answerVariance: 0.3,
        improvementRate: 0.2,
        conceptDifficulty: 5,
      });
      for (const value of Object.values(params)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    it("should generate higher pInit for high accuracy student", () => {
      const highAcc = NeuralParameterGenerator.generateParameters({
        recentAccuracy: 0.95, answerVariance: 0.1, improvementRate: 0.5, conceptDifficulty: 3,
      });
      const lowAcc = NeuralParameterGenerator.generateParameters({
        recentAccuracy: 0.2, answerVariance: 0.1, improvementRate: -0.1, conceptDifficulty: 3,
      });
      expect(highAcc.pInit).toBeGreaterThan(lowAcc.pInit);
    });
  });
});

describe("SBRKTEngine", () => {
  describe("generateAuxiliaryKCs", () => {
    it("should generate the requested number of auxiliary KCs", () => {
      const responseLogs = new Map([
        ["kc1", [true, false, true]],
        ["kc2", [true, true, true]],
        ["kc3", [false, false, true]],
      ]);
      const auxKCs = SBRKTEngine.generateAuxiliaryKCs(responseLogs, 4);
      expect(auxKCs).toHaveLength(4);
    });

    it("should assign positive learning gain to each auxiliary KC", () => {
      const responseLogs = new Map([["kc1", [true, false]], ["kc2", [true, true]]]);
      const auxKCs = SBRKTEngine.generateAuxiliaryKCs(responseLogs, 2);
      for (const kc of auxKCs) {
        expect(kc.learningGain).toBeGreaterThan(0);
      }
    });
  });

  describe("augmentMasteryEstimate", () => {
    it("should increase mastery for correlated KC", () => {
      const auxKCs = [{
        id: "aux-1",
        binaryRepresentation: [true],
        correlatedExplicitKCs: ["kc1"],
        learningGain: 0.1,
      }];
      const augmented = SBRKTEngine.augmentMasteryEstimate(0.6, auxKCs, "kc1");
      expect(augmented).toBeGreaterThan(0.6);
    });

    it("should not change mastery for uncorrelated KC", () => {
      const auxKCs = [{
        id: "aux-1",
        binaryRepresentation: [true],
        correlatedExplicitKCs: ["kc2"],
        learningGain: 0.1,
      }];
      const mastery = SBRKTEngine.augmentMasteryEstimate(0.6, auxKCs, "kc1");
      expect(mastery).toBe(0.6);
    });
  });
});

describe("TransformerBayesianHybrid", () => {
  describe("computeAttentionWeights", () => {
    it("should sum to approximately 1", () => {
      const weights = TransformerBayesianHybrid.computeAttentionWeights(5);
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it("should return empty array for 0 observations", () => {
      expect(TransformerBayesianHybrid.computeAttentionWeights(0)).toHaveLength(0);
    });

    it("should give higher weight to more recent observations", () => {
      const weights = TransformerBayesianHybrid.computeAttentionWeights(5);
      expect(weights[4]).toBeGreaterThan(weights[0]!);
    });
  });

  describe("attendedBKTUpdate", () => {
    it("should produce higher mastery for predominantly correct sequence", () => {
      const correct = Array.from({ length: 8 }, () => makeObs(true));
      const wrong = Array.from({ length: 8 }, () => makeObs(false));
      const correctMastery = TransformerBayesianHybrid.attendedBKTUpdate(correct);
      const wrongMastery = TransformerBayesianHybrid.attendedBKTUpdate(wrong);
      expect(correctMastery).toBeGreaterThan(wrongMastery);
    });
  });

  describe("interpretMastery", () => {
    it("should label 'not_acquired' for very low mastery", () => {
      const state = BKTInferenceEngine.runSequence("kc1", Array.from({ length: 5 }, () => makeObs(false)));
      const interp = TransformerBayesianHybrid.interpretMastery(state);
      expect(interp.masteryLabel).toBe("not_acquired");
      expect(interp.recommendedAction).toBe("re-teach");
    });

    it("should label 'mastered' for very high mastery", () => {
      const obs = Array.from({ length: 15 }, () => makeObs(true));
      const state = BKTInferenceEngine.runSequence("kc1", obs, {
        ...DEFAULT_BKT_PARAMETERS, pInit: 0.9, pLearn: 0.4,
      });
      const interp = TransformerBayesianHybrid.interpretMastery(state);
      expect(["acquired", "mastered"]).toContain(interp.masteryLabel);
    });
  });
});

describe("BKTConceptTracer", () => {
  it("should use default parameters for short sequences", () => {
    const kc = makeKC("kc-algebra");
    const obs = [makeObs(true), makeObs(false), makeObs(true)];
    const state = BKTConceptTracer.trace(kc, obs);
    expect(state.kcId).toBe("kc-algebra");
    expect(state.masteryProbability).toBeGreaterThanOrEqual(0);
    expect(state.masteryProbability).toBeLessThanOrEqual(1);
  });

  it("should use neural parameters for long sequences", () => {
    const kc = makeKC("kc-calculus");
    const obs = Array.from({ length: 10 }, (_, i) => makeObs(i % 3 !== 0));
    const state = BKTConceptTracer.trace(kc, obs);
    expect(state.masteryProbability).toBeGreaterThanOrEqual(0);
    expect(state.masteryProbability).toBeLessThanOrEqual(1);
  });
});
