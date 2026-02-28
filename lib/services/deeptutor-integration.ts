/**
 * DeepTutor Integration Service
 * Integrates DeepTutor's QuestionGen (Active Recall Engine) and DR-in-KG (Knowledge Graph)
 * for advanced question generation and skill transfer learning
 */

import { Concept, QuizQuestion, ConceptMemoryState } from "@/lib/types/learning";

/**
 * DeepTutor Integration Service
 * Bridges mobile app with DeepTutor's backend capabilities
 */
export class DeepTutorIntegrationService {
  private static readonly API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://127.0.0.1:3000";

  /**
   * QuestionGen Module: Generate adaptive quiz questions based on forgetting curve
   * Triggers pop-up quizzes on decaying concepts using spaced repetition schedule
   */
  static async generateAdaptiveQuestions(
    conceptIds: string[],
    memoryStates: Record<string, ConceptMemoryState>,
    difficulty: "easy" | "medium" | "hard" = "medium",
    count: number = 5
  ): Promise<QuizQuestion[]> {
    try {
      // Calculate decay factor for each concept based on retention score
      const conceptsWithDecay = conceptIds.map((id) => {
        const state = memoryStates[id];
        const decayFactor = state ? 100 - state.retentionScore : 100;
        return { conceptId: id, decayFactor, masteryLevel: state?.masteryLevel || "novice" };
      });

      const response = await fetch(`${this.API_BASE}/api/deeptutor/questiongen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concepts: conceptsWithDecay,
          difficulty,
          questionCount: count,
          // Trigger pop-up quiz on high decay (concepts being forgotten)
          triggerPopupOnHighDecay: true,
          decayThreshold: 40, // Trigger quiz if retention < 60%
        }),
      });

      if (!response.ok) throw new Error("Failed to generate adaptive questions");
      const data = await response.json();
      return data.questions || [];
    } catch (error) {
      console.error("Error generating adaptive questions:", error);
      throw error;
    }
  }

  /**
   * Knowledge Graph (DR-in-KG): Extract entity relationships for skill transfer
   * Maps concept relationships to enable transfer of learning to new topics
   */
  static async getConceptRelationships(
    conceptName: string,
    conceptDescription: string
  ): Promise<{
    prerequisites: { name: string; relationship: string }[];
    relatedConcepts: { name: string; relationship: string }[];
    advancedTopics: { name: string; relationship: string }[];
    transferableSkills: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/deeptutor/knowledge-graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName,
          conceptDescription,
          includeTransferLearning: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to get concept relationships");
      return await response.json();
    } catch (error) {
      console.error("Error getting concept relationships:", error);
      throw error;
    }
  }

  /**
   * Deep Research in Knowledge Graph: Generate comprehensive explanations
   * by pulling from specific knowledge graph nodes
   */
  static async generateDeepResearchExplanation(
    conceptName: string,
    relatedConcepts: string[],
    depth: "surface" | "intermediate" | "deep" = "intermediate"
  ): Promise<{
    mainExplanation: string;
    relatedConceptExplanations: Record<string, string>;
    keyInsights: string[];
    applicationExamples: string[];
    commonMisconceptions: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/deeptutor/deep-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName,
          relatedConcepts,
          researchDepth: depth,
          includeApplications: true,
          includeMisconceptions: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate deep research explanation");
      return await response.json();
    } catch (error) {
      console.error("Error generating deep research explanation:", error);
      throw error;
    }
  }

  /**
   * Skill Transfer Engine: Map core schemas (e.g., C programming, Linux architecture)
   * and use them to explain new complex topics through analogies and connections
   */
  static async generateSkillTransferExplanation(
    newConcept: string,
    coreSchemas: string[], // e.g., ["C programming", "Linux architecture"]
    studentBackground: string[]
  ): Promise<{
    explanation: string;
    analogies: { schema: string; analogy: string }[];
    transferablePatterns: string[];
    practiceProblems: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/deeptutor/skill-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newConcept,
          coreSchemas,
          studentBackground,
          includeAnalogies: true,
          includePracticeProblems: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate skill transfer explanation");
      return await response.json();
    } catch (error) {
      console.error("Error generating skill transfer explanation:", error);
      throw error;
    }
  }

  /**
   * Multi-Agent Problem Solving: Decompose complex problems into steps
   * using DeepTutor's multi-agent architecture
   */
  static async solveComplexProblem(
    problem: string,
    conceptId: string,
    relatedConcepts: string[]
  ): Promise<{
    steps: string[];
    agentResponses: Array<{
      agent: string;
      role: string;
      contribution: string;
    }>;
    keyInsights: string[];
    alternativeSolutions: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/deeptutor/multi-agent-solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          conceptId,
          relatedConcepts,
          // Multi-agent roles: Analyzer, Solver, Validator, Explainer
          agents: ["analyzer", "solver", "validator", "explainer"],
        }),
      });

      if (!response.ok) throw new Error("Failed to solve problem with multi-agent system");
      return await response.json();
    } catch (error) {
      console.error("Error solving complex problem:", error);
      throw error;
    }
  }

  /**
   * Exercise Generator: Create customized practice problems
   * that match student's mastery level and learning style
   */
  static async generatePracticeExercises(
    conceptIds: string[],
    masteryLevels: Record<string, string>,
    learningStyle: string,
    count: number = 5
  ): Promise<
    Array<{
      id: string;
      problem: string;
      difficulty: string;
      hints: string[];
      solution: string;
      explanation: string;
    }>
  > {
    try {
      const response = await fetch(`${this.API_BASE}/api/deeptutor/exercise-gen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptIds,
          masteryLevels,
          learningStyle,
          exerciseCount: count,
          includeHints: true,
          includeSolutions: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate practice exercises");
      const data = await response.json();
      return data.exercises || [];
    } catch (error) {
      console.error("Error generating practice exercises:", error);
      throw error;
    }
  }

  /**
   * Idea Generation: Brainstorm novel applications and connections
   * for learned concepts using DeepTutor's synthesis engine
   */
  static async generateIdeaConnections(
    conceptName: string,
    domains: string[] = ["science", "technology", "business", "art"]
  ): Promise<{
    ideas: Array<{
      domain: string;
      application: string;
      novelty: number; // 0-1 score
      feasibility: number; // 0-1 score
    }>;
    crossDomainConnections: string[];
    researchOpportunities: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/deeptutor/idea-gen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName,
          domains,
          includeResearchOpportunities: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate idea connections");
      return await response.json();
    } catch (error) {
      console.error("Error generating idea connections:", error);
      throw error;
    }
  }

  /**
   * Personal Knowledge Base: Build and manage user's knowledge repository
   * with persistent storage and retrieval
   */
  static async saveToKnowledgeBase(
    userId: string,
    conceptId: string,
    notes: string,
    tags: string[]
  ): Promise<{ success: boolean; id: string }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/deeptutor/knowledge-base/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          conceptId,
          notes,
          tags,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) throw new Error("Failed to save to knowledge base");
      return await response.json();
    } catch (error) {
      console.error("Error saving to knowledge base:", error);
      throw error;
    }
  }

  /**
   * Retrieve from Personal Knowledge Base
   */
  static async retrieveFromKnowledgeBase(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<
    Array<{
      id: string;
      conceptId: string;
      notes: string;
      tags: string[];
      relevanceScore: number;
    }>
  > {
    try {
      const response = await fetch(`${this.API_BASE}/api/deeptutor/knowledge-base/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          query,
          limit,
        }),
      });

      if (!response.ok) throw new Error("Failed to retrieve from knowledge base");
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error("Error retrieving from knowledge base:", error);
      throw error;
    }
  }
}
