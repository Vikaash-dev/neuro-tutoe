/**
 * Dynamic Curriculum Generation Service — Research Iteration 14
 *
 * Implements adaptive curriculum generation driven by knowledge graphs:
 *  - Dynamic Knowledge Expansion (arXiv:2602.00020): LLM-backed Curriculum Agent
 *    that extends a live Neo4j-style graph with newly generated concepts.
 *  - GraphMASAL (arXiv:2511.11035): Multi-agent system where specialised agents
 *    negotiate the optimal personalised learning path on the graph.
 *  - Adaptive Sequencing (arXiv:2411.11520): Pre-trained sequencing model that
 *    orders educational documents to satisfy prerequisites and logical progression.
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
// CURRICULUM DATA TYPES
// ============================================================================

export interface CurriculumNode {
  id: string;
  conceptName: string;
  description: string;
  learningObjectives: string[];
  estimatedDurationMinutes: number;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  prerequisites: string[]; // conceptName references
  resources: string[]; // URLs / document IDs
  graphNodeId: string; // linked GraphNode id
}

export interface LearnerProfile {
  learnerId: string;
  knownConcepts: string[];
  targetConcepts: string[];
  learningGoal: string;
  availableTimeMinutes: number;
  preferredDifficulty: CurriculumNode["difficulty"];
}

export interface CurriculumPath {
  learnerId: string;
  nodes: CurriculumNode[];
  /** Sequenced order of node IDs as recommended by the AdaptiveSequencer. */
  sequencedOrder: string[];
  totalDurationMinutes: number;
  createdAt: number;
}

export interface PathNegotiationResult {
  agreedPath: CurriculumNode[];
  agentContributions: Record<string, string>;
  confidence: number;
}

// ============================================================================
// CURRICULUM AGENT  (Dynamic Knowledge Expansion, arXiv:2602.00020)
// ============================================================================

/**
 * The Curriculum Agent uses an LLM (mocked here) to dynamically expand an
 * educational knowledge graph in real-time when a learner requests a concept
 * that does not yet exist in the graph.
 *
 * In production, the `expandGraph` method would call the Gemini / GPT API to
 * generate structured concept descriptions and then insert them into Neo4j.
 */
export class CurriculumAgent {
  private graphFactory: KnowledgeGraphFactory;
  private traversal: AdaptiveGraphTraversal;

  constructor() {
    this.graphFactory = new KnowledgeGraphFactory();
    this.traversal = new AdaptiveGraphTraversal();
  }

  /**
   * Ensure `conceptName` exists in `graph`.  If it is absent, the agent
   * synthesises a new node (and its immediate prerequisites) via LLM and
   * inserts them into the graph.
   *
   * @returns The graph node for the requested concept.
   */
  async ensureConcept(
    graph: EducationalKnowledgeGraph,
    conceptName: string,
    subject: string = "general"
  ): Promise<GraphNode> {
    // Check if a node with this label already exists
    const existing = this.findNodeByLabel(graph, conceptName);
    if (existing) return existing;

    // Generate concept metadata via LLM (mocked)
    const generated = await this.generateConceptMetadata(conceptName, subject);

    // Insert new concept node
    const newNode = this.graphFactory.addNode(
      graph,
      conceptName,
      generated.description,
      "concept",
      {
        subject,
        difficulty: generated.difficulty,
        learningObjectives: generated.learningObjectives,
        generatedByAgent: true,
      }
    );

    // Insert prerequisite nodes and edges recursively (one level deep)
    for (const prereqName of generated.prerequisites) {
      const prereqNode = this.findNodeByLabel(graph, prereqName) ??
        this.graphFactory.addNode(graph, prereqName, `Prerequisite: ${prereqName}`, "prerequisite", {
          subject,
          generatedByAgent: true,
        });

      this.graphFactory.addEdge(graph, prereqNode.id, newNode.id, "prerequisite_of", 0.9);
    }

    graph.updatedAt = Date.now();
    return newNode;
  }

  /**
   * Build a {@link CurriculumNode} representation for a given graph node.
   */
  buildCurriculumNode(graphNode: GraphNode): CurriculumNode {
    const difficulty =
      (graphNode.metadata["difficulty"] as CurriculumNode["difficulty"]) ?? "intermediate";
    const learningObjectives =
      (graphNode.metadata["learningObjectives"] as string[]) ??
      [`Understand ${graphNode.label}`, `Apply ${graphNode.label} in practice`];

    return {
      id: `curr_${graphNode.id}`,
      conceptName: graphNode.label,
      description: graphNode.content,
      learningObjectives,
      estimatedDurationMinutes: this.estimateDuration(difficulty),
      difficulty,
      prerequisites: [],
      resources: [],
      graphNodeId: graphNode.id,
    };
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private findNodeByLabel(graph: EducationalKnowledgeGraph, label: string): GraphNode | undefined {
    for (const node of graph.nodes.values()) {
      if (node.label.toLowerCase() === label.toLowerCase()) return node;
    }
    return undefined;
  }

  /**
   * Mock LLM call — replace with real Gemini/GPT call in production.
   */
  private async generateConceptMetadata(
    conceptName: string,
    subject: string
  ): Promise<{
    description: string;
    difficulty: CurriculumNode["difficulty"];
    learningObjectives: string[];
    prerequisites: string[];
  }> {
    // Simulated async LLM response
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      description: `${conceptName} is a key concept in ${subject} that forms the foundation for deeper understanding.`,
      difficulty: "intermediate",
      learningObjectives: [
        `Define and explain ${conceptName}`,
        `Apply ${conceptName} to solve real-world problems`,
        `Identify relationships between ${conceptName} and related concepts`,
      ],
      prerequisites: [],
    };
  }

  private estimateDuration(difficulty: CurriculumNode["difficulty"]): number {
    const map: Record<CurriculumNode["difficulty"], number> = {
      beginner: 15,
      intermediate: 30,
      advanced: 45,
      expert: 60,
    };
    return map[difficulty];
  }
}

// ============================================================================
// GRAPHMASAL PATHFINDER  (Multi-agent negotiation, arXiv:2511.11035)
// ============================================================================

/** A single negotiation agent representing one learning dimension. */
interface NegotiationAgent {
  name: string;
  priority: "efficiency" | "coverage" | "difficulty" | "prerequisites";
  evaluate(path: CurriculumNode[], profile: LearnerProfile): number;
}

/**
 * Multi-agent pathfinder that instantiates specialised agents for different
 * learning dimensions and negotiates a consensus optimal path on the graph.
 *
 * Inspired by GraphMASAL (arXiv:2511.11035) where agents represent different
 * learning goals or knowledge states.
 */
export class GraphMASALPathfinder {
  private agents: NegotiationAgent[];

  constructor() {
    this.agents = [
      {
        name: "EfficiencyAgent",
        priority: "efficiency",
        evaluate: (path, profile) => {
          const totalTime = path.reduce((s, n) => s + n.estimatedDurationMinutes, 0);
          // Prefer paths that fit within available time
          return totalTime <= profile.availableTimeMinutes ? 1.0 : profile.availableTimeMinutes / totalTime;
        },
      },
      {
        name: "CoverageAgent",
        priority: "coverage",
        evaluate: (path, profile) => {
          const covered = path.filter((n) =>
            profile.targetConcepts.some((t) => t.toLowerCase() === n.conceptName.toLowerCase())
          ).length;
          return profile.targetConcepts.length > 0 ? covered / profile.targetConcepts.length : 1.0;
        },
      },
      {
        name: "DifficultyAgent",
        priority: "difficulty",
        evaluate: (path, profile) => {
          const difficultyMap: Record<CurriculumNode["difficulty"], number> = {
            beginner: 1,
            intermediate: 2,
            advanced: 3,
            expert: 4,
          };
          const preferred = difficultyMap[profile.preferredDifficulty];
          const avg =
            path.reduce((s, n) => s + difficultyMap[n.difficulty], 0) / Math.max(path.length, 1);
          return 1 - Math.abs(avg - preferred) / 3;
        },
      },
      {
        name: "PrerequisiteAgent",
        priority: "prerequisites",
        evaluate: (path) => {
          // Check that prerequisites appear before dependents in the path
          let satisfied = 0;
          for (let i = 0; i < path.length; i++) {
            const node = path[i];
            const prereqsSatisfied = node.prerequisites.every((prereqName) => {
              const prereqIdx = path.findIndex(
                (p) => p.conceptName.toLowerCase() === prereqName.toLowerCase()
              );
              return prereqIdx < i;
            });
            if (prereqsSatisfied) satisfied++;
          }
          return path.length > 0 ? satisfied / path.length : 1.0;
        },
      },
    ];
  }

  /**
   * Given a set of candidate curriculum nodes and a learner profile, negotiate
   * the optimal learning path through multiple rounds of agent scoring and voting.
   *
   * @param candidates - All possible curriculum nodes to consider.
   * @param profile - Learner's profile and constraints.
   * @param negotiationRounds - Number of negotiation rounds (default 3).
   */
  negotiate(
    candidates: CurriculumNode[],
    profile: LearnerProfile,
    negotiationRounds: number = 3
  ): PathNegotiationResult {
    if (candidates.length === 0) {
      return { agreedPath: [], agentContributions: {}, confidence: 0 };
    }

    // Filter out already-known concepts
    let pool = candidates.filter(
      (c) => !profile.knownConcepts.some((k) => k.toLowerCase() === c.conceptName.toLowerCase())
    );

    // Initial path ordering by prerequisite then difficulty
    let currentPath = this.initialOrder(pool, profile);

    // Iterative negotiation
    for (let round = 0; round < negotiationRounds; round++) {
      currentPath = this.negotiationRound(currentPath, pool, profile);
    }

    // Gather agent contributions
    const agentContributions: Record<string, string> = {};
    for (const agent of this.agents) {
      const score = agent.evaluate(currentPath, profile);
      agentContributions[agent.name] = `Score: ${score.toFixed(2)} (priority: ${agent.priority})`;
    }

    const confidence =
      this.agents.reduce((s, a) => s + a.evaluate(currentPath, profile), 0) / this.agents.length;

    return { agreedPath: currentPath, agentContributions, confidence };
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private initialOrder(pool: CurriculumNode[], profile: LearnerProfile): CurriculumNode[] {
    // Sort: target concepts first, then by difficulty ascending
    const difficultyOrder: Record<CurriculumNode["difficulty"], number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };

    return [...pool].sort((a, b) => {
      const aIsTarget = profile.targetConcepts.includes(a.conceptName) ? -1 : 1;
      const bIsTarget = profile.targetConcepts.includes(b.conceptName) ? -1 : 1;
      if (aIsTarget !== bIsTarget) return aIsTarget - bIsTarget;
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
  }

  private negotiationRound(
    current: CurriculumNode[],
    pool: CurriculumNode[],
    profile: LearnerProfile
  ): CurriculumNode[] {
    // Each agent proposes a small swap to improve their metric
    let best = current;
    let bestScore = this.aggregateScore(current, profile);

    for (let i = 0; i < current.length - 1; i++) {
      const swapped = [...current];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      const swappedScore = this.aggregateScore(swapped, profile);
      if (swappedScore > bestScore) {
        bestScore = swappedScore;
        best = swapped;
      }
    }

    return best;
  }

  private aggregateScore(path: CurriculumNode[], profile: LearnerProfile): number {
    return (
      this.agents.reduce((sum, agent) => sum + agent.evaluate(path, profile), 0) /
      this.agents.length
    );
  }
}

// ============================================================================
// ADAPTIVE SEQUENCER  (arXiv:2411.11520)
// ============================================================================

/**
 * Sequences an unordered set of curriculum nodes into a pedagogically optimal
 * order that respects prerequisite dependencies and promotes smooth difficulty
 * progression — inspired by the pre-trained sequencing model in arXiv:2411.11520.
 */
export class AdaptiveSequencer {
  /**
   * Produce a sequenced list of {@link CurriculumNode} IDs from an unordered set.
   *
   * The algorithm performs a topological sort (prerequisite → dependent) and
   * within each topological level orders nodes by ascending difficulty.
   *
   * @param nodes - Unordered curriculum nodes.
   * @returns Array of node IDs in recommended learning order.
   */
  sequence(nodes: CurriculumNode[]): string[] {
    if (nodes.length === 0) return [];

    const difficultyOrder: Record<CurriculumNode["difficulty"], number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };

    // Build adjacency for topological sort
    const inDegree: Record<string, number> = {};
    const outEdges: Record<string, string[]> = {};
    const idByName: Record<string, string> = {};

    for (const node of nodes) {
      inDegree[node.id] = 0;
      outEdges[node.id] = [];
      idByName[node.conceptName.toLowerCase()] = node.id;
    }

    for (const node of nodes) {
      for (const prereqName of node.prerequisites) {
        const prereqId = idByName[prereqName.toLowerCase()];
        if (prereqId && prereqId !== node.id) {
          outEdges[prereqId].push(node.id);
          inDegree[node.id] = (inDegree[node.id] ?? 0) + 1;
        }
      }
    }

    // Kahn's algorithm with difficulty tie-breaking
    const queue: CurriculumNode[] = nodes
      .filter((n) => (inDegree[n.id] ?? 0) === 0)
      .sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);

    const result: string[] = [];

    while (queue.length > 0) {
      // Pick the easiest available node
      queue.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
      const node = queue.shift()!;
      result.push(node.id);

      for (const neighbourId of outEdges[node.id] ?? []) {
        inDegree[neighbourId] = (inDegree[neighbourId] ?? 1) - 1;
        if (inDegree[neighbourId] === 0) {
          const neighbour = nodes.find((n) => n.id === neighbourId);
          if (neighbour) queue.push(neighbour);
        }
      }
    }

    // Append any remaining nodes (handles cycles gracefully)
    const sequencedSet = new Set(result);
    for (const node of nodes) {
      if (!sequencedSet.has(node.id)) result.push(node.id);
    }

    return result;
  }

  /**
   * Build a complete {@link CurriculumPath} for a learner given a set of graph
   * nodes and their profile.
   */
  buildPath(
    graphNodes: GraphNode[],
    profile: LearnerProfile,
    curriculumAgent: CurriculumAgent
  ): CurriculumPath {
    const curriculumNodes = graphNodes.map((n) => curriculumAgent.buildCurriculumNode(n));
    const sequencedOrder = this.sequence(curriculumNodes);

    const totalDuration = curriculumNodes.reduce((s, n) => s + n.estimatedDurationMinutes, 0);

    return {
      learnerId: profile.learnerId,
      nodes: curriculumNodes,
      sequencedOrder,
      totalDurationMinutes: totalDuration,
      createdAt: Date.now(),
    };
  }
}

// ============================================================================
// CURRICULUM GENERATION ORCHESTRATOR
// ============================================================================

/**
 * High-level orchestrator that ties together the Curriculum Agent,
 * GraphMASAL Pathfinder, and Adaptive Sequencer to produce a complete
 * personalised curriculum path for a learner.
 */
export class CurriculumGenerationOrchestrator {
  private curriculumAgent: CurriculumAgent;
  private pathfinder: GraphMASALPathfinder;
  private sequencer: AdaptiveSequencer;

  constructor() {
    this.curriculumAgent = new CurriculumAgent();
    this.pathfinder = new GraphMASALPathfinder();
    this.sequencer = new AdaptiveSequencer();
  }

  /**
   * Generate a personalised curriculum path for `profile` from `graph`.
   *
   * Steps:
   * 1. Ensure all target concepts exist in graph (Curriculum Agent expansion).
   * 2. Build curriculum nodes from relevant graph nodes.
   * 3. Negotiate optimal path via GraphMASAL.
   * 4. Sequence the agreed path using AdaptiveSequencer.
   */
  async generatePath(
    graph: EducationalKnowledgeGraph,
    profile: LearnerProfile
  ): Promise<CurriculumPath> {
    // Step 1 — Ensure target concepts exist in graph
    for (const conceptName of profile.targetConcepts) {
      await this.curriculumAgent.ensureConcept(graph, conceptName);
    }

    // Step 2 — Build curriculum nodes for all graph nodes
    const allCurriculumNodes = [...graph.nodes.values()].map((n) =>
      this.curriculumAgent.buildCurriculumNode(n)
    );

    // Step 3 — Multi-agent negotiation
    const negotiationResult = this.pathfinder.negotiate(allCurriculumNodes, profile);

    // Step 4 — Adaptive sequencing of the agreed path
    const sequencedOrder = this.sequencer.sequence(negotiationResult.agreedPath);

    const totalDuration = negotiationResult.agreedPath.reduce(
      (s, n) => s + n.estimatedDurationMinutes,
      0
    );

    return {
      learnerId: profile.learnerId,
      nodes: negotiationResult.agreedPath,
      sequencedOrder,
      totalDurationMinutes: totalDuration,
      createdAt: Date.now(),
    };
  }
}

// Singleton instances
export const curriculumAgent = new CurriculumAgent();
export const pathfinder = new GraphMASALPathfinder();
export const adaptiveSequencer = new AdaptiveSequencer();
export const curriculumOrchestrator = new CurriculumGenerationOrchestrator();
