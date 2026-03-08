/**
 * Feynman Mode Engine
 *
 * Generates system prompts for 4 teaching modes, implements the full
 * Ranedeer 10-level depth guide, and parses slash commands.
 *
 * Research basis:
 *   - arXiv:2506.09055 (IEEE TALE 2024) "Learn Like Feynman: Developing and Testing
 *     an AI-Driven Feynman Bot" — AI-as-confused-student validation
 *   - NeurIPS 2024 LbT "Can LLMs Learn by Teaching?" — Learning-by-Teaching (LbT)
 *     validates role-reversal as retrieval practice + schema consolidation
 *   - SocraticLM (NeurIPS 2024) — questions-only Socratic tutoring
 *   - arXiv:2512.03501 "SocraticAI" — Guided Query Framework for CS education
 *   - Mr. Ranedeer AI Tutor (JushBJJ 2023, GitHub 29.7k★) — 10-depth + 5D profile
 *   - Cognitive Load Theory (Sweller 1988) — dual coding, intrinsic/extraneous load
 *   - Bloom's 2 Sigma (1984) — mastery learning cycle embedded in mode transitions
 */

import {
  DepthLevel,
  FeynmanMode,
  FeynmanModeConfig,
  FeynmanSystemPrompt,
  ParsedCommand,
  UserLearningProfile,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Ranedeer 10-Level Depth Guide
// ---------------------------------------------------------------------------

export const DEPTH_LABELS: Readonly<Record<DepthLevel, string>> = {
  1: "Elementary (Grade 1–6)",
  2: "Middle School (Grade 7–9)",
  3: "High School (Grade 10–12)",
  4: "College Prep / Foundation",
  5: "Undergraduate",
  6: "Graduate (light research)",
  7: "Master's (advanced theory)",
  8: "Doctoral (cutting-edge research)",
  9: "Post-doctoral (field specialist)",
  10: "PhD-level peer",
};

export const DEPTH_INSTRUCTIONS: Readonly<Record<DepthLevel, string>> = {
  1:  "Use simple analogies. Avoid all jargon. Everyday examples only. Short sentences.",
  2:  "Use basic terms with brief explanations. Relate to familiar school topics.",
  3:  "Standard academic vocabulary is fine. Use textbook-level detail.",
  4:  "Introduce foundational technical concepts. Light formalism is acceptable.",
  5:  "Standard undergraduate depth. Define technical terms on first use.",
  6:  "Advanced concepts and light research references. Some mathematical notation is fine.",
  7:  "Research-level depth. Nuanced theoretical distinctions. Cite relevant frameworks.",
  8:  "Cutting-edge research. Mathematical rigor expected. Reference key papers.",
  9:  "Expert-level nuance, field-specific subtleties, unresolved debates.",
  10: "Peer-to-peer research discussion. Assume maximum expertise. Skip fundamentals.",
};

export const STYLE_INSTRUCTIONS: Readonly<
  Record<UserLearningProfile["learningStyle"], string>
> = {
  visual:
    "Use ASCII diagrams, spatial metaphors, and descriptions of visual structure.",
  verbal:
    "Prioritise clear prose. Use structured paragraphs with logical flow.",
  active:
    "Include worked examples, practice steps, and 'try this' prompts.",
  intuitive:
    "Lead with patterns and big-picture frameworks before details.",
  reflective:
    "Give the student thinking time. Pose reflective prompts after each explanation.",
  global:
    "Start with a high-level overview, then zoom in. Connect to the wider picture.",
};

export const COMMUNICATION_PREFIXES: Readonly<
  Record<UserLearningProfile["communication"], string>
> = {
  formal:     "Use formal academic register. Precise vocabulary, no contractions.",
  textbook:   "Write as a well-edited textbook — clear, structured, authoritative.",
  layman:     "Use everyday language, contractions, friendly tone.",
  story:      "Frame explanations as narratives with characters and analogies.",
  socratic:   "Intermix guiding questions throughout the explanation.",
};

// ---------------------------------------------------------------------------
// Mode descriptions and starter suggestions
// ---------------------------------------------------------------------------

const MODE_META: Readonly<
  Record<
    FeynmanMode,
    { description: string; starters: string[] }
  >
> = {
  explainer: {
    description: "AI teaches the concept with adaptive depth and dual-coded examples.",
    starters: [
      "Explain photosynthesis to me.",
      "What is recursion?",
      "How does compound interest work?",
    ],
  },
  student: {
    description:
      "AI plays a confused student — you teach it. (Feynman Technique / LbT NeurIPS 2024)",
    starters: [
      "I want to understand how sorting algorithms work.",
      "Teach me about the water cycle.",
      "I need help with Newton's laws.",
    ],
  },
  socratic: {
    description:
      "AI only asks guiding questions — never gives direct answers. (SocraticLM NeurIPS 2024)",
    starters: [
      "I'm trying to understand gravity.",
      "Help me figure out why interest rates affect inflation.",
      "Walk me through the proof of Pythagoras.",
    ],
  },
  rubber_duck: {
    description:
      "Think aloud; AI listens and gently nudges. Great for debugging mental models.",
    starters: [
      "I'm trying to figure out why my loop isn't working.",
      "Let me think through this maths problem…",
      "Something about this argument feels off…",
    ],
  },
};

// ---------------------------------------------------------------------------
// System prompt templates
// ---------------------------------------------------------------------------

function buildExplainerPrompt(cfg: FeynmanModeConfig): string {
  const profile = cfg.profile;
  const depthLabel = DEPTH_LABELS[profile.depth];
  const depthInst = DEPTH_INSTRUCTIONS[profile.depth];
  const styleInst = STYLE_INSTRUCTIONS[profile.learningStyle];
  const commPrefix = COMMUNICATION_PREFIXES[profile.communication];
  const lang = cfg.language ?? "English";

  const knownCtx =
    cfg.knownConcepts.length > 0
      ? `Concepts the student knows: ${cfg.knownConcepts.slice(0, 8).join(", ")}.`
      : "No prior concepts known yet.";

  const inProgressCtx =
    cfg.inProgressConcepts.length > 0
      ? `Currently learning: ${cfg.inProgressConcepts.slice(0, 4).join(", ")}.`
      : "";

  return `You are DeepFeynman, a world-class adaptive AI tutor grounded in cognitive science.

TEACHING MODE: EXPLAINER
Current topic: ${cfg.currentTopic}

STUDENT PROFILE (inferred by Adaptive Prompt Engine):
  Depth Level  : ${profile.depth}/10 — ${depthLabel}
  Learning Style: ${profile.learningStyle}
  Communication : ${profile.communication}
  Tone          : ${profile.tone}
  Reasoning     : ${profile.reasoning}

DEPTH INSTRUCTION:
${depthInst}

LEARNING STYLE INSTRUCTION:
${styleInst}

COMMUNICATION STYLE:
${commPrefix}

NEUROSCIENCE PRINCIPLES (apply in every response):
1. Cognitive Load Management: Keep explanations at the 85% challenge level — hard enough to grow, not overwhelming. Chunk information into ≤7 units.
2. Dual Coding: Pair text with an ASCII diagram or spatial metaphor when explaining structure or process.
3. Spaced Context: Reference previously discussed concepts to strengthen neural connections.
4. Active Recall Trigger: End each explanation with "Can you explain this back in your own words?" or a similar retrieval prompt.
5. Germane Load: Help the student build schema, not just facts.

KNOWLEDGE STATE:
${knownCtx}
${inProgressCtx}

RESPONSE FORMAT:
- Match depth level precisely. Never over- or under-explain.
- Respond in ${lang}.
- Be ${profile.tone}.
- If the student is confused, offer a simpler analogy before re-explaining.
`.trim();
}

function buildStudentPrompt(cfg: FeynmanModeConfig): string {
  const depth = cfg.profile.depth;
  let confusionInstruction: string;
  if (depth <= 3) {
    confusionInstruction =
      "Be very confused. Ask very basic clarifying questions about everyday vocabulary.";
  } else if (depth <= 6) {
    confusionInstruction =
      "Be moderately confused. Ask about specific concepts and how they connect.";
  } else {
    confusionInstruction =
      "Be mildly confused. Ask about edge cases, nuances, and formal rigor.";
  }

  return `You are a curious student learning "${cfg.currentTopic}" from the user.
Your job is to ROLEPLAY as a confused learner so the user must explain clearly.
This activates the Feynman Technique — teaching is the deepest form of learning.
(Validated by: NeurIPS 2024 LbT "Can LLMs Learn by Teaching?")

CONFUSION LEVEL (calibrated to depth ${depth}/10):
${confusionInstruction}

STRICT ROLEPLAY RULES:
1. NEVER give the answer yourself — you are here to learn, not to teach.
2. Ask exactly ONE clarifying question per response.
3. Mix up related concepts naturally (as real confused students do).
4. Use natural confused-student phrases:
   "Wait, so…", "I'm confused about…", "What do you mean by…",
   "Hold on, isn't that the same as…?", "I still don't get the part about…"
5. When the user explains something well, respond with a relieved follow-up:
   "Oh! So it's kind of like [relatable analogy]?" — then probe one step deeper.
6. After ~5 rounds of back-and-forth, summarise what you've learned to let the
   user check your (and their own) understanding.
7. If the user's explanation has a factual error, look confused in a way that
   exposes the inconsistency (e.g., "But earlier you said X…?").

CURRENT TOPIC: ${cfg.currentTopic}
YOUR KNOWLEDGE GAPS TO EXPLORE: ${
    cfg.inProgressConcepts.length > 0
      ? cfg.inProgressConcepts.join(", ")
      : "general foundations of the topic"
  }

Begin by saying "I'm trying to understand ${cfg.currentTopic}. Can you start with the basics?"
`.trim();
}

function buildSocraticPrompt(cfg: FeynmanModeConfig): string {
  return `You are a Socratic AI tutor. You guide student discovery through questions only.
You NEVER give direct answers.
(Based on: SocraticLM NeurIPS 2024, arXiv:2512.03501 SocraticAI)

CURRENT TOPIC: ${cfg.currentTopic}
STUDENT DEPTH: ${cfg.profile.depth}/10

SOCRATIC RULES (non-negotiable):
1. Every response MUST contain at least one guiding question.
2. Never state facts directly — reframe them as questions:
   ✗ "Photosynthesis converts light to energy."
   ✓ "What do you think plants need to make their own food?"
3. When the student is correct: "Exactly! So how does that connect to [next concept]?"
4. When the student is wrong: don't say "Wrong" — redirect:
   "Interesting — what happens if we test that with [counterexample]?"
5. Open with: "What do you already know about ${cfg.currentTopic}?"
6. Build Socratic chain: Clarifying → Probing → Hypothetical → Reflective → Meta

ADAPTIVE HINTS (only when confusion is very high):
- Add a gentle scaffold: "Think about what we discussed about [related concept]…"
- One hint per 3 questions maximum.

KNOWN STUDENT CONCEPTS: ${
    cfg.knownConcepts.slice(0, 5).join(", ") || "none yet"
  }

Remember: the goal is for the student to construct the understanding themselves.
The question is the answer.
`.trim();
}

function buildRubberDuckPrompt(cfg: FeynmanModeConfig): string {
  return `You are a rubber duck — the student is thinking aloud to you.
Your role is to listen actively and nudge gently when they get stuck.

CURRENT TOPIC: ${cfg.currentTopic}

RUBBER DUCK RULES:
1. Mostly listen. Keep responses SHORT: "Mm-hmm.", "Go on…", "Interesting — what makes you say that?"
2. Every 3–4 student messages, ask ONE strategic question to unstick them:
   "What exactly are you unsure about?"
   "Can you break that into smaller steps?"
   "What would have to be true for your approach to work?"
   "Is there a simpler version of this problem?"
3. If they reach a conclusion: "Nice insight — is there anything you haven't considered yet?"
4. NEVER give the answer, explain the concept, or confirm correctness directly.
5. If they explicitly ask "Am I right?", respond: "Walk me through your reasoning step by step."

This mode is ideal for: debugging mental models, working through problems, getting unstuck.
Silence is a valid response. Let the student lead.
`.trim();
}

// ---------------------------------------------------------------------------
// Feynman Mode Engine
// ---------------------------------------------------------------------------

/**
 * FeynmanModeEngine
 *
 * Builds system prompts, mode metadata, and parses slash commands.
 */
export class FeynmanModeEngine {
  /**
   * Build the complete system prompt for a given mode and profile.
   */
  static buildSystemPrompt(cfg: FeynmanModeConfig): FeynmanSystemPrompt {
    let systemPrompt: string;
    switch (cfg.mode) {
      case "explainer":
        systemPrompt = buildExplainerPrompt(cfg);
        break;
      case "student":
        systemPrompt = buildStudentPrompt(cfg);
        break;
      case "socratic":
        systemPrompt = buildSocraticPrompt(cfg);
        break;
      case "rubber_duck":
        systemPrompt = buildRubberDuckPrompt(cfg);
        break;
    }

    const meta = MODE_META[cfg.mode];
    return {
      mode: cfg.mode,
      systemPrompt,
      modeDescription: meta.description,
      suggestedStarters: meta.starters,
    };
  }

  /**
   * Determine which mode is most appropriate given APE signals and mastery.
   * Can be used to auto-suggest mode switches.
   *
   * Rules (from plan §9):
   * - confusionLevel > 0.7 → explainer
   * - mastery > 0.7 && confusionLevel < 0.3 → student (LbT)
   * - "why" question pattern && confusionLevel < 0.5 → socratic
   * - "rubber duck" never auto-selected (requires explicit user intent)
   */
  static recommendMode(options: {
    mastery: number;
    confusionLevel: number;
    lastUserMessage: string;
    currentMode: FeynmanMode;
  }): { recommendedMode: FeynmanMode; reason: string } {
    const { mastery, confusionLevel, lastUserMessage, currentMode } = options;
    const lowerMsg = lastUserMessage.toLowerCase();

    if (confusionLevel > 0.7) {
      return { recommendedMode: "explainer", reason: "High confusion detected — switching to direct explanation." };
    }
    if (mastery > 0.7 && confusionLevel < 0.3) {
      return {
        recommendedMode: "student",
        reason: "Good mastery detected — role-reversal (LbT) will consolidate understanding.",
      };
    }
    if (
      (lowerMsg.includes("why") || lowerMsg.includes("how does") || lowerMsg.includes("what if")) &&
      confusionLevel < 0.5 &&
      !lowerMsg.includes("i don't understand why")
    ) {
      return {
        recommendedMode: "socratic",
        reason: "Conceptual inquiry detected — Socratic mode guides discovery.",
      };
    }
    return { recommendedMode: currentMode, reason: "Current mode is appropriate." };
  }

  /**
   * Get human-readable mode metadata without building a full prompt.
   */
  static getModeInfo(mode: FeynmanMode): { description: string; starters: string[] } {
    return { ...MODE_META[mode] };
  }

  /**
   * Return all four modes with descriptions (useful for a mode-picker UI).
   */
  static allModes(): Array<{ mode: FeynmanMode; description: string }> {
    return (Object.keys(MODE_META) as FeynmanMode[]).map((m) => ({
      mode: m,
      description: MODE_META[m].description,
    }));
  }
}

// ---------------------------------------------------------------------------
// Command Parser
// ---------------------------------------------------------------------------

export const VALID_COMMANDS = [
  "/test",
  "/config",
  "/plan",
  "/explain",
  "/teach",
  "/socratic",
  "/duck",
  "/review",
  "/graph",
  "/depth",
  "/style",
] as const;

export type ValidCommand = (typeof VALID_COMMANDS)[number];

/** Maps each command to its target FeynmanMode (null = no mode change) */
export const COMMAND_MODE_MAP: Partial<Record<ValidCommand, FeynmanMode>> = {
  "/explain":  "explainer",
  "/teach":    "student",
  "/socratic": "socratic",
  "/duck":     "rubber_duck",
};

/**
 * CommandParser
 *
 * Parses slash commands entered in the chat input.
 * Returns a structured `ParsedCommand` for the UI to act on.
 */
export class CommandParser {
  static parse(input: string): ParsedCommand {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) {
      return { command: "", valid: false, errorMessage: "Not a command." };
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const argument = parts.slice(1).join(" ") || undefined;

    if (!(VALID_COMMANDS as readonly string[]).includes(command)) {
      return {
        command,
        argument,
        valid: false,
        errorMessage: `Unknown command '${command}'. Valid commands: ${VALID_COMMANDS.join(", ")}`,
      };
    }

    // Validate /depth argument
    if (command === "/depth") {
      const n = Number(argument);
      if (!argument || isNaN(n) || n < 1 || n > 10) {
        return {
          command,
          argument,
          valid: false,
          errorMessage: "/depth requires a number between 1 and 10.",
        };
      }
    }

    // Validate /style argument
    const VALID_STYLES = ["visual", "verbal", "active", "intuitive", "reflective", "global"];
    if (command === "/style") {
      if (!argument || !VALID_STYLES.includes(argument.toLowerCase())) {
        return {
          command,
          argument,
          valid: false,
          errorMessage: `/style requires one of: ${VALID_STYLES.join(", ")}.`,
        };
      }
    }

    return { command, argument, valid: true };
  }

  /** Returns the target FeynmanMode for a mode-switching command, or null. */
  static getModeForCommand(command: string): FeynmanMode | null {
    return COMMAND_MODE_MAP[command as ValidCommand] ?? null;
  }

  /** True if the command triggers a Feynman mode switch. */
  static isModeSwitch(command: string): boolean {
    return command in COMMAND_MODE_MAP;
  }
}
