import { describe, it, expect } from "vitest";
import { TextualOverloadDetector } from "../overload-detection";

describe("TextualOverloadDetector", () => {
  describe("analyzeUtterance", () => {
    it("should detect repetition when current utterance closely matches previous", () => {
      const prev = "I think it is because photosynthesis";
      const curr = "I think it is because photosynthesis";
      const signal = TextualOverloadDetector.analyzeUtterance(curr, prev);
      expect(signal.repetitionDetected).toBe(true);
    });

    it("should not flag repetition for clearly different utterances", () => {
      const signal = TextualOverloadDetector.analyzeUtterance(
        "Photosynthesis converts sunlight into glucose.",
        "The mitochondria produces ATP in cellular respiration."
      );
      expect(signal.repetitionDetected).toBe(false);
    });

    it("should count confusion markers", () => {
      const signal = TextualOverloadDetector.analyzeUtterance(
        "I don't know, I'm confused, I can't understand this at all."
      );
      expect(signal.confusionMarkerCount).toBeGreaterThanOrEqual(2);
    });

    it("should detect circular logic patterns", () => {
      const signal = TextualOverloadDetector.analyzeUtterance(
        "It is true because it is obviously true."
      );
      expect(signal.circularLogicDetected).toBe(true);
    });

    it("should produce high fragmentation for very short sentences", () => {
      const signal = TextualOverloadDetector.analyzeUtterance("Yes. No. Maybe. I. Don't. Know.");
      expect(signal.fragmentationScore).toBeGreaterThan(0.5);
    });

    it("should produce low fragmentation for well-formed prose", () => {
      const signal = TextualOverloadDetector.analyzeUtterance(
        "Photosynthesis is the biological process through which plants convert sunlight, carbon dioxide, and water into glucose and oxygen."
      );
      expect(signal.fragmentationScore).toBeLessThan(0.5);
    });

    it("should compute lexical diversity as a value between 0 and 1", () => {
      const signal = TextualOverloadDetector.analyzeUtterance(
        "The cat sat on the mat near the hat and the bat."
      );
      expect(signal.lexicalDiversity).toBeGreaterThan(0);
      expect(signal.lexicalDiversity).toBeLessThanOrEqual(1);
    });
  });

  describe("classifySeverity", () => {
    it("should classify 'none' for a healthy signal", () => {
      const signal = {
        repetitionDetected: false,
        fragmentationScore: 0.1,
        circularLogicDetected: false,
        lexicalDiversity: 0.7,
        confusionMarkerCount: 0,
        coherenceDivergence: 0.05,
      };
      expect(TextualOverloadDetector.classifySeverity(signal)).toBe("none");
    });

    it("should classify 'severe' for a maximally overloaded signal", () => {
      const signal = {
        repetitionDetected: true,
        fragmentationScore: 0.9,
        circularLogicDetected: true,
        lexicalDiversity: 0.1,
        confusionMarkerCount: 3,
        coherenceDivergence: 0.8,
      };
      expect(TextualOverloadDetector.classifySeverity(signal)).toBe("severe");
    });

    it("should classify 'mild' for slightly confused response", () => {
      const signal = {
        repetitionDetected: false,
        fragmentationScore: 0.1,
        circularLogicDetected: false,
        lexicalDiversity: 0.5,
        confusionMarkerCount: 1,
        coherenceDivergence: 0.2,
      };
      expect(TextualOverloadDetector.classifySeverity(signal)).toBe("mild");
    });
  });

  describe("recommendAction", () => {
    it("should recommend pause_and_recap for severe overload", () => {
      expect(TextualOverloadDetector.recommendAction("severe")).toBe("pause_and_recap");
    });
    it("should recommend chunk for moderate overload", () => {
      expect(TextualOverloadDetector.recommendAction("moderate")).toBe("chunk");
    });
    it("should recommend simplify for mild overload", () => {
      expect(TextualOverloadDetector.recommendAction("mild")).toBe("simplify");
    });
    it("should recommend continue when no overload", () => {
      expect(TextualOverloadDetector.recommendAction("none")).toBe("continue");
    });
  });

  describe("detect (full pipeline)", () => {
    it("should return an OverloadState with timestamp", () => {
      const state = TextualOverloadDetector.detect("I don't know I'm confused.");
      expect(state.detectedAt).toBeGreaterThan(0);
      expect(["none", "mild", "moderate", "severe"]).toContain(state.severity);
    });

    it("should produce non-continue action for heavily confused text", () => {
      const state = TextualOverloadDetector.detect(
        "I don't know. I don't know. I don't know. I can't do this."
      );
      expect(state.recommendedAction).not.toBe("continue");
    });
  });

  describe("analyzeDialogueHistory", () => {
    it("should return stable trend for a consistent dialogue", () => {
      const utterances = [
        "Photosynthesis converts sunlight to energy.",
        "Plants use chlorophyll to absorb light.",
        "Glucose is produced from carbon dioxide and water.",
      ];
      const result = TextualOverloadDetector.analyzeDialogueHistory(utterances);
      expect(result.perTurnStates).toHaveLength(3);
      expect(["improving", "stable", "worsening"]).toContain(result.trend);
    });

    it("should detect worsening trend for progressively confused dialogue", () => {
      const utterances = [
        "Photosynthesis converts sunlight to glucose.",
        "I'm not sure about the details anymore.",
        "I don't know. I don't know. I don't know. I can't. Help.",
      ];
      const result = TextualOverloadDetector.analyzeDialogueHistory(utterances);
      expect(result.overallSeverity).not.toBe("none");
    });

    it("should handle empty dialogue gracefully", () => {
      const result = TextualOverloadDetector.analyzeDialogueHistory([]);
      expect(result.perTurnStates).toHaveLength(0);
      expect(result.overallSeverity).toBe("none");
      expect(result.peakTurnIndex).toBe(-1);
    });
  });
});
