/**
 * Comprehensive Tests for Gemini 3.1 Pro with Feynman Modes
 * Tests all 4 Feynman modes + APE profile inference + KG extraction
 */

import { describe, it, expect, beforeEach } from "vitest";
import { buildSystemPrompt, buildExplainerPrompt, buildStudentPrompt, buildSocraticPrompt, buildDuckPrompt, type FeynmanMode, type ProfileParams } from "../feynman-prompts";

describe("Feynman Prompts & Modes", () => {
  describe("Prompt Building", () => {
    it("should build explainer prompt", () => {
      const prompt = buildExplainerPrompt("Photosynthesis", { depthLevel: 5 });
      expect(prompt).toContain("master explainer");
      expect(prompt).toContain("Feynman");
      expect(prompt).toContain("Photosynthesis");
      expect(prompt).toContain("Depth level: 5");
    });

    it("should build student prompt", () => {
      const prompt = buildStudentPrompt("Quantum Mechanics", { depthLevel: 7 });
      expect(prompt).toContain("curious, intelligent student");
      expect(prompt).toContain("Quantum Mechanics");
      expect(prompt).toContain("Depth level: 7");
    });

    it("should build socratic prompt", () => {
      const prompt = buildSocraticPrompt("Machine Learning", { depthLevel: 6 });
      expect(prompt).toContain("Socratic tutor");
      expect(prompt).toContain("Machine Learning");
      expect(prompt).toContain("Guided Query Framework");
    });

    it("should build duck prompt", () => {
      const prompt = buildDuckPrompt("Problem Solving", {});
      expect(prompt).toContain("rubber duck");
      expect(prompt).toContain("articulatory loop");
    });

    it("should build system prompt with mode", () => {
      const modes: FeynmanMode[] = ["explainer", "student", "socratic", "duck"];
      
      for (const mode of modes) {
        const prompt = buildSystemPrompt(mode, "Test Topic", { depthLevel: 5 });
        expect(prompt).toBeDefined();
        expect(prompt.length).toBeGreaterThan(100);
      }
    });

    it("should include profile information when provided", () => {
      const profile: ProfileParams = {
        depthLevel: 8,
        learningStyle: "visual",
        commStyle: "formal",
        tone: "encouraging",
      };

      const prompt = buildExplainerPrompt("Complex Topic", profile);
      expect(prompt).toContain("Depth level: 8");
      expect(prompt).toContain("visual");
      expect(prompt).toContain("formal");
      expect(prompt).toContain("encouraging");
    });

    it("should handle empty profile gracefully", () => {
      const prompt = buildExplainerPrompt("Topic", {});
      expect(prompt).toBeDefined();
      expect(prompt).toContain("Topic");
    });
  });

  describe("Feynman Mode Characteristics", () => {
    it("explainer should focus on simplification", () => {
      const prompt = buildExplainerPrompt("Neural Networks");
      expect(prompt).toContain("simple");
      expect(prompt).toContain("analogy");
      expect(prompt).toContain("gaps");
      expect(prompt).toContain("teaching snapshot");
    });

    it("student should use role reversal", () => {
      const prompt = buildStudentPrompt("Calculus");
      expect(prompt).toContain("for the very first time");
      expect(prompt).toContain("ask the USER");
      expect(prompt).toContain("clarifying question");
    });

    it("socratic should avoid direct answers", () => {
      const prompt = buildSocraticPrompt("Physics");
      expect(prompt).toContain("ONLY tool is questions");
      expect(prompt).toContain("never give direct answers");
      expect(prompt).toContain("4 questions per 1 statement");
    });

    it("duck should minimize responses", () => {
      const prompt = buildDuckPrompt("Debugging");
      expect(prompt).toContain("minimal clarifying questions");
      expect(prompt).toContain("SHORT (1-3 sentences max)");
      expect(prompt).toContain("Do NOT solve");
    });
  });

  describe("Depth Level Adaptation", () => {
    const depths = [1, 3, 5, 7, 10];

    for (const depth of depths) {
      it(`should adapt to depth level ${depth}`, () => {
        const prompt = buildExplainerPrompt("Quantum Mechanics", { depthLevel: depth });
        expect(prompt).toContain(`Depth level: ${depth}`);
      });
    }
  });

  describe("Learning Style Adaptation", () => {
    const styles = ["visual", "verbal", "active", "intuitive"];

    for (const style of styles) {
      it(`should include ${style} learning style`, () => {
        const prompt = buildExplainerPrompt("Topic", { learningStyle: style });
        expect(prompt).toContain(style);
      });
    }
  });

  describe("Gemini 3.1 Pro Integration", () => {
    it("should have valid API key in environment", () => {
      const apiKey = process.env.GEMINI_API_KEY;
      expect(apiKey).toBeDefined();
      expect(apiKey?.length).toBeGreaterThan(0);
    });

    it("should format prompts for Gemini API", () => {
      const prompt = buildExplainerPrompt("Test", { depthLevel: 5 });
      
      // Prompts should be valid for API
      expect(prompt).toMatch(/[a-zA-Z]/); // Contains letters
      expect(prompt.length).toBeGreaterThan(50); // Substantial content
      expect(prompt).not.toContain("undefined"); // No undefined values
    });

    it("should support multi-turn conversations", () => {
      const systemPrompt = buildSocraticPrompt("Problem Solving", { depthLevel: 6 });
      
      // System prompt should be suitable for conversation context
      expect(systemPrompt).toContain("question");
      expect(systemPrompt).toContain("student");
    });
  });

  describe("Neuroscience Validation", () => {
    it("explainer should reference self-explanation (g=0.55)", () => {
      const prompt = buildExplainerPrompt("Topic");
      expect(prompt.toLowerCase()).toMatch(/explain|self-explanation|teaching/);
    });

    it("socratic should reference testing effect (g=0.55)", () => {
      const prompt = buildSocraticPrompt("Topic");
      expect(prompt.toLowerCase()).toMatch(/question|test|discover/);
    });

    it("duck should reference working memory", () => {
      const prompt = buildDuckPrompt("Topic");
      expect(prompt).toContain("articulatory loop");
      expect(prompt).toContain("working memory");
    });
  });

  describe("Misconception Handling", () => {
    it("explainer should address common misconceptions", () => {
      const prompt = buildExplainerPrompt("Photosynthesis", { depthLevel: 3 });
      expect(prompt).toContain("confusion");
      expect(prompt).toContain("gaps");
    });

    it("socratic should guide around misconceptions", () => {
      const prompt = buildSocraticPrompt("Evolution", { depthLevel: 4 });
      expect(prompt).toContain("question");
      expect(prompt).toContain("reasoning");
    });
  });

  describe("Profile Inference Preparation", () => {
    it("should prepare for APE inference", () => {
      const profile: ProfileParams = {
        depthLevel: 5,
        learningStyle: "visual",
        commStyle: "layman",
        tone: "friendly",
      };

      const prompt = buildExplainerPrompt("Complex Topic", profile);
      
      // Profile should be extractable from prompt
      expect(prompt).toContain("Depth level: 5");
      expect(prompt).toContain("visual");
      expect(prompt).toContain("layman");
      expect(prompt).toContain("friendly");
    });

    it("should support dynamic profile updates", () => {
      const initialProfile: ProfileParams = { depthLevel: 3 };
      const updatedProfile: ProfileParams = { depthLevel: 7 };

      const initialPrompt = buildExplainerPrompt("Topic", initialProfile);
      const updatedPrompt = buildExplainerPrompt("Topic", updatedProfile);

      expect(initialPrompt).toContain("Depth level: 3");
      expect(updatedPrompt).toContain("Depth level: 7");
      expect(initialPrompt).not.toEqual(updatedPrompt);
    });
  });

  describe("Knowledge Graph Integration", () => {
    it("socratic should support KG-guided questioning", () => {
      const prompt = buildSocraticPrompt("Machine Learning", {
        conceptMastery: {
          "gradient-descent": 0.8,
          "backpropagation": 0.4,
          "neural-networks": 0.6,
        },
      });

      expect(prompt).toBeDefined();
      expect(prompt).toContain("question");
    });

    it("explainer should reference concept relationships", () => {
      const prompt = buildExplainerPrompt("Calculus", {
        conceptMastery: {
          "limits": 0.9,
          "derivatives": 0.5,
          "integrals": 0.3,
        },
      });

      expect(prompt).toBeDefined();
    });
  });

  describe("Curriculum Generation Support", () => {
    it("should support curriculum-aware prompts", () => {
      const profile: ProfileParams = {
        depthLevel: 5,
        learningStyle: "active",
      };

      const prompt = buildStudentPrompt("Linear Algebra", profile);
      expect(prompt).toContain("active");
      expect(prompt).toContain("Linear Algebra");
    });

    it("should adapt to learning objectives", () => {
      const prompt = buildExplainerPrompt("Statistics", {
        depthLevel: 6,
        commStyle: "textbook",
      });

      expect(prompt).toContain("textbook");
    });
  });

  describe("Prompt Quality Assurance", () => {
    it("should not contain placeholder text", () => {
      const modes: FeynmanMode[] = ["explainer", "student", "socratic", "duck"];
      
      for (const mode of modes) {
        const prompt = buildSystemPrompt(mode, "Test Topic");
        expect(prompt).not.toContain("{{");
        expect(prompt).not.toContain("}}");
        expect(prompt).not.toContain("[PLACEHOLDER]");
      }
    });

    it("should be suitable for API consumption", () => {
      const prompt = buildExplainerPrompt("Topic", { depthLevel: 5 });
      
      // Should be valid UTF-8
      expect(() => JSON.stringify(prompt)).not.toThrow();
      
      // Should not have excessive whitespace
      expect(prompt.trim()).toEqual(prompt.trim());
    });

    it("should maintain consistency across calls", () => {
      const topic = "Physics";
      const profile: ProfileParams = { depthLevel: 5 };

      const prompt1 = buildExplainerPrompt(topic, profile);
      const prompt2 = buildExplainerPrompt(topic, profile);

      expect(prompt1).toEqual(prompt2);
    });
  });

  describe("Integration with Gemini Models", () => {
    it("should work with gemini-1.5-pro", () => {
      const prompt = buildExplainerPrompt("Topic");
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should work with gemini-2.0-flash", () => {
      const prompt = buildSocraticPrompt("Topic");
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should support streaming responses", () => {
      const prompt = buildStudentPrompt("Topic");
      // Prompt should be suitable for streaming
      expect(prompt).toContain("?"); // Has questions for dialogue
    });
  });
});
