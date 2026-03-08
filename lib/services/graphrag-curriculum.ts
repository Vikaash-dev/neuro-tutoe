/**
 * GraphRAG Curriculum Engine
 * Scalable educational knowledge graph construction, traversal, dynamic
 * curriculum generation, semantic similarity, and Neo4j-style hybrid search.
 *
 * Research basis (Iterations 13-16):
 *  Iteration 13 — Scaling GraphRAG:
 *   - PolyG (arXiv:2504.02112) — adaptive graph traversal
 *   - GFM-RAG (arXiv:2502.01113) — Graph Foundation Model multi-hop reasoning
 *   - Efficient KG Construction (arXiv:2507.03226) — dependency-based extraction
 *
 *  Iteration 14 — Dynamic Curriculum via Neo4j:
 *   - Dynamic Knowledge Expansion (arXiv:2602.00020)
 *   - GraphMASAL (arXiv:2511.11035) — multi-agent curriculum pathfinding
 *   - Adaptive Sequencing (arXiv:2411.11520) — pre-trained graph sequencing
 *
 *  Iteration 15 — Semantic Similarity & Personalization:
 *   - CLLMRec (arXiv:2511.17041) — semantic alignment with cognitive states
 *   - GraphRAG-Induced Dual Graphs (arXiv:2506.22303)
 *   - Semantic Graph Completion (arXiv:2401.13609)
 *
 *  Iteration 16 — Neo4j Integration & Real-time Retrieval:
 *   - Neo4j GraphRAG Patterns (NODES 2025) — hybrid Cypher + vector search
 *   - AcademicRAG (2025) — KG as semantic bridge
 *   - Evidence-Based GraphRAG / FactRAG (2025) — hallucination reduction
 */

import type {
  KGNode,
  KGEdge,
  AdaptiveTraversalContext,
  DualGraphState,
  CurriculumPath,
  FactRAGVerification,
  HybridSearchQuery,
  HybridSearchResult,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PolyG: default relevance threshold below which edges are pruned */
const DEFAULT_RELEVANCE_THRESHOLD = 0.3;

/** Semantic completion: minimum similarity to infer a new edge */
const SEMANTIC_COMPLETION_THRESHOLD = 0.75;

/** FactRAG: grounding score below which a claim is flagged */
const FACTRAG_FLAG_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// PolyGTraversal (Iteration 13)
// ---------------------------------------------------------------------------

/**
 * PolyG adaptive graph traversal.
 * arXiv:2504.02112: dynamically explores relevant subgraphs, reducing
 * computational overhead vs. exhaustive search.
 */
export class PolyGTraversal {
  /**
   * Perform adaptive subgraph extraction starting from a seed node.
   * Prunes edges below the relevance threshold and stops at maxHops.
   *
   * @param allNodes        Full knowledge graph nodes.
   * @param allEdges        Full knowledge graph edges.
   * @param context         Traversal parameters and student mastery state.
   */
  static extractSubgraph(
    allNodes: KGNode[],
    allEdges: KGEdge[],
    context: AdaptiveTraversalContext
  ): { nodes: KGNode[]; edges: KGEdge[] } {
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const visited = new Set<string>();
    const subgraphEdges: KGEdge[] = [];

    const queue: Array<{ nodeId: string; hop: number }> = [
      { nodeId: context.startNodeId, hop: 0 },
    ];

    while (queue.length > 0) {
      const { nodeId, hop } = queue.shift()!;
      if (visited.has(nodeId) || hop > context.maxHops) continue;
      visited.add(nodeId);

      // Root node (hop=0) is always included
      const mastery = context.studentMasteryMap[nodeId] ?? 0;
      if (mastery >= 0.9 && hop > 0) continue; // Skip fully mastered intermediate nodes

      const nextHop = hop + 1;
      if (nextHop > context.maxHops) continue; // Don't expand further beyond maxHops

      const outEdges = allEdges.filter(
        (e) =>
          e.sourceId === nodeId &&
          e.weight >= context.relevanceThreshold &&
          !visited.has(e.targetId)
      );

      for (const edge of outEdges) {
        // Skip target nodes that are already mastered (PolyG adaptive pruning)
        const targetMastery = context.studentMasteryMap[edge.targetId] ?? 0;
        if (targetMastery >= 0.9) continue;

        subgraphEdges.push(edge);
        queue.push({ nodeId: edge.targetId, hop: nextHop });
      }
    }

    const subgraphNodeIds = new Set<string>();
    subgraphEdges.forEach((e) => {
      subgraphNodeIds.add(e.sourceId);
      subgraphNodeIds.add(e.targetId);
    });
    subgraphNodeIds.add(context.startNodeId);

    const subgraphNodes = [...subgraphNodeIds]
      .map((id) => nodeMap.get(id))
      .filter((n): n is KGNode => n !== undefined);

    return { nodes: subgraphNodes, edges: subgraphEdges };
  }

  /**
   * Create a default traversal context for a student.
   */
  static createContext(
    startNodeId: string,
    studentMasteryMap: Record<string, number>,
    maxHops: number = 3
  ): AdaptiveTraversalContext {
    return {
      startNodeId,
      studentMasteryMap,
      maxHops,
      relevanceThreshold: DEFAULT_RELEVANCE_THRESHOLD,
      visitedNodes: [],
      subgraphNodes: [],
      subgraphEdges: [],
    };
  }
}

// ---------------------------------------------------------------------------
// GFMRagEngine (Iteration 13)
// ---------------------------------------------------------------------------

/**
 * GFM-RAG multi-hop reasoning engine.
 * arXiv:2502.01113: a Graph Foundation Model that learns complex relationships
 * for nuanced understanding of prerequisite dependencies.
 */
export class GFMRagEngine {
  /**
   * Multi-hop path finding from a source node to a target node.
   * Returns the shortest path (fewest hops) via prerequisite/related edges.
   */
  static findMultiHopPath(
    sourceId: string,
    targetId: string,
    edges: KGEdge[],
    maxHops: number = 5
  ): string[] | null {
    if (sourceId === targetId) return [sourceId];

    const adj = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adj.has(edge.sourceId)) adj.set(edge.sourceId, []);
      adj.get(edge.sourceId)!.push(edge.targetId);
    }

    const queue: Array<{ id: string; path: string[] }> = [
      { id: sourceId, path: [sourceId] },
    ];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (path.length > maxHops + 1) continue;

      for (const neighbour of adj.get(id) ?? []) {
        // Return found only if adding this node doesn't exceed maxHops
        if (neighbour === targetId && path.length <= maxHops) return [...path, neighbour];
        if (!visited.has(neighbour) && path.length < maxHops) {
          visited.add(neighbour);
          queue.push({ id: neighbour, path: [...path, neighbour] });
        }
      }
    }
    return null; // no path found within maxHops
  }

  /**
   * Score a path's pedagogical quality based on edge weights along the path.
   */
  static scorePathQuality(path: string[], edges: KGEdge[]): number {
    if (path.length < 2) return 1;
    let totalWeight = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = edges.find((e) => e.sourceId === path[i] && e.targetId === path[i + 1]);
      totalWeight += edge?.weight ?? 0.5;
    }
    return totalWeight / (path.length - 1);
  }
}

// ---------------------------------------------------------------------------
// KGIngestionEngine (Iteration 13)
// ---------------------------------------------------------------------------

/**
 * Efficient KG construction via dependency-based extraction.
 * arXiv:2507.03226: rapid ingestion of educational materials into structured KGs.
 */
export class KGIngestionEngine {
  /**
   * Extract concept nodes from raw educational text using dependency parsing heuristics.
   * In production this calls an NLP pipeline; here we implement the structural logic.
   */
  static extractConceptsFromText(
    text: string,
    sourceId: string
  ): KGNode[] {
    // Sentence-level chunking
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
    const concepts: KGNode[] = [];
    const seen = new Set<string>();

    for (const sentence of sentences) {
      // Heuristic: noun phrases of 2-4 words in title-case or after "concept of / theory of"
      const patterns = [
        /\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g,
        /(?:concept of|theory of|principle of|law of|model of)\s+([a-zA-Z\s]{4,30}?)(?:[,.]|$)/gi,
      ];

      for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(sentence)) !== null) {
          const label = match[1].trim();
          if (label.length < 4 || label.length > 50 || seen.has(label)) continue;
          seen.add(label);
          concepts.push({
            id: `${sourceId}-${label.toLowerCase().replace(/\s+/g, "-")}`,
            label,
            type: "concept",
            embedding: [],
            metadata: { source: sourceId, sentence },
          });
        }
      }
    }

    return concepts;
  }

  /**
   * Infer edges between concepts using co-occurrence in the same sentence.
   * Higher co-occurrence frequency → stronger edge weight.
   */
  static inferEdgesFromCoOccurrence(
    nodes: KGNode[],
    text: string,
    threshold: number = 0.2
  ): KGEdge[] {
    const sentences = text.split(/[.!?]+/).map((s) => s.trim());
    const coOccurrenceCount = new Map<string, number>();

    for (const sentence of sentences) {
      const presentNodes = nodes.filter((n) =>
        sentence.toLowerCase().includes(n.label.toLowerCase())
      );
      for (let i = 0; i < presentNodes.length; i++) {
        for (let j = i + 1; j < presentNodes.length; j++) {
          const key = `${presentNodes[i].id}|${presentNodes[j].id}`;
          coOccurrenceCount.set(key, (coOccurrenceCount.get(key) ?? 0) + 1);
        }
      }
    }

    const edges: KGEdge[] = [];
    const maxCount = Math.max(...coOccurrenceCount.values(), 1);

    for (const [key, count] of coOccurrenceCount.entries()) {
      const weight = count / maxCount;
      if (weight < threshold) continue;
      const [sourceId, targetId] = key.split("|");
      edges.push({
        sourceId: sourceId!,
        targetId: targetId!,
        relationshipType: "related_to",
        weight,
        inferredByLLM: false,
      });
    }
    return edges;
  }
}

// ---------------------------------------------------------------------------
// DynamicCurriculumAgent (Iteration 14)
// ---------------------------------------------------------------------------

/**
 * GraphMASAL-inspired dynamic curriculum agent.
 * arXiv:2602.00020 / arXiv:2511.11035: multi-agent negotiation for personalised
 * pathfinding on the knowledge graph.
 */
export class DynamicCurriculumAgent {
  /**
   * Generate a personalised curriculum path for a student using adaptive sequencing.
   * arXiv:2411.11520: pre-trained graph model predicts optimal document sequence.
   *
   * @param studentId        Unique student identifier.
   * @param targetConceptId  The final learning goal.
   * @param nodes            All curriculum nodes.
   * @param edges            All curriculum edges.
   * @param masteryMap       Current mastery per concept (0-1).
   */
  static generatePath(
    studentId: string,
    targetConceptId: string,
    nodes: KGNode[],
    edges: KGEdge[],
    masteryMap: Record<string, number>
  ): CurriculumPath {
    // Find all prerequisite nodes (BFS backwards from target)
    const prereqEdges = edges.filter((e) => e.relationshipType === "prerequisite_of");
    const reverseAdj = new Map<string, string[]>();
    for (const node of nodes) reverseAdj.set(node.id, []);
    for (const edge of prereqEdges) {
      reverseAdj.get(edge.targetId)?.push(edge.sourceId);
    }

    const required = new Set<string>();
    const queue = [targetConceptId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (required.has(current)) continue;
      required.add(current);
      for (const prereq of reverseAdj.get(current) ?? []) {
        if ((masteryMap[prereq] ?? 0) < 0.8) queue.push(prereq);
      }
    }

    // Topological sort for sequencing
    const orderedConceptIds = this.topologicalSort([...required], edges);

    // Estimate time (30 min per unmastered concept, 10 min for review)
    const estimatedTime = orderedConceptIds.reduce((sum, id) => {
      const mastery = masteryMap[id] ?? 0;
      return sum + (mastery < 0.8 ? 30 : 10);
    }, 0);

    // Prerequisite satisfaction: fraction of concepts properly ordered
    const prereqSatisfaction = this.computePrerequisiteSatisfaction(
      orderedConceptIds,
      prereqEdges
    );

    return {
      id: `path-${studentId}-${Date.now()}`,
      studentId,
      orderedConceptIds,
      estimatedTotalTime: estimatedTime,
      prerequisiteSatisfactionScore: prereqSatisfaction,
      generatedAt: Date.now(),
      lastAdaptedAt: Date.now(),
    };
  }

  /**
   * Topological sort of concept nodes respecting prerequisite edges.
   * Kahn's algorithm (BFS-based).
   */
  static topologicalSort(conceptIds: string[], edges: KGEdge[]): string[] {
    const idSet = new Set(conceptIds);
    const prereqEdges = edges.filter(
      (e) =>
        e.relationshipType === "prerequisite_of" &&
        idSet.has(e.sourceId) &&
        idSet.has(e.targetId)
    );

    const inDegree = new Map<string, number>();
    for (const id of conceptIds) inDegree.set(id, 0);
    for (const edge of prereqEdges) {
      inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1);
    }

    const adj = new Map<string, string[]>();
    for (const id of conceptIds) adj.set(id, []);
    for (const edge of prereqEdges) adj.get(edge.sourceId)!.push(edge.targetId);

    const queue = conceptIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
    const sorted: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const neighbour of adj.get(current) ?? []) {
        const deg = (inDegree.get(neighbour) ?? 1) - 1;
        inDegree.set(neighbour, deg);
        if (deg === 0) queue.push(neighbour);
      }
    }

    // Append any remaining (cycle-involved) nodes
    const remaining = conceptIds.filter((id) => !sorted.includes(id));
    return [...sorted, ...remaining];
  }

  private static computePrerequisiteSatisfaction(
    orderedIds: string[],
    prereqEdges: KGEdge[]
  ): number {
    if (orderedIds.length === 0) return 1;
    const positionMap = new Map(orderedIds.map((id, i) => [id, i]));
    let satisfied = 0;
    let total = 0;
    for (const edge of prereqEdges) {
      const srcPos = positionMap.get(edge.sourceId);
      const tgtPos = positionMap.get(edge.targetId);
      if (srcPos === undefined || tgtPos === undefined) continue;
      total++;
      if (srcPos < tgtPos) satisfied++;
    }
    return total > 0 ? satisfied / total : 1;
  }
}

// ---------------------------------------------------------------------------
// DualGraphBuilder (Iteration 15)
// ---------------------------------------------------------------------------

/**
 * Dual-Graph architecture (Concept Graph + Resource Graph).
 * arXiv:2506.22303: precise mapping between abstract learning goals and
 * concrete educational materials.
 */
export class DualGraphBuilder {
  /**
   * Build a DualGraphState by separating nodes into concept and resource graphs
   * and creating bridge edges.
   */
  static build(nodes: KGNode[], edges: KGEdge[]): DualGraphState {
    const conceptNodes = nodes.filter((n) => n.type === "concept" || n.type === "learning_objective");
    const resourceNodes = nodes.filter((n) => n.type === "resource");

    const conceptIds = new Set(conceptNodes.map((n) => n.id));
    const resourceIds = new Set(resourceNodes.map((n) => n.id));

    const conceptEdges = edges.filter(
      (e) => conceptIds.has(e.sourceId) && conceptIds.has(e.targetId)
    );
    const resourceEdges = edges.filter(
      (e) => resourceIds.has(e.sourceId) && resourceIds.has(e.targetId)
    );
    const bridgeEdges = edges.filter(
      (e) =>
        (conceptIds.has(e.sourceId) && resourceIds.has(e.targetId)) ||
        (resourceIds.has(e.sourceId) && conceptIds.has(e.targetId))
    );

    return {
      conceptGraph: { nodes: conceptNodes, edges: conceptEdges },
      resourceGraph: { nodes: resourceNodes, edges: resourceEdges },
      bridgeEdges,
    };
  }

  /**
   * Semantic Graph Completion: infer missing edges between nodes using
   * embedding similarity (arXiv:2401.13609).
   */
  static inferMissingEdges(
    nodes: KGNode[],
    existingEdges: KGEdge[],
    threshold: number = SEMANTIC_COMPLETION_THRESHOLD
  ): KGEdge[] {
    const newEdges: KGEdge[] = [];
    const existingPairs = new Set(existingEdges.map((e) => `${e.sourceId}|${e.targetId}`));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const pair = `${a.id}|${b.id}`;
        if (existingPairs.has(pair)) continue;
        if (a.embedding.length === 0 || b.embedding.length === 0) continue;

        const similarity = this.cosineSimilarity(a.embedding, b.embedding);
        if (similarity >= threshold) {
          newEdges.push({
            sourceId: a.id,
            targetId: b.id,
            relationshipType: "semantic_similar",
            weight: similarity,
            inferredByLLM: true,
          });
        }
      }
    }
    return newEdges;
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
    const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return normA > 0 && normB > 0 ? dot / (normA * normB) : 0;
  }
}

// ---------------------------------------------------------------------------
// CLLMRecEngine (Iteration 15)
// ---------------------------------------------------------------------------

/**
 * CLLMRec semantic alignment.
 * arXiv:2511.17041: aligns semantic concepts with learner cognitive states,
 * addressing the "cold start" problem in adaptive learning.
 */
export class CLLMRecEngine {
  /**
   * Rank candidate concepts by semantic relevance to a learner query
   * and compatibility with their current mastery state.
   *
   * @param queryEmbedding      Embedding of the learner's query.
   * @param candidates          Candidate concept nodes.
   * @param masteryMap          Current mastery per concept ID (0-1).
   */
  static rankCandidates(
    queryEmbedding: number[],
    candidates: KGNode[],
    masteryMap: Record<string, number>
  ): Array<{ node: KGNode; score: number }> {
    return candidates
      .map((node) => {
        const mastery = masteryMap[node.id] ?? 0;
        // Score = semantic similarity + novelty bonus (prefer concepts not yet mastered)
        const semanticScore =
          node.embedding.length > 0
            ? this.cosineSimilarity(queryEmbedding, node.embedding)
            : 0.5;
        const noveltyBonus = (1 - mastery) * 0.3; // recommend what student doesn't know yet
        const accessibilityPenalty = mastery < 0.3 ? 0.2 : 0; // avoid very unmastered prereqs
        return { node, score: Math.max(0, semanticScore + noveltyBonus - accessibilityPenalty) };
      })
      .sort((a, b) => b.score - a.score);
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
    const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return normA > 0 && normB > 0 ? dot / (normA * normB) : 0;
  }
}

// ---------------------------------------------------------------------------
// NeoHybridSearch (Iteration 16)
// ---------------------------------------------------------------------------

/**
 * Neo4j Hybrid Search: combines vector similarity with graph traversal.
 * NODES 2025: Cypher patterns + vector indexing for real-time GraphRAG.
 * AcademicRAG: KG as semantic bridge improving retrieval relevance.
 */
export class NeoHybridSearch {
  /**
   * Execute a hybrid search over the knowledge graph.
   * Phase 1: vector similarity → top-K candidates.
   * Phase 2: graph expansion → N-hop neighbourhood of each candidate.
   * Phase 3: re-rank by combined score.
   */
  static search(
    query: HybridSearchQuery,
    nodes: KGNode[],
    edges: KGEdge[]
  ): HybridSearchResult[] {
    // Phase 1: vector retrieval
    const vectorResults = this.vectorSearch(query.queryEmbedding, nodes, query.vectorTopK);

    // Phase 2: graph expansion
    const expandedNodeIds = new Set<string>(vectorResults.map((r) => r.node.id));
    for (const result of vectorResults) {
      const neighbours = this.expandNeighbourhood(result.node.id, edges, query.graphHops);
      neighbours.forEach((id) => expandedNodeIds.add(id));
    }

    // Phase 3: score all expanded nodes
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const results: HybridSearchResult[] = [];

    for (const nodeId of expandedNodeIds) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const vectorScore = this.cosineSimilarity(query.queryEmbedding, node.embedding);
      const graphScore = this.computeGraphCentrality(nodeId, edges, vectorResults.map((r) => r.node.id));
      const combinedScore = vectorScore * 0.6 + graphScore * 0.4;
      results.push({ node, vectorScore, graphScore, combinedScore });
    }

    return results.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /** Phase 1: cosine similarity ranking */
  private static vectorSearch(
    queryEmbedding: number[],
    nodes: KGNode[],
    topK: number
  ): HybridSearchResult[] {
    return nodes
      .filter((n) => n.embedding.length > 0)
      .map((n) => ({
        node: n,
        vectorScore: this.cosineSimilarity(queryEmbedding, n.embedding),
        graphScore: 0,
        combinedScore: 0,
      }))
      .sort((a, b) => b.vectorScore - a.vectorScore)
      .slice(0, topK);
  }

  /** Phase 2: BFS neighbourhood expansion */
  private static expandNeighbourhood(
    nodeId: string,
    edges: KGEdge[],
    hops: number
  ): string[] {
    const visited = new Set<string>([nodeId]);
    let frontier = [nodeId];
    for (let h = 0; h < hops; h++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const edge of edges) {
          if (edge.sourceId === id && !visited.has(edge.targetId)) {
            next.push(edge.targetId);
            visited.add(edge.targetId);
          }
        }
      }
      frontier = next;
    }
    visited.delete(nodeId);
    return [...visited];
  }

  /** Graph centrality: how many vector-top-K nodes can reach this node within 2 hops */
  private static computeGraphCentrality(
    nodeId: string,
    edges: KGEdge[],
    seedNodeIds: string[]
  ): number {
    if (seedNodeIds.length === 0) return 0;
    let reachableFrom = 0;
    for (const seedId of seedNodeIds) {
      const neighbours = this.expandNeighbourhood(seedId, edges, 2);
      if (neighbours.includes(nodeId)) reachableFrom++;
    }
    return reachableFrom / seedNodeIds.length;
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
    const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return normA > 0 && normB > 0 ? dot / (normA * normB) : 0;
  }
}

// ---------------------------------------------------------------------------
// FactRAGVerifier (Iteration 16)
// ---------------------------------------------------------------------------

/**
 * FactRAG: anchors LLM generation in the knowledge graph to reduce hallucinations.
 * Evidence-Based GraphRAG (2025): critical for educational accuracy (e.g., USMLE).
 */
export class FactRAGVerifier {
  /**
   * Verify a single LLM-generated claim against the knowledge graph.
   *
   * @param claim          The claim to verify.
   * @param nodes          Knowledge graph nodes.
   * @param edges          Knowledge graph edges.
   * @param groundingScore Optional pre-computed grounding score.
   */
  static verifyClaim(
    claim: string,
    nodes: KGNode[],
    edges: KGEdge[],
    groundingScore?: number
  ): FactRAGVerification {
    const lower = claim.toLowerCase();

    // Find nodes whose labels appear in the claim
    const supportingNodeIds: string[] = [];
    const contradictingNodeIds: string[] = [];

    for (const node of nodes) {
      if (lower.includes(node.label.toLowerCase())) {
        supportingNodeIds.push(node.id);
      }
    }

    // Contradictions: claim negates an edge relationship
    const negationPatterns = [/not\s+a/, /is\s+not/, /never/, /incorrect/, /false/];
    const hasNegation = negationPatterns.some((p) => p.test(lower));
    if (hasNegation && supportingNodeIds.length > 0) {
      contradictingNodeIds.push(...supportingNodeIds.splice(0, 1));
    }

    const computedGrounding = groundingScore ?? this.computeGroundingScore(
      supportingNodeIds.length,
      contradictingNodeIds.length,
      nodes.length
    );

    return {
      claim,
      supportingNodeIds,
      contradictingNodeIds,
      groundingScore: computedGrounding,
      verified: computedGrounding >= FACTRAG_FLAG_THRESHOLD && contradictingNodeIds.length === 0,
    };
  }

  private static computeGroundingScore(
    supportCount: number,
    contradictCount: number,
    totalNodes: number
  ): number {
    if (totalNodes === 0) return 0;
    const supportScore = Math.min(1, supportCount / Math.max(1, totalNodes * 0.05));
    const contradictPenalty = contradictCount * 0.3;
    return Math.max(0, supportScore - contradictPenalty);
  }

  /**
   * Batch verify multiple claims, returning the overall hallucination risk.
   */
  static batchVerify(
    claims: string[],
    nodes: KGNode[],
    edges: KGEdge[]
  ): {
    verifications: FactRAGVerification[];
   hallucinationRisk: number;
   unverifiedClaims: string[];
  } {
    const verifications = claims.map((c) => this.verifyClaim(c, nodes, edges));
    const unverifiedClaims = verifications
      .filter((v) => !v.verified)
      .map((v) => v.claim);
    const hallucinationRisk = unverifiedClaims.length / Math.max(1, claims.length);

    return { verifications, hallucinationRisk, unverifiedClaims };
  }
}
