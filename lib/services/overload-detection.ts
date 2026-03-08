/**
 * Cognitive Overload Detection
 * Detects textual markers of cognitive overload in student-tutor dialogues
 * without invasive physiological sensors.
 *
 * Research basis:
 *  - Hegde & Jayalath (2025) "Emotions in the Loop: A Survey of Affective Computing"
 *  - Jin et al. (2025) "Investigating LLMs in Diagnosing Students' Cognitive Skills"
 *  - Borchers et al. (2025) "Large Language Models as Students Who Think Aloud"
 */

import type { OverloadSignal, OverloadSeverity, OverloadState } from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Marker dictionaries
// ---------------------------------------------------------------------------

/** Explicit confusion markers — "I don't know" loops (Hegde & Jayalath 2025) */
const CONFUSION_MARKERS = [
  "i don't know",
  "i dont know",
  "i have no idea",
  "i'm confused",
  "im confused",
  "i don't understand",
  "i dont understand",
  "not sure",
  "no idea",
  "i give up",
  "this is too hard",
  "i can't",
  "i cant",
  "help me",
  "what does that mean",
  "i don't get it",
  "i dont get it",
];

/** Repetition triggers — student restates their prior answer without elaboration */
const REPETITION_THRESHOLD = 0.65; // Jaccard similarity above this = repetition

/** Coherence baseline: expected min TTR (type-token ratio) for healthy discourse */
const COHERENCE_BASELINE_TTR = 0.45;

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
}

function typeTokenRatio(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const types = new Set(tokens);
  return types.size / tokens.length;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Count how many confusion markers appear in the text */
function countConfusionMarkers(text: string): number {
  const lower = text.toLowerCase();
  return CONFUSION_MARKERS.filter((m) => lower.includes(m)).length;
}

/** Detect circular reasoning: student references their own prior conclusion as evidence */
function detectCircularLogic(text: string): boolean {
  const circularPatterns = [
    /because\s+.{0,40}\bbecause\b/i,
    /it is\s+.{0,30}\bbecause it is\b/i,
    /obviously\s+.{0,50}\bobviously\b/i,
    /that'?s? (right|true|correct)\s+.{0,40}that'?s? (right|true|correct)/i,
  ];
  return circularPatterns.some((p) => p.test(text));
}

/** Sentence fragmentation: short disconnected sentences signal overload */
function fragmentationScore(text: string): number {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length === 0) return 0;
  const shortSentences = sentences.filter((s) => s.split(/\s+/).length < 5).length;
  return shortSentences / sentences.length;
}

// ---------------------------------------------------------------------------
// TextualOverloadDetector
// ---------------------------------------------------------------------------

/**
 * Analyses individual student utterances and dialogue history to produce
 * a structured OverloadSignal, then maps it to an OverloadState with a
 * recommended tutor action.
 *
 * Key finding from Borchers et al. (2025): a key marker of student overload is
 * *divergence from coherence* — fragmented sentences, "I don't know" loops,
 * or fixation on irrelevant details.
 */
export class TextualOverloadDetector {
  /**
   * Analyse a single student utterance for overload signals.
   *
   * @param currentUtterance  The student's latest message.
   * @param previousUtterance The student's immediately prior message (for repetition check).
   */
  static analyzeUtterance(
    currentUtterance: string,
    previousUtterance: string = ""
  ): OverloadSignal {
    const currentTokens = tokenize(currentUtterance);
    const previousTokens = tokenize(previousUtterance);

    const repetitionDetected =
      previousUtterance.length > 0 &&
      jaccardSimilarity(currentTokens, previousTokens) >= REPETITION_THRESHOLD;

    const fragScore = fragmentationScore(currentUtterance);
    const circular = detectCircularLogic(currentUtterance);
    const ttr = typeTokenRatio(currentTokens);
    const confusionCount = countConfusionMarkers(currentUtterance);

    // Coherence divergence: how far below the baseline TTR is this response?
    const coherenceDivergence = Math.max(0, COHERENCE_BASELINE_TTR - ttr) / COHERENCE_BASELINE_TTR;

    return {
      repetitionDetected,
      fragmentationScore: fragScore,
      circularLogicDetected: circular,
      lexicalDiversity: ttr,
      confusionMarkerCount: confusionCount,
      coherenceDivergence,
    };
  }

  /**
   * Classify overload severity from a raw OverloadSignal.
   * Thresholds derived from Hegde & Jayalath (2025) taxonomy.
   */
  static classifySeverity(signal: OverloadSignal): OverloadSeverity {
    let score = 0;

    if (signal.repetitionDetected) score += 2;
    if (signal.fragmentationScore > 0.7) score += 3;
    else if (signal.fragmentationScore > 0.4) score += 1;
    if (signal.circularLogicDetected) score += 2;
    if (signal.lexicalDiversity < 0.25) score += 2;
    else if (signal.lexicalDiversity < 0.35) score += 1;
    score += Math.min(signal.confusionMarkerCount * 2, 4);
    if (signal.coherenceDivergence > 0.6) score += 2;
    else if (signal.coherenceDivergence > 0.3) score += 1;

    if (score >= 8) return "severe";
    if (score >= 5) return "moderate";
    if (score >= 2) return "mild";
    return "none";
  }

  /**
   * Map severity to the recommended tutor intervention.
   *
   * Mechanism from Lopes et al. (2025) — "closing the loop":
   * lower difficulty (intrinsic load) or simplify presentation (extraneous load)
   * immediately upon detecting overload.
   */
  static recommendAction(
    severity: OverloadSeverity
  ): "continue" | "simplify" | "chunk" | "pause_and_recap" {
    switch (severity) {
      case "severe":   return "pause_and_recap";
      case "moderate": return "chunk";
      case "mild":     return "simplify";
      default:         return "continue";
    }
  }

  /**
   * Full pipeline: utterance → OverloadState.
   */
  static detect(
    currentUtterance: string,
    previousUtterance: string = ""
  ): OverloadState {
    const signal = this.analyzeUtterance(currentUtterance, previousUtterance);
    const severity = this.classifySeverity(signal);
    return {
      severity,
      signal,
      recommendedAction: this.recommendAction(severity),
      detectedAt: Date.now(),
    };
  }

  /**
   * Analyse a full dialogue history and return the aggregate overload trend.
   * Jin et al. (2025): LLMs can diagnose the *breakdown* of cognitive processes
   * manifested as reasoning gaps or circular logic across multiple turns.
   */
  static analyzeDialogueHistory(utterances: string[]): {
    overallSeverity: OverloadSeverity;
    peakTurnIndex: number;
    trend: "improving" | "stable" | "worsening";
    perTurnStates: OverloadState[];
  } {
    if (utterances.length === 0) {
      return {
        overallSeverity: "none",
        peakTurnIndex: -1,
        trend: "stable",
        perTurnStates: [],
      };
    }

    const perTurnStates: OverloadState[] = utterances.map((u, i) =>
      this.detect(u, i > 0 ? utterances[i - 1] : "")
    );

    const severityOrder: OverloadSeverity[] = ["none", "mild", "moderate", "severe"];
    const severityIndex = (s: OverloadSeverity) => severityOrder.indexOf(s);

    const peakTurnIndex = perTurnStates.reduce(
      (maxIdx, state, i) =>
        severityIndex(state.severity) > severityIndex(perTurnStates[maxIdx].severity)
          ? i
          : maxIdx,
      0
    );
    const overallSeverity = perTurnStates[peakTurnIndex].severity;

    // Trend: compare first half vs second half average severity
    const mid = Math.floor(perTurnStates.length / 2);
    const firstHalfAvg =
      perTurnStates.slice(0, mid).reduce((s, t) => s + severityIndex(t.severity), 0) /
      Math.max(1, mid);
    const secondHalfAvg =
      perTurnStates.slice(mid).reduce((s, t) => s + severityIndex(t.severity), 0) /
      Math.max(1, perTurnStates.length - mid);

    let trend: "improving" | "stable" | "worsening" = "stable";
    if (secondHalfAvg > firstHalfAvg + 0.5) trend = "worsening";
    else if (firstHalfAvg > secondHalfAvg + 0.5) trend = "improving";

    return { overallSeverity, peakTurnIndex, trend, perTurnStates };
  }
}
