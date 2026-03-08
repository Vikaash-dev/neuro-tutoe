/**
 * Gemini Client API Integration Tests
 * Tests all AI tutoring features with real Gemini API
 */

import { describe, it, expect, beforeAll } from "vitest";
import { GeminiClientService } from "../gemini-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("GeminiClientService", () => {
  beforeAll(async () => {
    // Set API key from environment for testing
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable not set");
    }
    await AsyncStorage.setItem("GEMINI_API_KEY", apiKey);
  });

  it("should retrieve API key from storage", async () => {
    const apiKey = await GeminiClientService.getAPIKey();
    expect(apiKey).toBeDefined();
    expect(apiKey.length).toBeGreaterThan(0);
  });

  it("should generate Feynman explanation for a concept", async () => {
    const explanation = await GeminiClientService.generateFeynmanExplanation(
      "Photosynthesis",
      5,
      "Alice"
    );

    expect(explanation).toBeDefined();
    expect(explanation.length).toBeGreaterThan(100);
    expect(explanation.toLowerCase()).toContain("photosynthesis");
  });

  it("should generate Socratic question for guided learning", async () => {
    const question = await GeminiClientService.generateSocraticQuestion(
      "Quantum Mechanics",
      "I think light is always a wave",
      ["What do you mean by wave?", "Can waves have particles?"]
    );

    expect(question).toBeDefined();
    expect(question.length).toBeGreaterThan(20);
    expect(question.includes("?")).toBe(true); // Should be a question
  });

  it("should evaluate student explanation for accuracy", async () => {
    const evaluation = await GeminiClientService.evaluateExplanation(
      "Photosynthesis is when plants use sunlight to make food from water and carbon dioxide",
      "Photosynthesis",
      ["Plants use sunlight", "Converts CO2 and water", "Produces glucose and oxygen"]
    );

    expect(evaluation).toBeDefined();
    expect(evaluation.accuracy).toBeGreaterThanOrEqual(0);
    expect(evaluation.accuracy).toBeLessThanOrEqual(100);
    expect(evaluation.feedback).toBeDefined();
    expect(Array.isArray(evaluation.misunderstandings)).toBe(true);
  });

  it("should generate multiple choice quiz question", async () => {
    const question = await GeminiClientService.generateQuizQuestion(
      "Newton's Laws of Motion",
      3,
      "multiple_choice"
    );

    expect(question).toBeDefined();
    expect(question.question).toBeDefined();
    expect(question.question.length).toBeGreaterThan(10);
    expect(question.correctAnswer).toBeDefined();
    expect(question.explanation).toBeDefined();
    expect(Array.isArray(question.options)).toBe(true);
    expect(question.options!.length).toBeGreaterThanOrEqual(2);
  });

  it("should generate short answer quiz question", async () => {
    const question = await GeminiClientService.generateQuizQuestion(
      "Calculus",
      4,
      "short_answer"
    );

    expect(question).toBeDefined();
    expect(question.question).toBeDefined();
    expect(question.correctAnswer).toBeDefined();
    expect(question.explanation).toBeDefined();
  });

  it("should generate explain-type quiz question", async () => {
    const question = await GeminiClientService.generateQuizQuestion(
      "Evolution",
      5,
      "explain"
    );

    expect(question).toBeDefined();
    expect(question.question).toBeDefined();
    expect(question.correctAnswer).toBeDefined();
    expect(question.explanation).toBeDefined();
  });

  it("should detect misconceptions in student response", async () => {
    const misconceptions = await GeminiClientService.detectMisconceptions(
      "Heat always flows from hot to cold objects",
      "Thermodynamics",
      "Heat flows from hot to cold objects, and the rate depends on temperature difference"
    );

    expect(Array.isArray(misconceptions)).toBe(true);
    // May or may not find misconceptions depending on response
  });

  it("should generate personalized learning recommendation", async () => {
    const recommendation = await GeminiClientService.generateLearningRecommendation(
      {
        conceptId: "photosynthesis",
        masteryLevel: 6,
        recentAccuracy: 75,
        timeSpent: 120,
      },
      ["Cellular Respiration", "Plant Biology", "Energy Transfer", "Ecology"]
    );

    expect(recommendation).toBeDefined();
    expect(recommendation.recommendation).toBeDefined();
    expect(recommendation.recommendation.length).toBeGreaterThan(20);
    expect(Array.isArray(recommendation.nextSteps)).toBe(true);
  });

  it("should handle conversation history in messages", async () => {
    const conversationHistory = [
      {
        role: "user" as const,
        parts: [{ text: "What is photosynthesis?" }],
      },
      {
        role: "model" as const,
        parts: [
          {
            text: "Photosynthesis is the process by which plants convert light energy into chemical energy.",
          },
        ],
      },
    ];

    const response = await GeminiClientService.sendMessage(
      "Can you explain it more simply?",
      "You are a helpful tutor.",
      conversationHistory
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(20);
  });

  it("should throw error if API key is missing", async () => {
    // Temporarily remove API key
    await AsyncStorage.removeItem("GEMINI_API_KEY");

    try {
      await GeminiClientService.getAPIKey();
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain("API key");
    }

    // Restore API key for other tests
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      await AsyncStorage.setItem("GEMINI_API_KEY", apiKey);
    }
  });
});
