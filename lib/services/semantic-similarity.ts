/**
 * Semantic Similarity Service — Research Iterations 15-16
 *
 * Iteration 15: Semantic Similarity in Educational Knowledge Graphs
 *  - CLLMRec (arXiv:2511.17041): aligns semantic concepts with learner cognitive states
 *  - GraphRAG-Induced Dual Graphs (arXiv:2506.22303): Concept Graph + Resource Graph
 *  - Semantic Graph Completion (arXiv:2401.13609): infers missing relationships
 *
 * Iteration 16: GraphRAG + Neo4j Integration for Real-time Retrieval
 *  - Neo4j GraphRAG Patterns (NODES 2025): Cypher + vector hybrid search
 *  - AcademicRAG (2025): KG as semantic bridge for resource discovery
 *  - Evidence-Based GraphRAG / FactRAG (2025): hallucination reduction
 */

import {
  EducationalKnowledgeGraph,
  GraphNode,
  GraphEdge,
  KnowledgeGraphFactory,
  AdaptiveGraphTraversal,
  NodeType,
  EdgeType,
} from "./graph-rag-scaling";

// ============================================================================
// SHARED UTILITY
// ============================================================================

/** Cosine similarity between two equal-length embedding vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ============================================================================
// DUAL GRAPH ARCHITECTURE  (arXiv:2506.22303)
// ============================================================================

/**
 * A concrete educational resource (lecture, paper, video, exercise).
 */
export interface EducationalResource {
  id: string;
  title: string;
  type: "lecture" | "paper" | "video" | "exercise" | "textbook" | "article";
  url: string;
  content: string;
  /** Concept IDs this resource is relevant to. */
  conceptIds: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  qualityScore: number; // 0-1
  embedding: number[];
}

/**
 * Link between a concept node (Concept Graph) and a resource node (Resource Graph).
 */
export interface ConceptResourceLink {
  conceptNodeId: string;
  resourceId: string;
  /** How well the resource covers this concept (0-1). */
  coverageScore: number;
  /** Whether this resource is the canonical reference for the concept. */
  isCanonical: boolean;
}

/**
 * Dual Graph: a Concept Graph + Resource Graph bridged by GraphRAG.
 *
 * Enables precise mapping from abstract learning goals (concepts)
 * to concrete educational materials (resources).
 */
export class DualGraphService {
  private conceptGraph: EducationalKnowledgeGraph;
  private resources: Map<string, EducationalResource> = new Map();
  private links: ConceptResourceLink[] = [];
  private graphFactory: KnowledgeGraphFactory;
  private traversal: AdaptiveGraphTraversal;

  constructor(conceptGraph: EducationalKnowledgeGraph) {
    this.conceptGraph = conceptGraph;
    this.graphFactory = new KnowledgeGraphFactory();
    this.traversal = new AdaptiveGraphTraversal();
  }

  /** Add a resource to the Resource Graph. */
  addResource(resource: Omit<EducationalResource, "embedding">): EducationalResource {
    const embedding = this.traversal.embed(`${resource.title} ${resource.content}`);
    const full: EducationalResource = { ...resource, embedding };
    this.resources.set(full.id, full);
    return full;
  }

  /** Link a concept node to a resource. */
  linkConceptToResource(
    conceptNodeId: string,
    resourceId: string,
    coverageScore: number = 0.8,
    isCanonical: boolean = false
  ): void {
    this.links.push({ conceptNodeId, resourceId, coverageScore, isCanonical });
  }

  /**
   * Given a learner query, find the best resources by traversing both graphs.
   *
   * Steps:
   * 1. Locate relevant concept nodes via adaptive graph traversal.
   * 2. Follow concept→resource links.
   * 3. Re-rank resources by semantic similarity to query + quality.
   */
  findResources(
    query: string,
    topK: number = 5
  ): Array<{ resource: EducationalResource; score: number; viaConceptId: string }> {
    const queryEmbedding = this.traversal.embed(query);

    // Step 1 — Find best entry concept node
    const entryNode = this.traversal.findBestEntryNode(this.conceptGraph, query);
    if (!entryNode) return [];

    // Step 2 — Traverse concept graph
    const subgraph = this.traversal.traverseRelevantSubgraph(
      this.conceptGraph,
      query,
      entryNode.id,
      3,
      8
    );

    // Step 3 — Collect linked resources
    const relevantConceptIds = new Set(subgraph.nodes.map((n) => n.id));
    const candidates: Array<{ resource: EducationalResource; score: number; viaConceptId: string }> =
      [];

    for (const link of this.links) {
      if (!relevantConceptIds.has(link.conceptNodeId)) continue;
      const resource = this.resources.get(link.resourceId);
      if (!resource) continue;

      // Score: semantic similarity × coverage × quality × canonical bonus
      const semanticScore = cosineSimilarity(queryEmbedding, resource.embedding);
      const canonicalBonus = link.isCanonical ? 0.1 : 0;
      const score = semanticScore * 0.5 + link.coverageScore * 0.3 + resource.qualityScore * 0.2 + canonicalBonus;

      candidates.push({ resource, score, viaConceptId: link.conceptNodeId });
    }

    // Deduplicate by resource ID, keeping highest score
    const deduplicated = new Map<string, (typeof candidates)[0]>();
    for (const c of candidates) {
      const existing = deduplicated.get(c.resource.id);
      if (!existing || c.score > existing.score) {
        deduplicated.set(c.resource.id, c);
      }
    }

    return [...deduplicated.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

// ============================================================================
// SEMANTIC ALIGNMENT  (CLLMRec, arXiv:2511.17041)
// ============================================================================

export interface CognitiveState {
  learnerId: string;
  /** Concepts the learner currently understands. */
  knownConceptIds: string[];
  /** Concepts the learner is struggling with. */
  strugglingConceptIds: string[];
  /** Current vocabulary level (1-10). */
  vocabularyLevel: number;
  /** Preferred modality for explanations. */
  preferredModality: "visual" | "verbal" | "example-based" | "formal";
}

export interface SemanticAlignmentResult {
  /** Query reformulated to match the learner's vocabulary level. */
  alignedQuery: string;
  /** Graph nodes most semantically relevant to the aligned query. */
  alignedNodes: Array<{ node: GraphNode; alignmentScore: number }>;
  /** Prerequisite gap: concepts the learner needs before the target. */
  prerequisiteGap: string[];
  /** Cold-start handled: true if the learner is new to this domain. */
  coldStartHandled: boolean;
}

/**
 * Aligns learner queries to concept graph nodes based on their cognitive state.
 *
 * Addresses the "cold start" problem by using prior knowledge as context
 * and ensuring recommendations are accessible, not just relevant.
 *
 * Inspired by CLLMRec (arXiv:2511.17041).
 */
export class SemanticAlignmentService {
  private traversal: AdaptiveGraphTraversal;

  constructor() {
    this.traversal = new AdaptiveGraphTraversal();
  }

  /**
   * Align a learner's query to concept graph nodes, personalised to their state.
   *
   * @param graph - Knowledge graph.
   * @param rawQuery - Raw query from the learner.
   * @param cognitiveState - Learner's current knowledge state.
   * @param topK - Number of aligned nodes to return.
   */
  align(
    graph: EducationalKnowledgeGraph,
    rawQuery: string,
    cognitiveState: CognitiveState,
    topK: number = 5
  ): SemanticAlignmentResult {
    // Step 1 — Context-augmented query (anchor to known concepts)
    const knownLabels = cognitiveState.knownConceptIds
      .slice(0, 3)
      .map((id) => graph.nodes.get(id)?.label ?? "")
      .filter(Boolean);

    const contextPrefix = knownLabels.length > 0
      ? `Given knowledge of ${knownLabels.join(", ")}: `
      : "";
    const alignedQuery = `${contextPrefix}${rawQuery}`;

    // Step 2 — Embed the aligned query
    const queryEmbedding = this.traversal.embed(alignedQuery);

    // Step 3 — Score all concept nodes
    const scored: Array<{ node: GraphNode; alignmentScore: number }> = [];
    for (const node of graph.nodes.values()) {
      const semantic = cosineSimilarity(queryEmbedding, node.embedding);

      // Boost accessible nodes (known prerequisites)
      const isAccessible = this.prerequisitesMet(node, graph, cognitiveState.knownConceptIds);
      const accessibilityBonus = isAccessible ? 0.15 : 0;

      // Penalise nodes the learner is already struggling with (avoid overload)
      const overloadPenalty = cognitiveState.strugglingConceptIds.includes(node.id) ? 0.1 : 0;

      const alignmentScore = Math.max(0, semantic + accessibilityBonus - overloadPenalty);
      scored.push({ node, alignmentScore });
    }

    scored.sort((a, b) => b.alignmentScore - a.alignmentScore);
    const alignedNodes = scored.slice(0, topK);

    // Step 4 — Prerequisite gap analysis
    const topNode = alignedNodes[0]?.node;
    const prerequisiteGap = topNode
      ? this.findPrerequisiteGap(topNode, graph, cognitiveState.knownConceptIds)
      : [];

    // Cold start: learner is new to the domain
    const coldStartHandled = cognitiveState.knownConceptIds.length < 3;

    return {
      alignedQuery,
      alignedNodes,
      prerequisiteGap,
      coldStartHandled,
    };
  }

  private prerequisitesMet(
    node: GraphNode,
    graph: EducationalKnowledgeGraph,
    knownIds: string[]
  ): boolean {
    const prereqEdges = graph.edges.filter(
      (e) => e.targetId === node.id && e.type === "prerequisite_of"
    );
    return prereqEdges.every((e) => knownIds.includes(e.sourceId));
  }

  private findPrerequisiteGap(
    node: GraphNode,
    graph: EducationalKnowledgeGraph,
    knownIds: string[]
  ): string[] {
    const prereqEdges = graph.edges.filter(
      (e) => e.targetId === node.id && e.type === "prerequisite_of"
    );
    return prereqEdges
      .filter((e) => !knownIds.includes(e.sourceId))
      .map((e) => graph.nodes.get(e.sourceId)?.label ?? e.sourceId);
  }
}

// ============================================================================
// SEMANTIC GRAPH COMPLETION  (arXiv:2401.13609)
// ============================================================================

export interface InferredEdge {
  sourceId: string;
  targetId: string;
  type: EdgeType;
  confidence: number;
  inferenceMethod: "embedding_similarity" | "transitive_closure" | "co_occurrence";
}

/**
 * Infers missing edges in the knowledge graph using text-based similarity
 * and graph structure (transitive closure).
 *
 * Based on arXiv:2401.13609 "Semantic Graph Completion via Text Mining".
 */
export class SemanticGraphCompletion {
  private traversal: AdaptiveGraphTraversal;

  constructor() {
    this.traversal = new AdaptiveGraphTraversal();
  }

  /**
   * Find probable missing edges in the graph.
   *
   * Strategies:
   * 1. Embedding similarity: if two nodes are very similar but not connected,
   *    infer a "related_to" edge.
   * 2. Transitive closure: if A→B and B→C exist, infer A→C (prerequisite chain).
   * 3. Co-occurrence: nodes that appear in the same resource cluster are likely related.
   *
   * @param graph - Knowledge graph to complete.
   * @param similarityThreshold - Minimum embedding similarity to infer an edge (default 0.85).
   */
  inferMissingEdges(
    graph: EducationalKnowledgeGraph,
    similarityThreshold: number = 0.85
  ): InferredEdge[] {
    const inferred: InferredEdge[] = [];
    const nodes = [...graph.nodes.values()];
    const existingPairs = new Set(
      graph.edges.map((e) => `${e.sourceId}:${e.targetId}`)
    );

    // Strategy 1 — Embedding similarity
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (existingPairs.has(`${a.id}:${b.id}`) || existingPairs.has(`${b.id}:${a.id}`)) continue;

        const sim = cosineSimilarity(a.embedding, b.embedding);
        if (sim >= similarityThreshold) {
          inferred.push({
            sourceId: a.id,
            targetId: b.id,
            type: "related_to",
            confidence: sim,
            inferenceMethod: "embedding_similarity",
          });
        }
      }
    }

    // Strategy 2 — Transitive prerequisite closure (A prerequisite_of B, B prerequisite_of C → A prerequisite_of C)
    const prereqEdges = graph.edges.filter((e) => e.type === "prerequisite_of");
    for (const edgeAB of prereqEdges) {
      for (const edgeBC of prereqEdges) {
        if (edgeAB.targetId !== edgeBC.sourceId) continue;
        const transitiveKey = `${edgeAB.sourceId}:${edgeBC.targetId}`;
        if (existingPairs.has(transitiveKey)) continue;

        inferred.push({
          sourceId: edgeAB.sourceId,
          targetId: edgeBC.targetId,
          type: "prerequisite_of",
          confidence: edgeAB.weight * edgeBC.weight * 0.9,
          inferenceMethod: "transitive_closure",
        });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return inferred.filter((e) => {
      const key = `${e.sourceId}:${e.targetId}:${e.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Apply high-confidence inferred edges back into the graph.
   *
   * @param graph - Graph to enrich.
   * @param inferred - Output of `inferMissingEdges`.
   * @param minConfidence - Only apply edges above this confidence (default 0.8).
   */
  applyInferredEdges(
    graph: EducationalKnowledgeGraph,
    inferred: InferredEdge[],
    minConfidence: number = 0.8
  ): number {
    let applied = 0;
    for (const edge of inferred) {
      if (edge.confidence < minConfidence) continue;
      graph.edges.push({
        id: `inferred_${Date.now()}_${applied}`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        type: edge.type,
        weight: edge.confidence,
        metadata: { inferred: true, method: edge.inferenceMethod },
      });
      applied++;
    }
    if (applied > 0) graph.updatedAt = Date.now();
    return applied;
  }
}

// ============================================================================
// HYBRID SEARCH  (Neo4j GraphRAG Patterns, NODES 2025)
// ============================================================================

export interface HybridSearchResult {
  node: GraphNode;
  /** Combined hybrid score. */
  hybridScore: number;
  /** Component: pure vector similarity. */
  vectorScore: number;
  /** Component: graph structural proximity to the query entry node. */
  graphScore: number;
  /** Hop distance from the entry node. */
  hopDistance: number;
}

/**
 * Hybrid search combining vector similarity (dense retrieval) with graph
 * traversal (structural proximity), mirroring the Neo4j GraphRAG hybrid
 * search patterns from NODES 2025.
 *
 * Formula: hybridScore = α × vectorScore + (1-α) × graphScore
 * where α = 0.6 by default.
 */
export class HybridGraphSearch {
  private traversal: AdaptiveGraphTraversal;
  /** Blend factor: 0 = pure graph, 1 = pure vector. */
  private alpha: number;

  constructor(alpha: number = 0.6) {
    this.traversal = new AdaptiveGraphTraversal();
    this.alpha = alpha;
  }

  /**
   * Perform hybrid search over a knowledge graph.
   *
   * @param graph - Graph to search.
   * @param query - Natural-language query.
   * @param topK - Number of results.
   * @param maxHops - Maximum graph traversal depth.
   */
  search(
    graph: EducationalKnowledgeGraph,
    query: string,
    topK: number = 10,
    maxHops: number = 3
  ): HybridSearchResult[] {
    const queryEmbedding = this.traversal.embed(query);
    const allNodes = [...graph.nodes.values()];

    // Vector scores for all nodes
    const vectorScores = new Map<string, number>(
      allNodes.map((n) => [n.id, cosineSimilarity(queryEmbedding, n.embedding)])
    );

    // Graph scores: proximity to the best entry node
    const entryNode = this.traversal.findBestEntryNode(graph, query);
    const hopDistances = entryNode
      ? this.bfsDistances(graph, entryNode.id, maxHops)
      : new Map<string, number>();

    const maxDist = maxHops;
    const graphScores = new Map<string, number>(
      allNodes.map((n) => {
        const dist = hopDistances.get(n.id) ?? maxDist + 1;
        return [n.id, dist <= maxDist ? 1 - dist / (maxDist + 1) : 0];
      })
    );

    // Compute hybrid scores
    const results: HybridSearchResult[] = allNodes.map((node) => {
      const vs = vectorScores.get(node.id) ?? 0;
      const gs = graphScores.get(node.id) ?? 0;
      const hopDistance = hopDistances.get(node.id) ?? maxDist + 1;
      return {
        node,
        vectorScore: vs,
        graphScore: gs,
        hybridScore: this.alpha * vs + (1 - this.alpha) * gs,
        hopDistance,
      };
    });

    return results.sort((a, b) => b.hybridScore - a.hybridScore).slice(0, topK);
  }

  private bfsDistances(
    graph: EducationalKnowledgeGraph,
    startId: string,
    maxDepth: number
  ): Map<string, number> {
    const distances = new Map<string, number>([[startId, 0]]);
    const queue: Array<[string, number]> = [[startId, 0]];

    while (queue.length > 0) {
      const [nodeId, depth] = queue.shift()!;
      if (depth >= maxDepth) continue;

      const neighbours = graph.edges
        .filter((e) => e.sourceId === nodeId || e.targetId === nodeId)
        .map((e) => (e.sourceId === nodeId ? e.targetId : e.sourceId));

      for (const nbId of neighbours) {
        if (!distances.has(nbId)) {
          distances.set(nbId, depth + 1);
          queue.push([nbId, depth + 1]);
        }
      }
    }

    return distances;
  }
}

// ============================================================================
// FACTRAG VERIFIER  (Evidence-Based GraphRAG, 2025)
// ============================================================================

export interface FactVerificationResult {
  claim: string;
  /** Whether the claim is supported by the knowledge graph. */
  isSupported: boolean;
  /** Supporting evidence nodes from the graph. */
  supportingEvidence: GraphNode[];
  /** Confidence in the verification (0-1). */
  confidence: number;
  /** Nodes that contradict the claim (if any). */
  contradictions: GraphNode[];
}

/**
 * Verifies LLM-generated claims against the knowledge graph to reduce
 * hallucination — the "FactRAG" pattern from Evidence-Based GraphRAG (2025).
 *
 * Critical for educational accuracy (e.g., USMLE-style medical questions).
 */
export class FactRAGVerifier {
  private traversal: AdaptiveGraphTraversal;
  private readonly SUPPORT_THRESHOLD = 0.6;
  private readonly CONTRADICTION_THRESHOLD = 0.75;

  constructor() {
    this.traversal = new AdaptiveGraphTraversal();
  }

  /**
   * Verify a list of claims against the knowledge graph.
   *
   * @param graph - Knowledge graph acting as ground truth.
   * @param claims - Generated claims to verify.
   */
  verifyClaims(
    graph: EducationalKnowledgeGraph,
    claims: string[]
  ): FactVerificationResult[] {
    return claims.map((claim) => this.verifyClaim(graph, claim));
  }

  /**
   * Verify a single claim.
   *
   * Algorithm:
   * 1. Embed the claim.
   * 2. Find nodes supporting the claim (high similarity).
   * 3. Check for contradictions using negation heuristic.
   * 4. Compute confidence from evidence strength.
   */
  verifyClaim(graph: EducationalKnowledgeGraph, claim: string): FactVerificationResult {
    const claimEmbedding = this.traversal.embed(claim);
    const nodes = [...graph.nodes.values()];

    const supportingEvidence: GraphNode[] = [];
    const contradictions: GraphNode[] = [];

    // Simple negation detection heuristic
    const negatedClaim = this.negateClaim(claim);
    const negatedEmbedding = this.traversal.embed(negatedClaim);

    for (const node of nodes) {
      const supportScore = cosineSimilarity(claimEmbedding, node.embedding);
      const contradictionScore = cosineSimilarity(negatedEmbedding, node.embedding);

      if (supportScore >= this.SUPPORT_THRESHOLD) {
        supportingEvidence.push(node);
      }
      if (contradictionScore >= this.CONTRADICTION_THRESHOLD && supportScore < this.SUPPORT_THRESHOLD) {
        contradictions.push(node);
      }
    }

    const isSupported = supportingEvidence.length > 0 && contradictions.length === 0;
    const maxSupportScore = supportingEvidence.length > 0
      ? Math.max(...supportingEvidence.map((n) => cosineSimilarity(claimEmbedding, n.embedding)))
      : 0;
    const confidence = isSupported ? maxSupportScore : Math.max(0, maxSupportScore - 0.2);

    return { claim, isSupported, supportingEvidence, confidence, contradictions };
  }

  private negateClaim(claim: string): string {
    // Simple heuristic negation for testing contradiction
    const negations = [
      ["is", "is not"],
      ["are", "are not"],
      ["does", "does not"],
      ["can", "cannot"],
      ["has", "has not"],
      ["always", "never"],
      ["increases", "decreases"],
      ["causes", "prevents"],
    ];
    let negated = claim;
    for (const [pos, neg] of negations) {
      if (negated.includes(` ${pos} `)) {
        negated = negated.replace(` ${pos} `, ` ${neg} `);
        break;
      }
    }
    return negated !== claim ? negated : `This is false: ${claim}`;
  }
}

// Singleton instances
export const semanticAlignment = new SemanticAlignmentService();
export const graphCompletion = new SemanticGraphCompletion();
export const hybridSearch = new HybridGraphSearch();
export const factRAGVerifier = new FactRAGVerifier();
