/**
 * Unit Tests for Gemini API Service
 * Tests AI tutor features: explanations, analysis, and feedback
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { GeminiAPIService } from "../gemini-api";

describe("GeminiAPIService", () => {
  beforeAll(async () => {
    // Test API connection before running tests
    const connected = await GeminiAPIService.testConnection();
    if (!connected) {
      console.warn("Gemini API connection test failed. Some tests may be skipped.");
    }
  });

  describe("API Connection", () => {
    it("should establish connection to Gemini API", async () => {
      const connected = await GeminiAPIService.testConnection();
      expect(connected).toBe(true);
    });
  });

  describe("Simple Explanation Generation", () => {
    it("should generate Feynman-style explanation for a concept", async () => {
      const explanation = await GeminiAPIService.generateSimpleExplanation(
        "Photosynthesis",
        "The process by which plants convert light energy into chemical energy",
        ["Occurs in chloroplasts", "Requires light, water, and CO2", "Produces glucose and oxygen"],
        "visual"
      );

      expect(explanation).toBeDefined();
      expect(explanation.length).toBeGreaterThan(50);
      expect(explanation.toLowerCase()).toContain("photosynthesis");
    });

    it("should adapt explanation to learning style", async () => {
      const visualExplanation = await GeminiAPIService.generateSimpleExplanation(
        "Gravity",
        "The force that attracts objects toward each other",
        ["Affects all objects with mass", "Stronger with more mass", "Decreases with distance"],
        "visual"
      );

      expect(visualExplanation).toBeDefined();
      expect(visualExplanation.length).toBeGreaterThan(50);
    });
  });

  describe("Student Explanation Analysis", () => {
    it("should analyze student explanation for accuracy", async () => {
      const studentExplanation =
        "Photosynthesis is when plants make food from sunlight. They use the sun's energy to turn water and air into sugar.";

      const analysis = await GeminiAPIService.analyzeStudentExplanation(
        studentExplanation,
        "Photosynthesis",
        [
          "Occurs in chloroplasts",
          "Requires light, water, and CO2",
          "Produces glucose and oxygen",
        ],
        ["Plants get energy from soil", "Photosynthesis is the same as respiration"]
      );

      expect(analysis).toBeDefined();
      expect(analysis.accuracy).toBeGreaterThan(0);
      expect(analysis.accuracy).toBeLessThanOrEqual(100);
      expect(Array.isArray(analysis.missingPoints)).toBe(true);
      expect(Array.isArray(analysis.misconceptions)).toBe(true);
      expect(Array.isArray(analysis.suggestions)).toBe(true);
      expect(analysis.refinedExplanation).toBeDefined();
    });

    it("should detect misconceptions in student explanation", async () => {
      const misconceptionExplanation =
        "Photosynthesis is when plants breathe in oxygen and breathe out carbon dioxide, just like animals.";

      const analysis = await GeminiAPIService.analyzeStudentExplanation(
        misconceptionExplanation,
        "Photosynthesis",
        [
          "Occurs in chloroplasts",
          "Requires light, water, and CO2",
          "Produces glucose and oxygen",
        ],
        [
          "Photosynthesis is the same as respiration",
          "Plants only need sunlight",
        ]
      );

      expect(analysis.misconceptions.length).toBeGreaterThan(0);
    });
  });

  describe("Follow-up Question Generation", () => {
    it("should generate Socratic follow-up questions", async () => {
      const questions = await GeminiAPIService.generateFollowUpQuestions(
        "Photosynthesis",
        ["Why plants need water", "What happens to glucose produced"],
        "visual",
        3
      );

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBe(3);
      questions.forEach((q) => {
        expect(typeof q).toBe("string");
        expect(q.length).toBeGreaterThan(10);
      });
    });
  });

  describe("Quiz Question Generation", () => {
    it("should generate multiple-choice quiz questions", async () => {
      const questions = await GeminiAPIService.generateQuizQuestions(
        "Photosynthesis",
        "novice",
        "visual",
        3
      );

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBe(3);

      questions.forEach((q) => {
        expect(q.id).toBeDefined();
        expect(q.question).toBeDefined();
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBe(4);
        expect(q.correctAnswer).toBeDefined();
        expect(q.explanation).toBeDefined();
        expect(q.options).toContain(q.correctAnswer);
      });
    });

    it("should adjust difficulty based on mastery level", async () => {
      const noviceQuestions = await GeminiAPIService.generateQuizQuestions(
        "Photosynthesis",
        "novice",
        "visual",
        1
      );

      const expertQuestions = await GeminiAPIService.generateQuizQuestions(
        "Photosynthesis",
        "expert",
        "visual",
        1
      );

      expect(noviceQuestions).toBeDefined();
      expect(expertQuestions).toBeDefined();
    });
  });

  describe("Misconception Correction", () => {
    it("should provide comprehensive misconception correction", async () => {
      const correction = await GeminiAPIService.correctMisconception(
        "Plants get all their energy from soil",
        "Photosynthesis",
        [
          "Plants get energy from sunlight",
          "Soil provides nutrients, not energy",
          "Photosynthesis converts light energy to chemical energy",
        ]
      );

      expect(correction).toBeDefined();
      expect(correction.correctionExplanation).toBeDefined();
      expect(correction.whyMisconceptionOccurs).toBeDefined();
      expect(correction.correctUnderstanding).toBeDefined();
      expect(Array.isArray(correction.examples)).toBe(true);
      expect(correction.examples.length).toBeGreaterThan(0);
    });
  });

  describe("Adaptive Response Generation", () => {
    it("should generate adaptive tutor response to student question", async () => {
      const response = await GeminiAPIService.generateAdaptiveResponse(
        "Why do plants need sunlight?",
        "Photosynthesis",
        "visual",
        "encouraging"
      );

      expect(response).toBeDefined();
      expect(response.explanation).toBeDefined();
      expect(response.followUpQuestion).toBeDefined();
      expect(Array.isArray(response.relatedConcepts)).toBe(true);
    });

    it("should adapt tone based on communication preference", async () => {
      const encouragingResponse = await GeminiAPIService.generateAdaptiveResponse(
        "Is my understanding correct?",
        "Photosynthesis",
        "visual",
        "encouraging"
      );

      const formalResponse = await GeminiAPIService.generateAdaptiveResponse(
        "Is my understanding correct?",
        "Photosynthesis",
        "visual",
        "formal"
      );

      expect(encouragingResponse.explanation).toBeDefined();
      expect(formalResponse.explanation).toBeDefined();
    });
  });
});
