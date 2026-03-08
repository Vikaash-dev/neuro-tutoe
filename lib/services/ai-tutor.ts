/**
 * AI Tutor Service
 * Handles communication with AI backend for Feynman-style teaching.
 * Implements DeepTutor's multi-agent problem solving approach.
 *
 * Security (Sprint 0): All LLM calls go through the backend server.
 * The Gemini API key stored in AsyncStorage is forwarded via the
 * X-Gemini-API-Key header to the server, which makes the actual
 * Gemini API call. The key is never sent directly from the browser
 * to Google's API.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Concept, AITutorResponse, StudentMentalModel, ConceptExplanation } from "@/lib/types/learning";

/**
 * AI Tutor Service
 * Communicates with backend LLM service (server-side Gemini proxy)
 */
export class AITutorService {
  private static readonly API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://127.0.0.1:3000";

  /**
   * Build request headers, including the Gemini API key forwarded server-side.
   * The server uses this key to call the Gemini API — the key never goes
   * directly from the client to Google.
   */
  private static async apiKeyHeaders(): Promise<Record<string, string>> {
    try {
      const apiKey = await AsyncStorage.getItem("GEMINI_API_KEY");
      if (apiKey) return { "X-Gemini-API-Key": apiKey };
    } catch {
      // AsyncStorage not available (web/test) — server will use env key
    }
    return {};
  }

  /** Typed POST helper — always includes Content-Type + API key header. */
  private static async post<T>(path: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = {
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
      throw new Error(`API error ${response.status}: ${errText}`);
    }
    return response.json() as Promise<T>;
  }

  /**
   * Generate Feynman-style simple explanation for a concept
   * Step 1: Choose concept and explain simply
   */
  static async generateSimpleExplanation(
    concept: Concept,
    mentalModel: StudentMentalModel
  ): Promise<ConceptExplanation> {
    return this.post("/api/ai/explain-simple", {
      conceptName: concept.name,
      description: concept.description,
      keyPoints: concept.keyPoints,
      commonMisconceptions: concept.commonMisconceptions,
      realWorldApplications: concept.realWorldApplications,
      learningStyle: mentalModel.learningStyle,
      explanationDepth: mentalModel.explanationDepth,
      communicationPreference: mentalModel.communicationPreference,
    });
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
    return this.post("/api/ai/analyze-explanation", {
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
    });
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
    const data = await this.post<{ questions: string[] }>("/api/ai/follow-up-questions", {
      conceptId,
      conceptName: concept.name,
      identifiedGaps,
      learningStyle: mentalModel.learningStyle,
      explanationDepth: mentalModel.explanationDepth,
      communicationPreference: mentalModel.communicationPreference,
    });
    return data.questions || [];
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
  ): Promise<unknown[]> {
    const data = await this.post<{ questions: unknown[] }>("/api/ai/generate-quiz", {
      conceptIds,
      masteryLevels,
      learningStyle: mentalModel.learningStyle,
      explanationDepth: mentalModel.explanationDepth,
      communicationPreference: mentalModel.communicationPreference,
      questionCount: count,
    });
    return data.questions || [];
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
    return this.post("/api/ai/evaluate-answer", {
      questionId,
      userAnswer,
      conceptId,
      learningStyle: mentalModel.learningStyle,
      communicationPreference: mentalModel.communicationPreference,
    });
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
    return this.post("/api/ai/step-by-step-solution", {
      problem,
      conceptId,
      learningStyle: mentalModel.learningStyle,
      explanationDepth: mentalModel.explanationDepth,
      communicationPreference: mentalModel.communicationPreference,
    });
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
    return this.post("/api/ai/correct-misconception", {
      misconception,
      correctConcept: {
        name: correctConcept.name,
        description: correctConcept.description,
        keyPoints: correctConcept.keyPoints,
      },
      learningStyle: mentalModel.learningStyle,
      communicationPreference: mentalModel.communicationPreference,
    });
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
    return this.post("/api/ai/concept-connections", { conceptName, conceptDescription });
  }

  /**
   * Adaptive tutor response based on Theory of Mind.
   * Adjusts explanation based on student's mental model.
   * Automatically pulls RAG context from uploaded documents.
   */
  static async getAdaptiveTutorResponse(
    studentQuestion: string,
    conceptId: string,
    conceptName: string,
    mentalModel: StudentMentalModel,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<AITutorResponse> {
    return this.post("/api/ai/chat-with-rag", {
      message: studentQuestion,
      conceptId,
      conceptName,
      learningStyle: mentalModel.learningStyle,
      communicationPreference: mentalModel.communicationPreference,
      explanationDepth: mentalModel.explanationDepth,
      pacePreference: mentalModel.pacePreference,
      preferredExamples: mentalModel.preferredExamples,
      conversationHistory,
    });
  }
}
