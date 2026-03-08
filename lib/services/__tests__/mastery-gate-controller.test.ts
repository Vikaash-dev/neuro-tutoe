/**
 * Tests for MasteryGateController
 * Bloom (1984), Wilson et al. (2019) 85%-Rule, Vygotsky ZPD
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MasteryGateController,
  CorrectiveLoopManager,
  LearningPathAdvancer,
  ZPDCalculator,
  MASTERY_THRESHOLD,
  OPTIMAL_ACCURACY_MIN,
  OPTIMAL_ACCURACY_MAX,
  MIN_ATTEMPTS_FOR_MASTERY,
  COLD_START_P_MASTERED,
} from "../mastery-gate-controller";
import type { MasteryGate } from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGate(overrides: Partial<MasteryGate> = {}): MasteryGate {
  return MasteryGateController.createGate("kc-1", [], new Set());
}

function makeGateWithAttempts(
  correctAttempts: number,
  totalAttempts: number,
  pMastered: number,
  prerequisitesMet = true
): MasteryGate {
  const gate = MasteryGateController.createGate("kc-1", [], new Set());
  return {
    ...gate,
    correctAttempts,
    totalAttempts,
    accuracyRate: totalAttempts > 0 ? correctAttempts / totalAttempts : 0,
    pMastered,
    gatePassed: pMastered >= MASTERY_THRESHOLD && totalAttempts >= MIN_ATTEMPTS_FOR_MASTERY,
    status:
      pMastered >= MASTERY_THRESHOLD && totalAttempts >= MIN_ATTEMPTS_FOR_MASTERY
        ? "mastered"
        : prerequisitesMet
        ? "in_progress"
        : "locked",
    prerequisitesMet,
    unmetPrerequisites: prerequisitesMet ? [] : ["prereq-1"],
    lastAttemptAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// MasteryGateController.createGate
// ---------------------------------------------------------------------------

describe("MasteryGateController.createGate", () => {
  it("should create a gate with cold-start mastery", () => {
    const gate = MasteryGateController.createGate("kc-1", [], new Set());
    expect(gate.pMastered).toBe(COLD_START_P_MASTERED);
    expect(gate.conceptId).toBe("kc-1");
    expect(gate.gatePassed).toBe(false);
  });

  it("should set status=available when no prerequisites", () => {
    const gate = MasteryGateController.createGate("kc-1", [], new Set());
    expect(gate.status).toBe("available");
    expect(gate.prerequisitesMet).toBe(true);
  });

  it("should set status=locked when prerequisites not met", () => {
    const gate = MasteryGateController.createGate("kc-2", ["prereq-1"], new Set());
    expect(gate.status).toBe("locked");
    expect(gate.prerequisitesMet).toBe(false);
    expect(gate.unmetPrerequisites).toContain("prereq-1");
  });

  it("should set status=available when all prerequisites are mastered", () => {
    const mastered = new Set(["prereq-1", "prereq-2"]);
    const gate = MasteryGateController.createGate("kc-3", ["prereq-1", "prereq-2"], mastered);
    expect(gate.status).toBe("available");
    expect(gate.prerequisitesMet).toBe(true);
  });

  it("should only show unmet prerequisites in unmetPrerequisites", () => {
    const mastered = new Set(["prereq-1"]);
    const gate = MasteryGateController.createGate("kc-3", ["prereq-1", "prereq-2"], mastered);
    expect(gate.unmetPrerequisites).toEqual(["prereq-2"]);
  });
});

// ---------------------------------------------------------------------------
// MasteryGateController.recordAttempt
// ---------------------------------------------------------------------------

describe("MasteryGateController.recordAttempt", () => {
  it("should increment totalAttempts on every call", () => {
    let gate = makeGate();
    gate = MasteryGateController.recordAttempt(gate, true, 0.5);
    expect(gate.totalAttempts).toBe(1);
    gate = MasteryGateController.recordAttempt(gate, false, 0.4);
    expect(gate.totalAttempts).toBe(2);
  });

  it("should increment correctAttempts only on correct answers", () => {
    let gate = makeGate();
    gate = MasteryGateController.recordAttempt(gate, true, 0.5);
    gate = MasteryGateController.recordAttempt(gate, false, 0.4);
    gate = MasteryGateController.recordAttempt(gate, true, 0.6);
    expect(gate.correctAttempts).toBe(2);
  });

  it("should pass gate when pMastered >= MASTERY_THRESHOLD with MIN_ATTEMPTS", () => {
    let gate = makeGate();
    for (let i = 0; i < MIN_ATTEMPTS_FOR_MASTERY; i++) {
      gate = MasteryGateController.recordAttempt(gate, true, MASTERY_THRESHOLD + 0.01);
    }
    expect(gate.gatePassed).toBe(true);
    expect(gate.status).toBe("mastered");
  });

  it("should NOT pass gate before MIN_ATTEMPTS even with high pMastered", () => {
    let gate = makeGate();
    gate = MasteryGateController.recordAttempt(gate, true, MASTERY_THRESHOLD + 0.05);
    // Only 1 attempt — below MIN_ATTEMPTS
    expect(gate.gatePassed).toBe(false);
  });

  it("should set masteredAt timestamp when gate first passes", () => {
    let gate = makeGate();
    for (let i = 0; i < MIN_ATTEMPTS_FOR_MASTERY; i++) {
      gate = MasteryGateController.recordAttempt(gate, true, 0.90);
    }
    expect(gate.masteredAt).toBeGreaterThan(0);
  });

  it("should compute correct accuracyRate", () => {
    let gate = makeGate();
    gate = MasteryGateController.recordAttempt(gate, true, 0.5);
    gate = MasteryGateController.recordAttempt(gate, false, 0.4);
    gate = MasteryGateController.recordAttempt(gate, true, 0.5);
    gate = MasteryGateController.recordAttempt(gate, true, 0.6);
    expect(gate.accuracyRate).toBeCloseTo(3 / 4);
  });

  it("should keep status=locked for locked gates regardless of attempts", () => {
    let gate = MasteryGateController.createGate("kc-1", ["prereq-1"], new Set());
    gate = MasteryGateController.recordAttempt(gate, true, 0.90);
    gate = MasteryGateController.recordAttempt(gate, true, 0.92);
    gate = MasteryGateController.recordAttempt(gate, true, 0.95);
    expect(gate.status).toBe("locked");
    expect(gate.gatePassed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MasteryGateController.updatePrerequisites
// ---------------------------------------------------------------------------

describe("MasteryGateController.updatePrerequisites", () => {
  it("should unlock gate when all prerequisites become mastered", () => {
    const gate = MasteryGateController.createGate("kc-2", ["prereq-1"], new Set());
    expect(gate.status).toBe("locked");
    const updated = MasteryGateController.updatePrerequisites(gate, new Set(["prereq-1"]));
    expect(updated.status).toBe("available");
    expect(updated.prerequisitesMet).toBe(true);
  });

  it("should keep gate locked when some prerequisites still unmet", () => {
    const gate = MasteryGateController.createGate("kc-2", ["prereq-1", "prereq-2"], new Set());
    const updated = MasteryGateController.updatePrerequisites(gate, new Set(["prereq-1"]));
    expect(updated.status).toBe("locked");
    expect(updated.unmetPrerequisites).toEqual(["prereq-2"]);
  });
});

// ---------------------------------------------------------------------------
// MasteryGateController.isInOptimalZone & needsRemediation
// ---------------------------------------------------------------------------

describe("MasteryGateController zone checks", () => {
  it("isInOptimalZone should return true for accuracy in optimal band", () => {
    const gate = makeGateWithAttempts(8, 10, 0.6);
    expect(MasteryGateController.isInOptimalZone(gate)).toBe(true);
  });

  it("isInOptimalZone should return false for accuracy below 60%", () => {
    const gate = makeGateWithAttempts(3, 10, 0.35);
    expect(MasteryGateController.isInOptimalZone(gate)).toBe(false);
  });

  it("needsRemediation should return true for very low accuracy after min attempts", () => {
    const gate = makeGateWithAttempts(1, 5, 0.25);
    expect(MasteryGateController.needsRemediation(gate)).toBe(true);
  });

  it("needsRemediation should return false before min attempts", () => {
    const gate = makeGateWithAttempts(0, 1, 0.2);
    expect(MasteryGateController.needsRemediation(gate)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MasteryGateController.summarise
// ---------------------------------------------------------------------------

describe("MasteryGateController.summarise", () => {
  it("should categorise gates by status", () => {
    const gates = new Map<string, MasteryGate>([
      ["locked-1", { ...makeGate(), status: "locked" }],
      ["avail-1", { ...makeGate(), status: "available" }],
      ["prog-1", { ...makeGate(), status: "in_progress" }],
      ["mastered-1", { ...makeGate(), status: "mastered" }],
    ]);
    const summary = MasteryGateController.summarise(gates);
    expect(summary.locked).toContain("locked-1");
    expect(summary.available).toContain("avail-1");
    expect(summary.inProgress).toContain("prog-1");
    expect(summary.mastered).toContain("mastered-1");
  });
});

// ---------------------------------------------------------------------------
// CorrectiveLoopManager
// ---------------------------------------------------------------------------

describe("CorrectiveLoopManager", () => {
  let mgr: CorrectiveLoopManager;

  beforeEach(() => {
    mgr = new CorrectiveLoopManager();
  });

  it("should open a corrective loop with correct fields", () => {
    const loop = mgr.openLoop("kc-1", "confused about X", "Here is the correction", "q-retry-1");
    expect(loop.conceptId).toBe("kc-1");
    expect(loop.gapDescription).toBe("confused about X");
    expect(loop.resolved).toBe(false);
    expect(loop.retryQuestionId).toBe("q-retry-1");
  });

  it("hasActiveLoops should return true after opening a loop", () => {
    mgr.openLoop("kc-1", "gap", "correction", "retry-1");
    expect(mgr.hasActiveLoops("kc-1")).toBe(true);
  });

  it("resolveLoop should mark the most recent open loop as resolved", () => {
    mgr.openLoop("kc-1", "gap1", "correction1", "retry-1");
    const resolved = mgr.resolveLoop("kc-1");
    expect(resolved).not.toBeNull();
    expect(resolved!.resolved).toBe(true);
    expect(mgr.hasActiveLoops("kc-1")).toBe(false);
  });

  it("resolveLoop should return null if no active loops", () => {
    const result = mgr.resolveLoop("no-concept");
    expect(result).toBeNull();
  });

  it("getActiveLoops should return all unresolved loops", () => {
    mgr.openLoop("kc-1", "gap1", "c1", "r1");
    mgr.openLoop("kc-1", "gap2", "c2", "r2");
    mgr.resolveLoop("kc-1"); // resolves most recent (gap2)
    const active = mgr.getActiveLoops("kc-1");
    expect(active.length).toBe(1);
    expect(active[0].gapDescription).toBe("gap1");
  });

  it("buildCorrectionPrompt should produce a non-empty prompt", () => {
    const prompt = CorrectiveLoopManager.buildCorrectionPrompt("kc-1", "confused about recursion", 5);
    expect(prompt.length).toBeGreaterThan(50);
    expect(prompt).toContain("kc-1");
    expect(prompt).toContain("recursion");
  });

  it("buildCorrectionPrompt for low depth should mention concrete examples", () => {
    const prompt = CorrectiveLoopManager.buildCorrectionPrompt("kc-1", "gap", 3);
    expect(prompt.toLowerCase()).toMatch(/concrete|everyday/);
  });

  it("buildCorrectionPrompt for high depth should mention technical precision", () => {
    const prompt = CorrectiveLoopManager.buildCorrectionPrompt("kc-1", "gap", 8);
    expect(prompt.toLowerCase()).toMatch(/technical/);
  });
});

// ---------------------------------------------------------------------------
// LearningPathAdvancer
// ---------------------------------------------------------------------------

describe("LearningPathAdvancer", () => {
  it("getUnlockedBy should return concepts that have all prerequisites met", () => {
    const prereqGraph = new Map([
      ["advanced-kc", ["basic-kc", "intermediate-kc"]],
      ["next-kc", ["basic-kc"]],
    ]);
    const gates = new Map<string, MasteryGate>([
      ["advanced-kc", { ...makeGate(), status: "locked" }],
      ["next-kc", { ...makeGate(), status: "locked" }],
      ["basic-kc", { ...makeGate(), status: "mastered" }],
      ["intermediate-kc", { ...makeGate(), status: "mastered" }],
    ]);
    const unlocked = LearningPathAdvancer.getUnlockedBy("basic-kc", prereqGraph, gates);
    // "next-kc" should be unlocked (only needs basic-kc which is now mastered)
    expect(unlocked).toContain("next-kc");
  });

  it("getUnlockedBy should NOT unlock concepts still missing prerequisites", () => {
    const prereqGraph = new Map([
      ["advanced-kc", ["basic-kc", "intermediate-kc"]],
    ]);
    const gates = new Map<string, MasteryGate>([
      ["advanced-kc", { ...makeGate(), status: "locked" }],
      ["basic-kc", { ...makeGate(), status: "mastered" }],
      // intermediate-kc NOT mastered
    ]);
    const unlocked = LearningPathAdvancer.getUnlockedBy("basic-kc", prereqGraph, gates);
    expect(unlocked).not.toContain("advanced-kc");
  });

  it("recordAdvancement should return a valid LearningPathAdvancement", () => {
    const adv = LearningPathAdvancer.recordAdvancement("kc-1", "kc-2", 0.88);
    expect(adv.fromConceptId).toBe("kc-1");
    expect(adv.toConceptId).toBe("kc-2");
    expect(adv.masteryAtAdvancement).toBeCloseTo(0.88);
    expect(adv.triggerReason).toBe("mastery_gate_passed");
    expect(adv.advancedAt).toBeGreaterThan(0);
  });

  it("topologicalOrder should return foundational concepts first", () => {
    const prereqGraph = new Map([
      ["calculus", ["algebra"]],
      ["linear-algebra", ["algebra"]],
      ["advanced-ml", ["calculus", "linear-algebra"]],
    ]);
    const order = LearningPathAdvancer.topologicalOrder(
      ["algebra", "calculus", "linear-algebra", "advanced-ml"],
      prereqGraph
    );
    const algIdx = order.indexOf("algebra");
    const calcIdx = order.indexOf("calculus");
    expect(algIdx).toBeLessThan(calcIdx);
  });

  it("topologicalOrder should handle cycles without crashing", () => {
    const cyclic = new Map([
      ["a", ["b"]],
      ["b", ["a"]], // cycle
    ]);
    expect(() => LearningPathAdvancer.topologicalOrder(["a", "b"], cyclic)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ZPDCalculator
// ---------------------------------------------------------------------------

describe("ZPDCalculator", () => {
  it("isInZPD should return true for pMastered in [0.30, 0.85)", () => {
    expect(ZPDCalculator.isInZPD(0.50)).toBe(true);
    expect(ZPDCalculator.isInZPD(0.30)).toBe(true);
    expect(ZPDCalculator.isInZPD(0.84)).toBe(true);
  });

  it("isInZPD should return false for mastered concepts", () => {
    expect(ZPDCalculator.isInZPD(MASTERY_THRESHOLD)).toBe(false);
    expect(ZPDCalculator.isInZPD(0.95)).toBe(false);
  });

  it("isInZPD should return false for very low mastery", () => {
    expect(ZPDCalculator.isInZPD(0.10)).toBe(false);
    expect(ZPDCalculator.isInZPD(0.20)).toBe(false);
  });

  it("isMastered should return true at MASTERY_THRESHOLD", () => {
    expect(ZPDCalculator.isMastered(MASTERY_THRESHOLD)).toBe(true);
    expect(ZPDCalculator.isMastered(MASTERY_THRESHOLD - 0.01)).toBe(false);
  });

  it("filterZPDConcepts should return only ZPD-range concepts", () => {
    const map = new Map([
      ["mastered", 0.95],
      ["zpd-1", 0.55],
      ["zpd-2", 0.40],
      ["too-hard", 0.05],
    ]);
    const zpd = ZPDCalculator.filterZPDConcepts(map);
    expect(zpd.has("zpd-1")).toBe(true);
    expect(zpd.has("zpd-2")).toBe(true);
    expect(zpd.has("mastered")).toBe(false);
    expect(zpd.has("too-hard")).toBe(false);
  });

  it("recommendNextConcept should pick highest-mastery ZPD concept", () => {
    const masteryMap = new Map([
      ["kc-easy", 0.95],  // mastered (too easy)
      ["kc-zpd-high", 0.75], // ZPD, high
      ["kc-zpd-low", 0.35],  // ZPD, low
    ]);
    const next = ZPDCalculator.recommendNextConcept(masteryMap, [
      "kc-easy", "kc-zpd-high", "kc-zpd-low",
    ]);
    // Highest ZPD mastery = closest to gate
    expect(next).toBe("kc-zpd-high");
  });

  it("recommendNextConcept should fall back to lowest mastery when no ZPD concepts", () => {
    const masteryMap = new Map([
      ["mastered-1", 0.95],
      ["cold-1", 0.10],
    ]);
    const next = ZPDCalculator.recommendNextConcept(masteryMap, ["mastered-1", "cold-1"]);
    // ZPD empty → lowest mastery
    expect(next).toBe("cold-1");
  });

  it("recommendNextConcept should return null when no available concepts", () => {
    const next = ZPDCalculator.recommendNextConcept(new Map(), []);
    expect(next).toBeNull();
  });
});
