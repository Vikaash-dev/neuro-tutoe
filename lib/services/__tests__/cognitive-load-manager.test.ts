import { describe, it, expect } from "vitest";
import {
  CognitiveLoadRegulator,
  WorkingMemoryChunker,
  ContextSaturationTracker,
} from "../cognitive-load-manager";

describe("CognitiveLoadRegulator", () => {
  describe("estimateIntrinsicLoad", () => {
    it("should return higher load for difficult concepts with many prerequisites", () => {
      const high = CognitiveLoadRegulator.estimateIntrinsicLoad(9, 5, 0.1);
      const low = CognitiveLoadRegulator.estimateIntrinsicLoad(2, 1, 0.9);
      expect(high).toBeGreaterThan(low);
    });

    it("should clamp load between 0 and 100", () => {
      const load = CognitiveLoadRegulator.estimateIntrinsicLoad(10, 20, 0);
      expect(load).toBeLessThanOrEqual(100);
      expect(load).toBeGreaterThanOrEqual(0);
    });

    it("should reduce load for high student mastery", () => {
      const novice = CognitiveLoadRegulator.estimateIntrinsicLoad(5, 2, 0.0);
      const expert = CognitiveLoadRegulator.estimateIntrinsicLoad(5, 2, 1.0);
      expect(expert).toBeLessThan(novice);
    });
  });

  describe("estimateExtraneousLoad", () => {
    it("should increase with verbosity and jargon", () => {
      const low = CognitiveLoadRegulator.estimateExtraneousLoad(50, 3, false, 0);
      const high = CognitiveLoadRegulator.estimateExtraneousLoad(500, 15, true, 5);
      expect(high).toBeGreaterThan(low);
    });

    it("should clamp between 0 and 100", () => {
      const load = CognitiveLoadRegulator.estimateExtraneousLoad(10000, 100, true, 20);
      expect(load).toBeLessThanOrEqual(100);
    });
  });

  describe("estimateGermaneLoad", () => {
    it("should increase with Socratic questions and self-explanation prompts", () => {
      const passive = CognitiveLoadRegulator.estimateGermaneLoad(0, 0, false);
      const active = CognitiveLoadRegulator.estimateGermaneLoad(3, 2, true);
      expect(active).toBeGreaterThan(passive);
    });

    it("should return 0 for purely passive session", () => {
      expect(CognitiveLoadRegulator.estimateGermaneLoad(0, 0, false)).toBe(0);
    });
  });

  describe("computeLoadState", () => {
    it("should produce a total load in 0-100 range", () => {
      const state = CognitiveLoadRegulator.computeLoadState(50, 40, 30);
      expect(state.totalLoad).toBeGreaterThanOrEqual(0);
      expect(state.totalLoad).toBeLessThanOrEqual(100);
    });

    it("should include a timestamp", () => {
      const state = CognitiveLoadRegulator.computeLoadState(50, 40, 30);
      expect(state.timestamp).toBeGreaterThan(0);
    });
  });

  describe("requiresIntervention", () => {
    it("should flag high total load", () => {
      const state = CognitiveLoadRegulator.computeLoadState(80, 80, 60);
      expect(CognitiveLoadRegulator.requiresIntervention(state)).toBe(true);
    });

    it("should not flag normal load", () => {
      const state = CognitiveLoadRegulator.computeLoadState(30, 20, 20);
      expect(CognitiveLoadRegulator.requiresIntervention(state)).toBe(false);
    });
  });

  describe("recommendLoadReduction", () => {
    it("should recommend simplify for high extraneous load", () => {
      const state = CognitiveLoadRegulator.computeLoadState(20, 70, 20);
      const rec = CognitiveLoadRegulator.recommendLoadReduction(state);
      expect(rec.action).toBe("simplify");
    });

    it("should recommend scaffold for high intrinsic load", () => {
      const state = CognitiveLoadRegulator.computeLoadState(80, 10, 10);
      const rec = CognitiveLoadRegulator.recommendLoadReduction(state);
      expect(rec.action).toBe("scaffold");
    });

    it("should recommend none for low load", () => {
      const state = CognitiveLoadRegulator.computeLoadState(20, 15, 15);
      const rec = CognitiveLoadRegulator.recommendLoadReduction(state);
      expect(rec.action).toBe("none");
    });
  });
});

describe("WorkingMemoryChunker", () => {
  describe("chunkItems", () => {
    it("should produce chunks of at most 7 items by default", () => {
      const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);
      const chunks = WorkingMemoryChunker.chunkItems(items);
      for (const chunk of chunks) {
        expect(chunk.items.length).toBeLessThanOrEqual(9);
      }
    });

    it("should preserve all items across chunks", () => {
      const items = Array.from({ length: 15 }, (_, i) => `item-${i}`);
      const chunks = WorkingMemoryChunker.chunkItems(items);
      const allItems = chunks.flatMap((c) => c.items);
      expect(allItems).toHaveLength(15);
    });

    it("should assign unique chunk IDs", () => {
      const items = Array.from({ length: 14 }, (_, i) => `item-${i}`);
      const chunks = WorkingMemoryChunker.chunkItems(items);
      const ids = chunks.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("chunkResponse", () => {
    it("should split a long response into sections", () => {
      const response =
        "Photosynthesis is the process by which plants produce food. It uses sunlight as energy. " +
        "Carbon dioxide is absorbed from the air. Water is taken up from the roots. Glucose is produced.";
      const chunks = WorkingMemoryChunker.chunkResponse(response);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every((c) => c.items.length > 0)).toBe(true);
    });
  });

  describe("findOverloadedChunks", () => {
    it("should detect chunks exceeding 9 items", () => {
      const overloaded = {
        id: "big",
        items: Array.from({ length: 12 }, (_, i) => `item-${i}`),
        chunkLabel: "Large",
        complexity: 3,
      };
      const normal = {
        id: "small",
        items: ["a", "b", "c"],
        chunkLabel: "Small",
        complexity: 1,
      };
      const result = WorkingMemoryChunker.findOverloadedChunks([overloaded, normal]);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("big");
    });
  });

  describe("computeInformationDensity", () => {
    it("should return 1.0 for chunks at maximum capacity", () => {
      const chunks = [
        { id: "c1", items: Array.from({ length: 9 }, (_, i) => `i${i}`), chunkLabel: "C1", complexity: 2 },
      ];
      const density = WorkingMemoryChunker.computeInformationDensity(chunks);
      expect(density).toBeGreaterThan(0);
      expect(density).toBeLessThanOrEqual(1);
    });
  });
});

describe("ContextSaturationTracker", () => {
  describe("calculateSaturation", () => {
    it("should return higher saturation with more unresolved topics and longer sessions", () => {
      const low = ContextSaturationTracker.calculateSaturation(0, 2, 1);
      const high = ContextSaturationTracker.calculateSaturation(8, 20, 5);
      expect(high).toBeGreaterThan(low);
    });

    it("should clamp to [0, 1]", () => {
      const sat = ContextSaturationTracker.calculateSaturation(100, 100, 100);
      expect(sat).toBeLessThanOrEqual(1);
      expect(sat).toBeGreaterThanOrEqual(0);
    });
  });

  describe("computeAttentionalResidue", () => {
    it("should increase with unresolved topics and missed responses", () => {
      const low = ContextSaturationTracker.computeAttentionalResidue([], 0);
      const high = ContextSaturationTracker.computeAttentionalResidue(["t1", "t2", "t3"], 3);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe("evaluate", () => {
    it("should flag overload when saturation is very high", () => {
      const metrics = ContextSaturationTracker.evaluate(10, ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10"], 25, 8, 5);
      expect(metrics.isOverloaded).toBe(true);
    });

    it("should not flag overload in a fresh session", () => {
      const metrics = ContextSaturationTracker.evaluate(0, [], 2, 2, 0);
      expect(metrics.isOverloaded).toBe(false);
    });

    it("should reduce maxNextTurnChunks under high saturation", () => {
      const saturated = ContextSaturationTracker.evaluate(10, ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"], 20, 7, 4);
      const fresh = ContextSaturationTracker.evaluate(0, [], 1, 1, 0);
      expect(saturated.maxNextTurnChunks).toBeLessThanOrEqual(fresh.maxNextTurnChunks);
    });
  });

  describe("needsRecap", () => {
    it("should require recap when overloaded", () => {
      const metrics = {
        saturationLevel: 0.9,
        attentionalResidue: 80,
        maxNextTurnChunks: 1,
        isOverloaded: true,
      };
      expect(ContextSaturationTracker.needsRecap(metrics)).toBe(true);
    });

    it("should not require recap in a normal session", () => {
      const metrics = {
        saturationLevel: 0.2,
        attentionalResidue: 10,
        maxNextTurnChunks: 6,
        isOverloaded: false,
      };
      expect(ContextSaturationTracker.needsRecap(metrics)).toBe(false);
    });
  });
});
