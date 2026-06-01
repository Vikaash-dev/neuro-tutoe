/**
 * Test: Gemini Service
 * Tests the GeminiService class for tutoring functionality
 */

import { describe, it, expect, beforeAll, vi } from "vitest";

// Mock fetch for testing
if (typeof global.fetch === "undefined") {
  global.fetch = vi.fn();
}
import GeminiService, { TUTORING_MODES } from "../lib/services/gemini-service";

describe("GeminiService", () => {
  let service: GeminiService;
  const apiKey = process.env.GEMINI_API_KEY || "";

  beforeAll(() => {
    if (apiKey) {
      service = new GeminiService(apiKey);
    }
  });

  it("should initialize with API key", () => {
    if (!apiKey) {
      console.warn("Skipping test - no API key");
      return;
    }
    expect(service).toBeDefined();
  });

  it("should have all tutoring modes defined", () => {
    const modes = Object.keys(TUTORING_MODES);
    expect(modes).toContain("explainer");
    expect(modes).toContain("socratic");
    expect(modes).toContain("feedback");
    expect(modes).toContain("misconception");
    expect(modes).toContain("quiz");
    expect(modes).toContain("application");
  });

  it("should have valid system prompts for each mode", () => {
    Object.entries(TUTORING_MODES).forEach(([key, mode]) => {
      expect(mode.name).toBeTruthy();
      expect(mode.systemPrompt).toBeTruthy();
      expect(mode.description).toBeTruthy();
      expect(mode.systemPrompt.length).toBeGreaterThan(10);
    });
  });

  it("should initialize conversation history as empty", () => {
    if (!apiKey) {
      console.warn("Skipping test - no API key");
      return;
    }
    const history = service.getHistory();
    expect(history).toEqual([]);
  });

  it("should clear conversation history", () => {
    if (!apiKey) {
      console.warn("Skipping test - no API key");
      return;
    }
    service.setHistory([
      { role: "user", content: "Test" },
      { role: "model", content: "Response" },
    ]);
    expect(service.getHistory().length).toBe(2);

    service.clearHistory();
    expect(service.getHistory()).toEqual([]);
  });

  it("should send message with explainer mode", async () => {
    if (!apiKey) {
      console.warn("Skipping API test - no API key");
      return;
    }

    try {
      const response = await service.sendMessage(
        "Explain quantum superposition in simple terms",
        "explainer"
      );

      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);
      expect(typeof response).toBe("string");

      console.log("✅ Explainer Mode Response:", response.substring(0, 100) + "...");
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  }, 30000);

  it("should send message with socratic mode", async () => {
    if (!apiKey) {
      console.warn("Skipping API test - no API key");
      return;
    }

    try {
      const response = await service.sendMessage(
        "Why do particles behave differently when observed?",
        "socratic"
      );

      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);
      expect(response).toMatch(/\?/); // Should contain a question

      console.log("✅ Socratic Mode Response:", response.substring(0, 100) + "...");
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  }, 30000);

  it("should send message with feedback mode", async () => {
    if (!apiKey) {
      console.warn("Skipping API test - no API key");
      return;
    }

    try {
      const response = await service.sendMessage(
        "I think quantum entanglement means particles can communicate faster than light",
        "feedback"
      );

      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);

      console.log("✅ Feedback Mode Response:", response.substring(0, 100) + "...");
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  }, 30000);

  it("should maintain conversation history", async () => {
    if (!apiKey) {
      console.warn("Skipping API test - no API key");
      return;
    }

    try {
      // Clear history first
      service.clearHistory();

      // Send first message
      const response1 = await service.sendMessage(
        "What is quantum mechanics?",
        "explainer"
      );
      expect(response1).toBeTruthy();

      // Check history
      let history = service.getHistory();
      expect(history.length).toBe(2); // 1 user + 1 model

      // Send second message
      const response2 = await service.sendMessageWithContext(
        "Can you explain that more simply?",
        "explainer"
      );
      expect(response2).toBeTruthy();

      // Check history again
      history = service.getHistory();
      expect(history.length).toBe(4); // 2 user + 2 model

      console.log("✅ Conversation History Maintained");
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  }, 60000);
});
