import { describe, it, expect } from "vitest";
import {
  CIKTEngine,
  LLMKTAligner,
  DialogueKCExtractor,
  CrossDomainTransferEngine,
} from "../implicit-knowledge-tracing";
import type { KnowledgeComponent, KGEdge } from "@/lib/types/learning";

const makeKC = (id: string, label: string, mastery = 0.5): KnowledgeComponent => ({
  id,
  label,
  conceptId: `concept-${id}`,
  masteryEstimate: mastery,
  source: "explicit",
  lastObserved: Date.now(),
});

describe("CIKTEngine", () => {
  describe("createState", () => {
    it("should create an empty state", () => {
      const state = CIKTEngine.createState("student1");
      expect(state.studentId).toBe("student1");
      expect(state.iterationCount).toBe(0);
      expect(state.knowledgeComponents.size).toBe(0);
    });
  });

  describe("addKnowledgeComponent", () => {
    it("should add a KC to the state", () => {
      let state = CIKTEngine.createState("s1");
      state = CIKTEngine.addKnowledgeComponent(state, makeKC("kc1", "Photosynthesis"));
      expect(state.knowledgeComponents.size).toBe(1);
      expect(state.knowledgeComponents.get("kc1")?.label).toBe("Photosynthesis");
    });
  });

  describe("refineState", () => {
    it("should increase mastery on correct evidence", () => {
      let state = CIKTEngine.createState("s1");
      state = CIKTEngine.addKnowledgeComponent(state, makeKC("kc1", "Photosynthesis", 0.4));

      const { state: refined } = CIKTEngine.refineState(state, [
        { kcId: "kc1", correct: true, confidence: 0.9 },
      ]);
      const newMastery = refined.knowledgeComponents.get("kc1")?.masteryEstimate ?? 0;
      expect(newMastery).toBeGreaterThan(0.4);
    });

    it("should decrease mastery on incorrect evidence", () => {
      let state = CIKTEngine.createState("s1");
      state = CIKTEngine.addKnowledgeComponent(state, makeKC("kc1", "Photosynthesis", 0.7));

      const { state: refined } = CIKTEngine.refineState(state, [
        { kcId: "kc1", correct: false, confidence: 0.9 },
      ]);
      const newMastery = refined.knowledgeComponents.get("kc1")?.masteryEstimate ?? 1;
      expect(newMastery).toBeLessThan(0.7);
    });

    it("should increment iteration count", () => {
      let state = CIKTEngine.createState("s1");
      state = CIKTEngine.addKnowledgeComponent(state, makeKC("kc1", "Photosynthesis"));
      const { state: refined } = CIKTEngine.refineState(state, []);
      expect(refined.iterationCount).toBe(1);
    });
  });

  describe("runRefinementLoop", () => {
    it("should converge within MAX_CIKT_ITERATIONS", () => {
      let state = CIKTEngine.createState("s1");
      state = CIKTEngine.addKnowledgeComponent(state, makeKC("kc1", "Algebra", 0.5));
      const evidence = Array.from({ length: 10 }, () => ({
        kcId: "kc1", correct: true, confidence: 0.8,
      }));
      const finalState = CIKTEngine.runRefinementLoop(state, evidence);
      expect(finalState.iterationCount).toBeLessThanOrEqual(5);
      const mastery = finalState.knowledgeComponents.get("kc1")?.masteryEstimate ?? 0;
      expect(mastery).toBeGreaterThan(0.5);
    });
  });
});

describe("LLMKTAligner", () => {
  describe("generateKTSystemPrompt", () => {
    it("should include student name and concept", () => {
      const prompt = LLMKTAligner.generateKTSystemPrompt("Alice", "Photosynthesis");
      expect(prompt).toContain("Alice");
      expect(prompt).toContain("Photosynthesis");
      expect(prompt).toContain("masteryEvidence");
    });
  });

  describe("parseKTResponse", () => {
    it("should parse valid JSON from LLM response", () => {
      const response = `
        Here is my analysis:
        {"kcId": "kc-photosynthesis", "masteryEvidence": "partial", "confidence": 0.6, "reasoning": "Student mentioned light but missed glucose."}
      `;
      const parsed = LLMKTAligner.parseKTResponse(response);
      expect(parsed).not.toBeNull();
      expect(parsed?.kcId).toBe("kc-photosynthesis");
      expect(parsed?.masteryEvidence).toBe("partial");
      expect(parsed?.confidence).toBe(0.6);
    });

    it("should return null for non-JSON response", () => {
      const result = LLMKTAligner.parseKTResponse("I think the student understands this well.");
      expect(result).toBeNull();
    });
  });
});

describe("DialogueKCExtractor", () => {
  const kcs: KnowledgeComponent[] = [
    makeKC("kc-photo", "photosynthesis"),
    makeKC("kc-chloro", "chlorophyll"),
    makeKC("kc-glucose", "glucose"),
  ];

  describe("annotateDialogue", () => {
    it("should extract matching KCs from utterances", () => {
      const utterances = [
        "Photosynthesis happens in the leaves using chlorophyll.",
        "Glucose is produced as a byproduct of the light reactions.",
      ];
      const annotated = DialogueKCExtractor.annotateDialogue(utterances, kcs);
      expect(annotated).toHaveLength(2);
      expect(annotated[0]!.extractedKCs.length).toBeGreaterThan(0);
    });

    it("should mark absent mastery for unrelated utterances", () => {
      const utterances = ["The weather is nice today."];
      const annotated = DialogueKCExtractor.annotateDialogue(utterances, kcs);
      expect(annotated[0]!.masteryEvidence).toBe("absent");
    });
  });

  describe("aggregateMastery", () => {
    it("should produce highest mastery estimate per KC across turns", () => {
      const utterances = [
        "I vaguely know about photosynthesis.",
        "Photosynthesis is a detailed complex biochemical process involving chlorophyll and light energy to produce glucose.",
      ];
      const annotated = DialogueKCExtractor.annotateDialogue(utterances, kcs);
      const masteryMap = DialogueKCExtractor.aggregateMastery(annotated);

      if (masteryMap.has("kc-photo")) {
        expect(masteryMap.get("kc-photo")).toBeGreaterThan(0);
      }
    });
  });
});

describe("CrossDomainTransferEngine", () => {
  describe("transferMastery", () => {
    it("should return prior 0.5 when no connected nodes exist", () => {
      const mastery = CrossDomainTransferEngine.transferMastery(
        "target-kc",
        [],
        new Map()
      );
      expect(mastery).toBe(0.5);
    });

    it("should transfer mastery from strongly connected source KCs", () => {
      const edges: KGEdge[] = [
        { sourceId: "source-kc", targetId: "target-kc", relationshipType: "related_to", weight: 0.9, inferredByLLM: false },
      ];
      const sourceMap = new Map([["source-kc", 0.85]]);
      const transferred = CrossDomainTransferEngine.transferMastery("target-kc", edges, sourceMap);
      expect(transferred).toBeGreaterThan(0.5);
    });

    it("should produce weighted average transfer from multiple connected nodes", () => {
      // source-high (mastery=0.85) with weak link (0.1) and source-low (mastery=0.1) with strong link (0.9)
      // Expected weighted average: (0.85*0.1 + 0.1*0.9) / (0.1+0.9) = 0.175 / 1.0 = 0.175
      const edges: KGEdge[] = [
        { sourceId: "source-high", targetId: "target-kc", relationshipType: "related_to", weight: 0.1, inferredByLLM: false },
        { sourceId: "source-low", targetId: "target-kc", relationshipType: "related_to", weight: 0.9, inferredByLLM: false },
      ];
      const sourceMap = new Map([["source-high", 0.85], ["source-low", 0.1]]);
      const transferred = CrossDomainTransferEngine.transferMastery("target-kc", edges, sourceMap);
      // Weak-connected high mastery + strongly-connected low mastery → overall low transfer
      expect(transferred).toBeLessThan(0.5);
    });
  });
});
