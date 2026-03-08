/**
 * DeepTutor Integration Service
 * Integrates DeepTutor's QuestionGen (Active Recall Engine) and DR-in-KG (Knowledge Graph)
 * for advanced question generation and skill transfer learning
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Concept, QuizQuestion, ConceptMemoryState } from "@/lib/types/learning";

/**
 * DeepTutor Integration Service
 * Bridges mobile app with DeepTutor's backend capabilities
 */
export class DeepTutorIntegrationService {
  private static readonly API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://127.0.0.1:3000";

  private static async apiKeyHeaders(): Promise<Record<string, string>> {
    const key = (await AsyncStorage.getItem("GEMINI_API_KEY")) ?? "";
    return key ? { "x-gemini-api-key": key } : {};
  }

  private static async post<T>(path: string, body: unknown): Promise<T> {
    const headers = {
      "Content-Type": "application/json",
      ...(await this.apiKeyHeaders()),
    };
    const response = await fetch(`${this.API_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepTutor API error ${response.status}: ${errText}`);
    }
    return response.json() as Promise<T>;
  }

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

      const data = await this.post<{ questions: QuizQuestion[] }>("/api/deeptutor/questiongen", {
        concepts: conceptsWithDecay,
        difficulty,
        questionCount: count,
        triggerPopupOnHighDecay: true,
        decayThreshold: 40,
      });
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
      return await this.post("/api/deeptutor/knowledge-graph", {
        conceptName,
        conceptDescription,
        includeTransferLearning: true,
      });
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
      return await this.post("/api/deeptutor/deep-research", {
        conceptName,
        relatedConcepts,
        researchDepth: depth,
        includeApplications: true,
        includeMisconceptions: true,
      });
    } catch (error) {
      console.error("Error generating deep research explanation:", error);
      throw error;
    }
  }

  /**
   * Skill Transfer Engine: Map core schemas and explain via analogies
   */
  static async generateSkillTransferExplanation(
    newConcept: string,
    coreSchemas: string[],
    studentBackground: string[]
  ): Promise<{
    explanation: string;
    analogies: { schema: string; analogy: string }[];
    transferablePatterns: string[];
    practiceProblems: string[];
  }> {
    try {
      return await this.post("/api/deeptutor/skill-transfer", {
        newConcept,
        coreSchemas,
        studentBackground,
        includeAnalogies: true,
        includePracticeProblems: true,
      });
    } catch (error) {
      console.error("Error generating skill transfer explanation:", error);
      throw error;
    }
  }

  /**
   * Multi-Agent Problem Solving: Decompose complex problems into steps
   */
  static async solveComplexProblem(
    problem: string,
    conceptId: string,
    relatedConcepts: string[]
  ): Promise<{
    steps: string[];
    agentResponses: Array<{ agent: string; role: string; contribution: string }>;
    keyInsights: string[];
    alternativeSolutions: string[];
  }> {
    try {
      return await this.post("/api/deeptutor/multi-agent-solve", {
        problem,
        conceptId,
        relatedConcepts,
        agents: ["analyzer", "solver", "validator", "explainer"],
      });
    } catch (error) {
      console.error("Error solving complex problem:", error);
      throw error;
    }
  }

  /**
   * Exercise Generator: Create customized practice problems
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
      const data = await this.post<{ exercises: Array<{ id: string; problem: string; difficulty: string; hints: string[]; solution: string; explanation: string }> }>(
        "/api/deeptutor/exercise-gen",
        { conceptIds, masteryLevels, learningStyle, exerciseCount: count, includeHints: true, includeSolutions: true }
      );
      return data.exercises || [];
    } catch (error) {
      console.error("Error generating practice exercises:", error);
      throw error;
    }
  }

  /**
   * Idea Generation: Brainstorm novel applications across domains
   */
  static async generateIdeaConnections(
    conceptName: string,
    domains: string[] = ["science", "technology", "business", "art"]
  ): Promise<{
    ideas: Array<{ domain: string; application: string; novelty: number; feasibility: number }>;
    crossDomainConnections: string[];
    researchOpportunities: string[];
  }> {
    try {
      return await this.post("/api/deeptutor/idea-gen", {
        conceptName,
        domains,
        includeResearchOpportunities: true,
      });
    } catch (error) {
      console.error("Error generating idea connections:", error);
      throw error;
    }
  }

  /**
   * Personal Knowledge Base: Save entry
   */
  static async saveToKnowledgeBase(
    userId: string,
    conceptId: string,
    notes: string,
    tags: string[]
  ): Promise<{ success: boolean; id: string }> {
    try {
      return await this.post("/api/deeptutor/knowledge-base/save", {
        userId, conceptId, notes, tags, timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error saving to knowledge base:", error);
      throw error;
    }
  }

  /**
   * Personal Knowledge Base: Search
   */
  static async retrieveFromKnowledgeBase(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<
    Array<{ id: string; conceptId: string; notes: string; tags: string[]; relevanceScore: number }>
  > {
    try {
      const data = await this.post<{ results: Array<{ id: string; conceptId: string; notes: string; tags: string[]; relevanceScore: number }> }>(
        "/api/deeptutor/knowledge-base/search",
        { userId, query, limit }
      );
      return data.results || [];
    } catch (error) {
      console.error("Error retrieving from knowledge base:", error);
      throw error;
    }
  }
}
