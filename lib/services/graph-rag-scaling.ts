/**
 * GraphRAG Scaling Service — Research Iteration 13
 *
 * Implements scalable GraphRAG techniques for massive educational knowledge graphs:
 *  - Adaptive Graph Traversal (PolyG, arXiv:2504.02112): dynamically explores relevant
 *    subgraphs to reduce computational overhead on large curriculum graphs.
 *  - Graph Foundation Model reasoning (GFM-RAG, arXiv:2502.01113): multi-hop reasoning
 *    for nuanced prerequisite dependency analysis.
 *  - Efficient KG Construction (arXiv:2507.03226): dependency-based extraction from
 *    unstructured educational text to rapidly build structured knowledge graphs.
 */

// ============================================================================
// GRAPH DATA TYPES
// ============================================================================

export type NodeType = "concept" | "resource" | "prerequisite" | "topic" | "skill";
export type EdgeType = "prerequisite_of" | "related_to" | "part_of" | "leads_to" | "requires";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  content: string;
  /** Simplified embedding vector used for semantic similarity scoring. */
  embedding: number[];
  /** Arbitrary metadata (difficulty, subject, source, etc.). */
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  /** Relationship strength in [0, 1]. */
  weight: number;
  metadata: Record<string, unknown>;
}

export interface EducationalKnowledgeGraph {
  id: string;
  name: string;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  createdAt: number;
  updatedAt: number;
}

export interface SubgraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Relevance score for this subgraph relative to the query. */
  relevanceScore: number;
  /** Traversal depth reached. */
  depth: number;
}

export interface MultiHopReasoningResult {
  answer: string;
  supportingNodes: GraphNode[];
  reasoningPath: string[];
  confidence: number;
  hopsUsed: number;
}

export interface DependencyExtractionResult {
  nodes: Omit<GraphNode, "id" | "embedding" | "createdAt">[];
  edges: Omit<GraphEdge, "id">[];
  /** Concepts identified in the source text. */
  concepts: string[];
  /** Prerequisite relationships inferred from the text. */
  prerequisites: Array<{ concept: string; prerequisite: string; confidence: number }>;
}

// ============================================================================
// ADAPTIVE GRAPH TRAVERSAL  (PolyG-inspired, arXiv:2504.02112)
// ============================================================================

/**
 * Performs adaptive beam-search traversal over an educational knowledge graph.
 *
 * Rather than exhaustive BFS/DFS, it prioritises neighbours with the highest
 * semantic relevance to the query at each step, dramatically reducing the nodes
 * visited on massive curriculum graphs while maintaining retrieval quality.
 */
export class AdaptiveGraphTraversal {
  /**
   * Traverse the graph starting from `startNodeId`, expanding only the
   * `beamWidth` most relevant neighbours at each depth level.
   *
   * @param graph - The knowledge graph to traverse.
   * @param query - Natural-language query driving relevance scoring.
   * @param startNodeId - ID of the entry node.
   * @param maxDepth - Maximum traversal depth (default 3).
   * @param beamWidth - Number of top neighbours kept per step (default 5).
   */
  traverseRelevantSubgraph(
    graph: EducationalKnowledgeGraph,
    query: string,
    startNodeId: string,
    maxDepth: number = 3,
    beamWidth: number = 5
  ): SubgraphResult {
    const startNode = graph.nodes.get(startNodeId);
    if (!startNode) {
      return { nodes: [], edges: [], relevanceScore: 0, depth: 0 };
    }

    const queryEmbedding = this.embed(query);
    const visitedIds = new Set<string>([startNodeId]);
    const resultNodes: GraphNode[] = [startNode];
    const resultEdges: GraphEdge[] = [];

    let frontier: GraphNode[] = [startNode];
    let currentDepth = 0;

    while (frontier.length > 0 && currentDepth < maxDepth) {
      const candidates: Array<{ node: GraphNode; edge: GraphEdge; score: number }> = [];

      for (const current of frontier) {
        // Collect all outgoing and incoming edges from this node
        const connectedEdges = graph.edges.filter(
          (e) => e.sourceId === current.id || e.targetId === current.id
        );

        for (const edge of connectedEdges) {
          const neighbourId = edge.sourceId === current.id ? edge.targetId : edge.sourceId;
          if (visitedIds.has(neighbourId)) continue;

          const neighbour = graph.nodes.get(neighbourId);
          if (!neighbour) continue;

          // Score neighbour by semantic similarity to query + edge weight
          const similarity = this.cosineSimilarity(queryEmbedding, neighbour.embedding);
          const score = similarity * 0.7 + edge.weight * 0.3;

          candidates.push({ node: neighbour, edge, score });
        }
      }

      // Beam selection — keep only the top-beamWidth candidates
      candidates.sort((a, b) => b.score - a.score);
      const selected = candidates.slice(0, beamWidth);

      frontier = [];
      for (const { node, edge } of selected) {
        if (!visitedIds.has(node.id)) {
          visitedIds.add(node.id);
          resultNodes.push(node);
          resultEdges.push(edge);
          frontier.push(node);
        }
      }

      currentDepth++;
    }

    const overallRelevance =
      resultNodes.length > 0
        ? resultNodes.reduce((sum, n) => sum + this.cosineSimilarity(queryEmbedding, n.embedding), 0) /
          resultNodes.length
        : 0;

    return {
      nodes: resultNodes,
      edges: resultEdges,
      relevanceScore: overallRelevance,
      depth: currentDepth,
    };
  }

  /**
   * Find the best entry node in the graph for a given query.
   * Useful when there is no predetermined start node.
   */
  findBestEntryNode(graph: EducationalKnowledgeGraph, query: string): GraphNode | null {
    const queryEmbedding = this.embed(query);
    let bestNode: GraphNode | null = null;
    let bestScore = -Infinity;

    for (const node of graph.nodes.values()) {
      const score = this.cosineSimilarity(queryEmbedding, node.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    return bestNode;
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  /** Lightweight hash-based embedding (128-dim). Replace with a real model in production. */
  embed(text: string): number[] {
    const vec = new Array(128).fill(0) as number[];
    for (let i = 0; i < text.length; i++) {
      vec[i % 128] += text.charCodeAt(i) / 256;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }
}

// ============================================================================
// MULTI-HOP REASONER  (GFM-RAG-inspired, arXiv:2502.01113)
// ============================================================================

/**
 * Executes multi-hop reasoning across a knowledge graph to answer complex
 * educational queries that require traversing multiple prerequisite links.
 *
 * Inspired by the Graph Foundation Model (GFM-RAG) approach which learns
 * complex relationships directly from graph structures.
 */
export class MultiHopReasoner {
  private traversal: AdaptiveGraphTraversal;

  constructor() {
    this.traversal = new AdaptiveGraphTraversal();
  }

  /**
   * Answer `query` by performing multi-hop reasoning over `graph`.
   *
   * @param graph - Knowledge graph to reason over.
   * @param query - Educational question or concept to explain.
   * @param maxHops - Maximum reasoning hops (default 4).
   */
  async reason(
    graph: EducationalKnowledgeGraph,
    query: string,
    maxHops: number = 4
  ): Promise<MultiHopReasoningResult> {
    // Step 1 — Locate the best entry node
    const entryNode = this.traversal.findBestEntryNode(graph, query);
    if (!entryNode) {
      return {
        answer: "No relevant concepts found in the knowledge graph.",
        supportingNodes: [],
        reasoningPath: [],
        confidence: 0,
        hopsUsed: 0,
      };
    }

    // Step 2 — Collect a relevant subgraph
    const subgraph = this.traversal.traverseRelevantSubgraph(
      graph,
      query,
      entryNode.id,
      maxHops,
      6
    );

    // Step 3 — Build a reasoning chain from the traversal path
    const reasoningPath = this.buildReasoningPath(subgraph.nodes, graph);

    // Step 4 — Synthesise an answer from the supporting nodes
    const answer = this.synthesiseAnswer(query, subgraph.nodes, reasoningPath);

    const confidence = Math.min(subgraph.relevanceScore * (1 + subgraph.nodes.length * 0.05), 1);

    return {
      answer,
      supportingNodes: subgraph.nodes,
      reasoningPath,
      confidence,
      hopsUsed: subgraph.depth,
    };
  }

  private buildReasoningPath(nodes: GraphNode[], graph: EducationalKnowledgeGraph): string[] {
    if (nodes.length === 0) return [];

    const path: string[] = [nodes[0].label];
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const connectingEdge = graph.edges.find(
        (e) =>
          (e.sourceId === prev.id && e.targetId === curr.id) ||
          (e.sourceId === curr.id && e.targetId === prev.id)
      );
      if (connectingEdge) {
        path.push(`—[${connectingEdge.type}]→`);
      }
      path.push(curr.label);
    }
    return path;
  }

  private synthesiseAnswer(
    query: string,
    supportingNodes: GraphNode[],
    reasoningPath: string[]
  ): string {
    if (supportingNodes.length === 0) {
      return `Could not find sufficient graph context to answer: "${query}".`;
    }

    const conceptList = supportingNodes
      .slice(0, 5)
      .map((n) => n.label)
      .join(", ");

    const pathStr = reasoningPath.join(" ");

    return (
      `Based on multi-hop graph reasoning across ${supportingNodes.length} related concepts ` +
      `(${conceptList}), the answer to "${query}" can be understood through the ` +
      `following chain of relationships: ${pathStr}. ` +
      `Key insight: ${supportingNodes[0]?.content ?? ""}`
    );
  }
}

// ============================================================================
// EFFICIENT KG CONSTRUCTOR  (arXiv:2507.03226)
// ============================================================================

/**
 * Extracts concept nodes and prerequisite edges from unstructured educational
 * text using dependency-based parsing heuristics.
 *
 * In production this would use a fine-tuned NLP model; here we implement
 * rule-based extraction that can be swapped for a real model call.
 */
export class DependencyKGConstructor {
  private traversal = new AdaptiveGraphTraversal();

  /**
   * Parse raw educational text (textbook chapter, lecture notes, etc.) and
   * return a list of concept nodes and prerequisite edges suitable for
   * insertion into an {@link EducationalKnowledgeGraph}.
   *
   * @param text - Source educational text.
   * @param subject - Subject area (used to tag nodes).
   */
  extractFromText(text: string, subject: string = "general"): DependencyExtractionResult {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);

    const concepts = new Set<string>();
    const prerequisites: DependencyExtractionResult["prerequisites"] = [];

    // Simple pattern-matching heuristics — in production replace with NLP model
    const prerequisitePatterns = [
      /(?:requires?|needs?|depends? on|is based on|assumes?)\s+([A-Za-z][A-Za-z\s]{2,30})/i,
      /(?:before|prior to|first learn)\s+([A-Za-z][A-Za-z\s]{2,30})/i,
      /([A-Za-z][A-Za-z\s]{2,30})\s+(?:is a prerequisite|must be known|is required)/i,
    ];

    const conceptPatterns = [
      /(?:concept of|principle of|theory of|definition of|meaning of)\s+([A-Za-z][A-Za-z\s]{2,30})/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|are|refers to|describes)/,
    ];

    for (const sentence of sentences) {
      // Extract concept mentions
      for (const pattern of conceptPatterns) {
        const match = pattern.exec(sentence);
        if (match?.[1]) {
          concepts.add(match[1].trim());
        }
      }

      // Extract prerequisite relationships
      for (const pattern of prerequisitePatterns) {
        const match = pattern.exec(sentence);
        if (match?.[1]) {
          const prerequisiteConcept = match[1].trim();
          concepts.add(prerequisiteConcept);

          // Naively associate it with the last extracted concept if any
          const lastConcept = [...concepts].at(-2);
          if (lastConcept && lastConcept !== prerequisiteConcept) {
            prerequisites.push({
              concept: lastConcept,
              prerequisite: prerequisiteConcept,
              confidence: 0.7,
            });
          }
        }
      }
    }

    const conceptList = [...concepts];

    // Build node descriptors
    const nodes: DependencyExtractionResult["nodes"] = conceptList.map((c) => ({
      type: "concept" as NodeType,
      label: c,
      content: `Concept: ${c} (extracted from ${subject} material)`,
      metadata: { subject, extractedAt: Date.now() },
    }));

    // Build edge descriptors from prerequisite list
    const edges: DependencyExtractionResult["edges"] = prerequisites.map((p, idx) => ({
      sourceId: `node_${conceptList.indexOf(p.prerequisite)}`,
      targetId: `node_${conceptList.indexOf(p.concept)}`,
      type: "prerequisite_of" as EdgeType,
      weight: p.confidence,
      metadata: { extractedRelationship: true },
    }));

    return { nodes, edges, concepts: conceptList, prerequisites };
  }

  /**
   * Insert the extracted nodes and edges into an existing knowledge graph.
   *
   * @param graph - Target knowledge graph (mutated in place).
   * @param extraction - Result from {@link extractFromText}.
   */
  insertIntoGraph(
    graph: EducationalKnowledgeGraph,
    extraction: DependencyExtractionResult
  ): void {
    const idMap: Record<number, string> = {};

    extraction.nodes.forEach((nodeDesc, idx) => {
      const nodeId = `node_${Date.now()}_${idx}`;
      idMap[idx] = nodeId;

      const node: GraphNode = {
        id: nodeId,
        type: nodeDesc.type,
        label: nodeDesc.label,
        content: nodeDesc.content,
        embedding: this.traversal.embed(nodeDesc.content),
        metadata: nodeDesc.metadata,
        createdAt: Date.now(),
      };
      graph.nodes.set(nodeId, node);
    });

    extraction.edges.forEach((edgeDesc, idx) => {
      const srcIdx = parseInt(edgeDesc.sourceId.replace("node_", ""), 10);
      const tgtIdx = parseInt(edgeDesc.targetId.replace("node_", ""), 10);

      if (idMap[srcIdx] !== undefined && idMap[tgtIdx] !== undefined) {
        const edge: GraphEdge = {
          id: `edge_${Date.now()}_${idx}`,
          sourceId: idMap[srcIdx],
          targetId: idMap[tgtIdx],
          type: edgeDesc.type,
          weight: edgeDesc.weight,
          metadata: edgeDesc.metadata,
        };
        graph.edges.push(edge);
      }
    });

    graph.updatedAt = Date.now();
  }
}

// ============================================================================
// KNOWLEDGE GRAPH FACTORY
// ============================================================================

/**
 * Convenience factory for creating and managing {@link EducationalKnowledgeGraph} instances.
 */
export class KnowledgeGraphFactory {
  private graphs: Map<string, EducationalKnowledgeGraph> = new Map();

  create(name: string): EducationalKnowledgeGraph {
    const graph: EducationalKnowledgeGraph = {
      id: `kg_${Date.now()}`,
      name,
      nodes: new Map(),
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.graphs.set(graph.id, graph);
    return graph;
  }

  get(graphId: string): EducationalKnowledgeGraph | undefined {
    return this.graphs.get(graphId);
  }

  addNode(
    graph: EducationalKnowledgeGraph,
    label: string,
    content: string,
    type: NodeType = "concept",
    metadata: Record<string, unknown> = {}
  ): GraphNode {
    const traversal = new AdaptiveGraphTraversal();
    const node: GraphNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      label,
      content,
      embedding: traversal.embed(`${label} ${content}`),
      metadata,
      createdAt: Date.now(),
    };
    graph.nodes.set(node.id, node);
    graph.updatedAt = Date.now();
    return node;
  }

  addEdge(
    graph: EducationalKnowledgeGraph,
    sourceId: string,
    targetId: string,
    type: EdgeType,
    weight: number = 0.8
  ): GraphEdge | null {
    if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) return null;

    const edge: GraphEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sourceId,
      targetId,
      type,
      weight,
      metadata: {},
    };
    graph.edges.push(edge);
    graph.updatedAt = Date.now();
    return edge;
  }
}

// Singleton instances
export const adaptiveTraversal = new AdaptiveGraphTraversal();
export const multiHopReasoner = new MultiHopReasoner();
export const dependencyConstructor = new DependencyKGConstructor();
export const knowledgeGraphFactory = new KnowledgeGraphFactory();
