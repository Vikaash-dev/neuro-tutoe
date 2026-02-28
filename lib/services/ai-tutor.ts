/**
 * AI Tutor Service
 * Handles communication with AI backend for Feynman-style teaching
 * Implements DeepTutor's multi-agent problem solving approach
 */

import { Concept, AITutorResponse, StudentMentalModel, ConceptExplanation } from "@/lib/types/learning";

/**
 * AI Tutor Service
 * Communicates with backend LLM service (Gemini via Manus server)
 */
export class AITutorService {
  private static readonly API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://127.0.0.1:3000";

  /**
   * Generate Feynman-style simple explanation for a concept
   * Step 1: Choose concept and explain simply
   */
  static async generateSimpleExplanation(
    concept: Concept,
    mentalModel: StudentMentalModel
  ): Promise<ConceptExplanation> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/explain-simple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName: concept.name,
          description: concept.description,
          keyPoints: concept.keyPoints,
          commonMisconceptions: concept.commonMisconceptions,
          realWorldApplications: concept.realWorldApplications,
          learningStyle: mentalModel.learningStyle,
          explanationDepth: mentalModel.explanationDepth,
          communicationPreference: mentalModel.communicationPreference,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate explanation");
      return await response.json();
    } catch (error) {
      console.error("Error generating simple explanation:", error);
      throw error;
    }
  }

  /**
   * Analyze student's Feynman explanation
   * Step 2: Student teaches back, AI identifies gaps
   */
  static async analyzeStudentExplanation(
    conceptId: string,
    studentExplanation: string,
    correctConcept: Concept,
    mentalModel: StudentMentalModel
  ): Promise<{
    accuracy: number;
    missingPoints: string[];
    misconceptions: string[];
    suggestions: string[];
    refinedExplanation: string;
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/analyze-explanation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId,
          studentExplanation,
          correctConcept: {
            name: correctConcept.name,
            description: correctConcept.description,
            keyPoints: correctConcept.keyPoints,
            commonMisconceptions: correctConcept.commonMisconceptions,
          },
          learningStyle: mentalModel.learningStyle,
          communicationPreference: mentalModel.communicationPreference,
        }),
      });

      if (!response.ok) throw new Error("Failed to analyze explanation");
      return await response.json();
    } catch (error) {
      console.error("Error analyzing student explanation:", error);
      throw error;
    }
  }

  /**
   * Generate targeted follow-up questions based on gaps
   * Step 3: Identify gaps and provide targeted teaching
   */
  static async generateFollowUpQuestions(
    conceptId: string,
    concept: Concept,
    identifiedGaps: string[],
    mentalModel: StudentMentalModel
  ): Promise<string[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/follow-up-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId,
          conceptName: concept.name,
          identifiedGaps,
          learningStyle: mentalModel.learningStyle,
          explanationDepth: mentalModel.explanationDepth,
          communicationPreference: mentalModel.communicationPreference,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate follow-up questions");
      const data = await response.json();
      return data.questions || [];
    } catch (error) {
      console.error("Error generating follow-up questions:", error);
      throw error;
    }
  }

  /**
   * Generate adaptive quiz questions based on mastery level
   * Uses active recall principles
   */
  static async generateQuizQuestions(
    conceptIds: string[],
    masteryLevels: Record<string, string>,
    mentalModel: StudentMentalModel,
    count: number = 5
  ): Promise<any[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptIds,
          masteryLevels,
          learningStyle: mentalModel.learningStyle,
          explanationDepth: mentalModel.explanationDepth,
          communicationPreference: mentalModel.communicationPreference,
          questionCount: count,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate quiz questions");
      const data = await response.json();
      return data.questions || [];
    } catch (error) {
      console.error("Error generating quiz questions:", error);
      throw error;
    }
  }

  /**
   * Evaluate quiz answer and provide feedback
   */
  static async evaluateAnswer(
    questionId: string,
    userAnswer: string,
    conceptId: string,
    mentalModel: StudentMentalModel
  ): Promise<{
    isCorrect: boolean;
    feedback: string;
    explanation: string;
    misconceptionsDetected: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/evaluate-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          userAnswer,
          conceptId,
          learningStyle: mentalModel.learningStyle,
          communicationPreference: mentalModel.communicationPreference,
        }),
      });

      if (!response.ok) throw new Error("Failed to evaluate answer");
      return await response.json();
    } catch (error) {
      console.error("Error evaluating answer:", error);
      throw error;
    }
  }

  /**
   * Generate step-by-step solution for a problem
   * Multi-agent problem solving (DeepTutor style)
   */
  static async generateStepByStepSolution(
    problem: string,
    conceptId: string,
    mentalModel: StudentMentalModel
  ): Promise<{
    steps: string[];
    explanation: string;
    keyInsights: string[];
    relatedConcepts: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/step-by-step-solution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          conceptId,
          learningStyle: mentalModel.learningStyle,
          explanationDepth: mentalModel.explanationDepth,
          communicationPreference: mentalModel.communicationPreference,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate solution");
      return await response.json();
    } catch (error) {
      console.error("Error generating step-by-step solution:", error);
      throw error;
    }
  }

  /**
   * Generate misconception correction explanation
   */
  static async correctMisconception(
    misconception: string,
    correctConcept: Concept,
    mentalModel: StudentMentalModel
  ): Promise<{
    correctionExplanation: string;
    whyMisconceptionOccurs: string;
    correctUnderstanding: string;
    examples: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/correct-misconception`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          misconception,
          correctConcept: {
            name: correctConcept.name,
            description: correctConcept.description,
            keyPoints: correctConcept.keyPoints,
          },
          learningStyle: mentalModel.learningStyle,
          communicationPreference: mentalModel.communicationPreference,
        }),
      });

      if (!response.ok) throw new Error("Failed to correct misconception");
      return await response.json();
    } catch (error) {
      console.error("Error correcting misconception:", error);
      throw error;
    }
  }

  /**
   * Generate knowledge graph connections for a concept
   */
  static async generateConceptConnections(
    conceptName: string,
    conceptDescription: string
  ): Promise<{
    prerequisites: string[];
    relatedConcepts: string[];
    advancedConcepts: string[];
    applications: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/concept-connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptName,
          conceptDescription,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate concept connections");
      return await response.json();
    } catch (error) {
      console.error("Error generating concept connections:", error);
      throw error;
    }
  }

  /**
   * Adaptive tutor response based on Theory of Mind
   * Adjusts explanation based on student's mental model
   */
  static async getAdaptiveTutorResponse(
    studentQuestion: string,
    conceptId: string,
    conceptName: string,
    mentalModel: StudentMentalModel,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<AITutorResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/api/ai/adaptive-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentQuestion,
          conceptId,
          conceptName,
          learningStyle: mentalModel.learningStyle,
          communicationPreference: mentalModel.communicationPreference,
          explanationDepth: mentalModel.explanationDepth,
          pacePreference: mentalModel.pacePreference,
          preferredExamples: mentalModel.preferredExamples,
          conversationHistory,
        }),
      });

      if (!response.ok) throw new Error("Failed to get adaptive response");
      return await response.json();
    } catch (error) {
      console.error("Error getting adaptive response:", error);
      throw error;
    }
  }
}
