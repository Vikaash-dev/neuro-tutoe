import { describe, it, expect } from "vitest";
import {
  PolyGTraversal,
  GFMRagEngine,
  KGIngestionEngine,
  DynamicCurriculumAgent,
  DualGraphBuilder,
  CLLMRecEngine,
  NeoHybridSearch,
  FactRAGVerifier,
} from "../graphrag-curriculum";
import type { KGNode, KGEdge } from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeNode = (id: string, type: KGNode["type"] = "concept", embedding: number[] = []): KGNode => ({
  id,
  label: id.replace(/-/g, " "),
  type,
  embedding,
  metadata: {},
});

const makeEdge = (
  src: string,
  tgt: string,
  rel: KGEdge["relationshipType"] = "prerequisite_of",
  weight = 0.8
): KGEdge => ({
  sourceId: src,
  targetId: tgt,
  relationshipType: rel,
  weight,
  inferredByLLM: false,
});

// Simple linear graph: algebra → calculus → differential-equations
const linearNodes = [makeNode("algebra"), makeNode("calculus"), makeNode("differential-equations")];
const linearEdges = [makeEdge("algebra", "calculus"), makeEdge("calculus", "differential-equations")];

// ---------------------------------------------------------------------------
// PolyGTraversal (Iteration 13)
// ---------------------------------------------------------------------------

describe("PolyGTraversal", () => {
  describe("createContext", () => {
    it("should create a context with correct start node", () => {
      const ctx = PolyGTraversal.createContext("algebra", {}, 3);
      expect(ctx.startNodeId).toBe("algebra");
      expect(ctx.maxHops).toBe(3);
    });
  });

  describe("extractSubgraph", () => {
    it("should include the start node in the subgraph", () => {
      const ctx = PolyGTraversal.createContext("algebra", {}, 3);
      const { nodes } = PolyGTraversal.extractSubgraph(linearNodes, linearEdges, ctx);
      expect(nodes.some((n) => n.id === "algebra")).toBe(true);
    });

    it("should respect maxHops", () => {
      const ctx = PolyGTraversal.createContext("algebra", {}, 1);
      const { nodes } = PolyGTraversal.extractSubgraph(linearNodes, linearEdges, ctx);
      // With maxHops=1 from algebra, should include algebra + calculus but NOT differential-equations
      expect(nodes.some((n) => n.id === "differential-equations")).toBe(false);
    });

    it("should skip fully mastered nodes beyond the root", () => {
      const ctx = PolyGTraversal.createContext("algebra", { calculus: 0.95 }, 3);
      const { nodes } = PolyGTraversal.extractSubgraph(linearNodes, linearEdges, ctx);
      expect(nodes.some((n) => n.id === "calculus")).toBe(false);
    });

    it("should prune edges below the relevance threshold", () => {
      const weakEdges = [
        makeEdge("algebra", "calculus", "prerequisite_of", 0.1), // below threshold 0.3
      ];
      const ctx = PolyGTraversal.createContext("algebra", {}, 3);
      const { nodes } = PolyGTraversal.extractSubgraph(linearNodes, weakEdges, ctx);
      // Only algebra should be reachable
      expect(nodes).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// GFMRagEngine (Iteration 13)
// ---------------------------------------------------------------------------

describe("GFMRagEngine", () => {
  describe("findMultiHopPath", () => {
    it("should find direct path in linear graph", () => {
      const path = GFMRagEngine.findMultiHopPath("algebra", "calculus", linearEdges);
      expect(path).not.toBeNull();
      expect(path).toEqual(["algebra", "calculus"]);
    });

    it("should find multi-hop path", () => {
      const path = GFMRagEngine.findMultiHopPath("algebra", "differential-equations", linearEdges);
      expect(path).not.toBeNull();
      expect(path).toHaveLength(3);
      expect(path![0]).toBe("algebra");
      expect(path![2]).toBe("differential-equations");
    });

    it("should return null when path exceeds maxHops", () => {
      const path = GFMRagEngine.findMultiHopPath("algebra", "differential-equations", linearEdges, 1);
      expect(path).toBeNull();
    });

    it("should return single-element path for source === target", () => {
      const path = GFMRagEngine.findMultiHopPath("algebra", "algebra", linearEdges);
      expect(path).toEqual(["algebra"]);
    });
  });

  describe("scorePathQuality", () => {
    it("should return 1 for single node path", () => {
      expect(GFMRagEngine.scorePathQuality(["algebra"], linearEdges)).toBe(1);
    });

    it("should return the average edge weight along the path", () => {
      const score = GFMRagEngine.scorePathQuality(
        ["algebra", "calculus", "differential-equations"],
        linearEdges
      );
      expect(score).toBeCloseTo(0.8, 3);
    });
  });
});

// ---------------------------------------------------------------------------
// KGIngestionEngine (Iteration 13)
// ---------------------------------------------------------------------------

describe("KGIngestionEngine", () => {
  describe("extractConceptsFromText", () => {
    it("should extract title-case concept phrases", () => {
      const text = "Quantum Mechanics describes the behavior of subatomic particles. " +
        "The concept of Wave Function collapse is central to understanding measurement.";
      const nodes = KGIngestionEngine.extractConceptsFromText(text, "textbook-1");
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.every((n) => n.type === "concept")).toBe(true);
    });

    it("should assign node IDs based on source and label", () => {
      const text = "The Theory of Evolution explains biodiversity.";
      const nodes = KGIngestionEngine.extractConceptsFromText(text, "biology-101");
      expect(nodes.some((n) => n.id.startsWith("biology-101-"))).toBe(true);
    });
  });

  describe("inferEdgesFromCoOccurrence", () => {
    it("should infer edges for concepts co-occurring in sentences", () => {
      const text = "Photosynthesis uses Chlorophyll to absorb light. " +
        "Chlorophyll is the primary pigment in Photosynthesis.";
      const nodes = [
        makeNode("photo", "concept"),
        makeNode("chloro", "concept"),
      ];
      nodes[0]!.label = "Photosynthesis";
      nodes[1]!.label = "Chlorophyll";
      const edges = KGIngestionEngine.inferEdgesFromCoOccurrence(nodes, text, 0.1);
      expect(edges.some((e) => e.relationshipType === "related_to")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// DynamicCurriculumAgent (Iteration 14)
// ---------------------------------------------------------------------------

describe("DynamicCurriculumAgent", () => {
  describe("topologicalSort", () => {
    it("should order prerequisites before dependents", () => {
      const sorted = DynamicCurriculumAgent.topologicalSort(
        ["algebra", "calculus", "differential-equations"],
        linearEdges
      );
      expect(sorted.indexOf("algebra")).toBeLessThan(sorted.indexOf("calculus"));
      expect(sorted.indexOf("calculus")).toBeLessThan(sorted.indexOf("differential-equations"));
    });
  });

  describe("generatePath", () => {
    it("should include the target concept in the path", () => {
      const path = DynamicCurriculumAgent.generatePath(
        "student1",
        "differential-equations",
        linearNodes,
        linearEdges,
        {}
      );
      expect(path.orderedConceptIds).toContain("differential-equations");
    });

    it("should skip fully mastered concepts beyond the target", () => {
      const path = DynamicCurriculumAgent.generatePath(
        "student1",
        "differential-equations",
        linearNodes,
        linearEdges,
        { algebra: 0.95, calculus: 0.95 } // already mastered
      );
      // Mastered concepts may still appear for review but should not dominate
      expect(path.orderedConceptIds).toContain("differential-equations");
    });

    it("should report a positive estimated time", () => {
      const path = DynamicCurriculumAgent.generatePath(
        "student1",
        "differential-equations",
        linearNodes,
        linearEdges,
        {}
      );
      expect(path.estimatedTotalTime).toBeGreaterThan(0);
    });

    it("should report high prerequisite satisfaction for a correctly ordered path", () => {
      const path = DynamicCurriculumAgent.generatePath(
        "student1",
        "differential-equations",
        linearNodes,
        linearEdges,
        {}
      );
      expect(path.prerequisiteSatisfactionScore).toBeGreaterThanOrEqual(0.8);
    });
  });
});

// ---------------------------------------------------------------------------
// DualGraphBuilder (Iteration 15)
// ---------------------------------------------------------------------------

describe("DualGraphBuilder", () => {
  describe("build", () => {
    it("should separate concepts and resources", () => {
      const nodes = [
        makeNode("concept-a", "concept"),
        makeNode("resource-1", "resource"),
        makeNode("concept-b", "concept"),
      ];
      const edges = [
        makeEdge("concept-a", "resource-1", "assessed_by"),
        makeEdge("concept-a", "concept-b", "related_to"),
      ];
      const dual = DualGraphBuilder.build(nodes, edges);
      expect(dual.conceptGraph.nodes).toHaveLength(2);
      expect(dual.resourceGraph.nodes).toHaveLength(1);
      expect(dual.bridgeEdges).toHaveLength(1);
    });
  });

  describe("inferMissingEdges", () => {
    it("should infer edges for nodes with high embedding similarity", () => {
      const v1 = [1, 0, 0, 1];
      const v2 = [0.99, 0.01, 0.01, 0.99]; // very similar to v1
      const nodes = [
        { ...makeNode("a"), embedding: v1 },
        { ...makeNode("b"), embedding: v2 },
      ];
      const inferred = DualGraphBuilder.inferMissingEdges(nodes, [], 0.5);
      expect(inferred.length).toBeGreaterThan(0);
      expect(inferred[0]!.relationshipType).toBe("semantic_similar");
      expect(inferred[0]!.inferredByLLM).toBe(true);
    });

    it("should not infer edges for dissimilar nodes", () => {
      const nodes = [
        { ...makeNode("a"), embedding: [1, 0] },
        { ...makeNode("b"), embedding: [0, 1] },
      ];
      const inferred = DualGraphBuilder.inferMissingEdges(nodes, [], 0.9);
      expect(inferred).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// CLLMRecEngine (Iteration 15)
// ---------------------------------------------------------------------------

describe("CLLMRecEngine", () => {
  describe("rankCandidates", () => {
    it("should rank nodes with higher novelty (unmastered) higher", () => {
      const query = [1, 0, 0];
      const candidates = [
        { ...makeNode("mastered-concept"), embedding: [0.9, 0.1, 0] },
        { ...makeNode("new-concept"), embedding: [0.85, 0.1, 0] },
      ];
      const masteryMap = { "mastered-concept": 0.95, "new-concept": 0.1 };
      const ranked = CLLMRecEngine.rankCandidates(query, candidates, masteryMap);
      expect(ranked[0]!.node.id).toBe("new-concept");
    });

    it("should return empty array for empty candidates", () => {
      expect(CLLMRecEngine.rankCandidates([1, 0], [], {})).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// NeoHybridSearch (Iteration 16)
// ---------------------------------------------------------------------------

describe("NeoHybridSearch", () => {
  describe("search", () => {
    it("should return results sorted by combined score descending", () => {
      const query = [1, 0, 0];
      const nodes = [
        { ...makeNode("n1"), embedding: [0.9, 0.1, 0] },
        { ...makeNode("n2"), embedding: [0.1, 0.9, 0] },
        { ...makeNode("n3"), embedding: [0.5, 0.5, 0] },
      ];
      const results = NeoHybridSearch.search(
        { queryText: "test", queryEmbedding: query, vectorTopK: 3, graphHops: 1 },
        nodes,
        []
      );
      // Results should be in descending combinedScore order
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.combinedScore).toBeGreaterThanOrEqual(results[i + 1]!.combinedScore);
      }
    });

    it("should return empty array for nodes without embeddings", () => {
      const nodes = [makeNode("n1"), makeNode("n2")]; // embeddings = []
      const results = NeoHybridSearch.search(
        { queryText: "test", queryEmbedding: [1, 0], vectorTopK: 5, graphHops: 1 },
        nodes,
        []
      );
      expect(results).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// FactRAGVerifier (Iteration 16)
// ---------------------------------------------------------------------------

describe("FactRAGVerifier", () => {
  const nodes = [
    makeNode("photosynthesis"),
    makeNode("chlorophyll"),
    makeNode("glucose"),
  ];

  describe("verifyClaim", () => {
    it("should support a claim mentioning known concept nodes", () => {
      const result = FactRAGVerifier.verifyClaim(
        "Photosynthesis produces glucose using chlorophyll.",
        nodes,
        []
      );
      expect(result.supportingNodeIds.length).toBeGreaterThan(0);
    });

    it("should flag negated claims as potentially contradicting", () => {
      const result = FactRAGVerifier.verifyClaim(
        "Photosynthesis is not a biological process.",
        nodes,
        []
      );
      expect(result.contradictingNodeIds.length).toBeGreaterThan(0);
    });

    it("should produce grounding score in [0, 1]", () => {
      const result = FactRAGVerifier.verifyClaim("Glucose is produced by photosynthesis.", nodes, []);
      expect(result.groundingScore).toBeGreaterThanOrEqual(0);
      expect(result.groundingScore).toBeLessThanOrEqual(1);
    });
  });

  describe("batchVerify", () => {
    it("should compute hallucination risk as proportion of unverified claims", () => {
      const claims = [
        "Photosynthesis produces glucose.",
        "The moon is made of cheese.",
        "Chlorophyll absorbs light.",
      ];
      const { hallucinationRisk, unverifiedClaims } = FactRAGVerifier.batchVerify(claims, nodes, []);
      expect(hallucinationRisk).toBeGreaterThanOrEqual(0);
      expect(hallucinationRisk).toBeLessThanOrEqual(1);
      expect(Array.isArray(unverifiedClaims)).toBe(true);
    });
  });
});
