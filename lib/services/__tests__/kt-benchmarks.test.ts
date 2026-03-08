import { describe, it, expect } from "vitest";
import {
  AlignmentScoreCalculator,
  KnowledgeGraphValidator,
  DialogueKTEvaluator,
  ResponsibleAIEvaluator,
} from "../kt-benchmarks";
import type { KGNode, KGEdge, KnowledgeComponent } from "@/lib/types/learning";

const makeNode = (id: string, type: KGNode["type"] = "concept"): KGNode => ({
  id,
  label: id,
  type,
  embedding: [],
  metadata: {},
});

const makeEdge = (
  src: string,
  tgt: string,
  rel: KGEdge["relationshipType"] = "prerequisite_of"
): KGEdge => ({
  sourceId: src,
  targetId: tgt,
  relationshipType: rel,
  weight: 0.8,
  inferredByLLM: false,
});

const makeKC = (id: string, mastery: number): KnowledgeComponent => ({
  id,
  label: id,
  conceptId: id,
  masteryEstimate: mastery,
  source: "explicit",
  lastObserved: Date.now(),
});

describe("AlignmentScoreCalculator", () => {
  describe("computeDirect", () => {
    it("should give alignment 1 when values are equal", () => {
      const score = AlignmentScoreCalculator.computeDirect(0.7, 0.7);
      expect(score.alignmentScore).toBeCloseTo(1, 5);
      expect(score.discrepancyFlag).toBe(false);
    });

    it("should give low alignment for very different values", () => {
      const score = AlignmentScoreCalculator.computeDirect(0.9, 0.1);
      expect(score.alignmentScore).toBeLessThan(0.3);
      expect(score.discrepancyFlag).toBe(true);
    });
  });

  describe("inferMasteryFromText", () => {
    it("should infer higher mastery from confident, technical explanation", () => {
      const high = AlignmentScoreCalculator.inferMasteryFromText(
        "Photosynthesis is precisely the process of converting light energy, specifically from the sun, into chemical energy, therefore producing glucose and oxygen."
      );
      const low = AlignmentScoreCalculator.inferMasteryFromText(
        "Maybe it's something about plants? I'm not sure, perhaps I think it involves light."
      );
      expect(high).toBeGreaterThan(low);
    });
  });

  describe("computeFromText", () => {
    it("should produce alignment score in [0, 1]", () => {
      const score = AlignmentScoreCalculator.computeFromText(0.7, "Photosynthesis converts sunlight to energy.");
      expect(score.alignmentScore).toBeGreaterThanOrEqual(0);
      expect(score.alignmentScore).toBeLessThanOrEqual(1);
    });
  });

  describe("batchCompute", () => {
    it("should compute mean alignment and discrepancy rate", () => {
      const pairs = [
        { ktMastery: 0.8, llmMastery: 0.75 },
        { ktMastery: 0.3, llmMastery: 0.9 },
        { ktMastery: 0.5, llmMastery: 0.5 },
      ];
      const result = AlignmentScoreCalculator.batchCompute(pairs);
      expect(result.scores).toHaveLength(3);
      expect(result.meanAlignment).toBeGreaterThanOrEqual(0);
      expect(result.meanAlignment).toBeLessThanOrEqual(1);
      expect(result.discrepancyRate).toBeGreaterThan(0); // second pair is very different
    });
  });
});

describe("KnowledgeGraphValidator", () => {
  describe("validateEdgeIntegrity", () => {
    it("should pass validation for valid edges", () => {
      const nodes = [makeNode("n1"), makeNode("n2")];
      const edges = [makeEdge("n1", "n2")];
      const { valid } = KnowledgeGraphValidator.validateEdgeIntegrity(nodes, edges);
      expect(valid).toBe(true);
    });

    it("should detect orphaned edges", () => {
      const nodes = [makeNode("n1")];
      const edges = [makeEdge("n1", "n-missing")];
      const { valid, orphanedEdges } = KnowledgeGraphValidator.validateEdgeIntegrity(nodes, edges);
      expect(valid).toBe(false);
      expect(orphanedEdges).toHaveLength(1);
    });
  });

  describe("detectPrerequisiteCycles", () => {
    it("should detect no cycles in a DAG", () => {
      const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
      const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
      const cycles = KnowledgeGraphValidator.detectPrerequisiteCycles(nodes, edges);
      expect(cycles).toHaveLength(0);
    });

    it("should detect a direct cycle", () => {
      const nodes = [makeNode("a"), makeNode("b")];
      const edges = [makeEdge("a", "b"), makeEdge("b", "a")];
      const cycles = KnowledgeGraphValidator.detectPrerequisiteCycles(nodes, edges);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe("computeCoverage", () => {
    it("should return 1.0 for a fully connected linear graph", () => {
      const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
      const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
      const coverage = KnowledgeGraphValidator.computeCoverage(nodes, edges);
      expect(coverage).toBeCloseTo(1, 1);
    });

    it("should return 0 for an empty node list", () => {
      expect(KnowledgeGraphValidator.computeCoverage([], [])).toBe(0);
    });
  });

  describe("computeGraphQuality", () => {
    it("should return high quality for a valid, acyclic, fully connected graph", () => {
      const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
      const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
      const quality = KnowledgeGraphValidator.computeGraphQuality(nodes, edges);
      expect(quality).toBeGreaterThan(0.7);
    });
  });
});

describe("DialogueKTEvaluator", () => {
  describe("computeAUC", () => {
    it("should return 1.0 for perfect predictions", () => {
      const predictions = [
        { predicted: 0.9, actual: true },
        { predicted: 0.8, actual: true },
        { predicted: 0.2, actual: false },
        { predicted: 0.1, actual: false },
      ];
      const auc = DialogueKTEvaluator.computeAUC(predictions);
      expect(auc).toBeCloseTo(1, 3);
    });

    it("should return 0.5 for random predictions", () => {
      const predictions = [
        { predicted: 0.5, actual: true },
        { predicted: 0.5, actual: false },
        { predicted: 0.5, actual: true },
        { predicted: 0.5, actual: false },
      ];
      const auc = DialogueKTEvaluator.computeAUC(predictions);
      expect(auc).toBeCloseTo(0.5, 1);
    });

    it("should return 0.5 for empty predictions", () => {
      expect(DialogueKTEvaluator.computeAUC([])).toBe(0.5);
    });
  });

  describe("evaluateSession", () => {
    it("should compute AUC and alignment scores for a session", () => {
      const kcs = [makeKC("kc1", 0.8), makeKC("kc2", 0.3)];
      const quizResults = [
        { kcId: "kc1", correct: true },
        { kcId: "kc2", correct: false },
      ];
      const evaluation = DialogueKTEvaluator.evaluateSession("session1", kcs, quizResults);
      expect(evaluation.sessionId).toBe("session1");
      expect(evaluation.aucScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.aucScore).toBeLessThanOrEqual(1);
      expect(evaluation.alignmentScores).toHaveLength(2);
    });
  });
});

describe("ResponsibleAIEvaluator", () => {
  describe("computeDemographicParityGap", () => {
    it("should return 0 for identical performance across groups", () => {
      const groups = new Map([
        ["group-a", [{ predicted: 0.8, actual: true }, { predicted: 0.2, actual: false }]],
        ["group-b", [{ predicted: 0.8, actual: true }, { predicted: 0.2, actual: false }]],
      ]);
      const gap = ResponsibleAIEvaluator.computeDemographicParityGap(groups);
      expect(gap).toBeCloseTo(0, 5);
    });

    it("should return a positive gap for different performance across groups", () => {
      // group-a: all predictions correct (0.9 predicted, actual true)
      // group-b: all predictions wrong (0.9 predicted but actual false)
      const groups = new Map([
        ["group-a", [{ predicted: 0.9, actual: true }, { predicted: 0.9, actual: true }]],
        ["group-b", [{ predicted: 0.9, actual: false }, { predicted: 0.9, actual: false }]],
      ]);
      const gap = ResponsibleAIEvaluator.computeDemographicParityGap(groups);
      expect(gap).toBeGreaterThan(0);
    });
  });

  describe("computeCalibrationError", () => {
    it("should return near 0 for a perfectly calibrated model", () => {
      // 10 predictions all at 0.9 confidence, all correct
      const predictions = Array.from({ length: 10 }, () => ({ predicted: 0.95, actual: true }));
      const ece = ResponsibleAIEvaluator.computeCalibrationError(predictions);
      expect(ece).toBeLessThan(0.15);
    });

    it("should return 0 for empty predictions", () => {
      expect(ResponsibleAIEvaluator.computeCalibrationError([])).toBe(0);
    });
  });

  describe("evaluate", () => {
    it("should compute all responsible AI metrics", () => {
      const predictions = [
        { predicted: 0.8, actual: true },
        { predicted: 0.3, actual: false },
      ];
      const groups = new Map([["group-a", predictions]]);
      const metrics = ResponsibleAIEvaluator.evaluate(predictions, groups, 8, 10);
      expect(metrics.transparencyRate).toBeCloseTo(0.8, 5);
      expect(metrics.calibrationError).toBeGreaterThanOrEqual(0);
      expect(metrics.demographicParityGap).toBeGreaterThanOrEqual(0);
      expect(metrics.evaluatedAt).toBeGreaterThan(0);
    });
  });
});
