/**
 * Socratic Dialogue Mode
 * AI guides student to answer through questions, never directly answers
 * Based on Socratic method: "I know that I know nothing" - Socrates
 *
 * Research: "Beyond Answers: LLM-Powered Tutoring System in Physics Education"
 * arXiv:2406.10934 - Shows Socratic questioning achieves deep learning
 */

export interface SocraticQuestion {
  question: string;
  questionType: "clarification" | "probing" | "leading" | "reflective" | "evaluative";
  difficulty: number; // 1-10
  targetConcept: string;
  expectedAnswerGuidance: string;
}

export interface SocraticResponse {
  feedback: string;
  nextQuestion: SocraticQuestion | null;
  isCorrectDirection: boolean;
  misunderstandings: string[];
  encouragement: string;
}

export interface SocraticSession {
  conceptId: string;
  studentName: string;
  startTime: Date;
  questionsAsked: number;
  correctAnswers: number;
  studentResponses: string[];
  sessionNotes: string;
}

export class SocraticDialogueEngine {
  /**
   * Socratic question types and their purposes
   */
  static readonly QUESTION_TYPES = {
    clarification: {
      description: "Asks student to clarify their thinking",
      examples: [
        "Can you explain what you mean by that?",
        "How did you arrive at that conclusion?",
        "What do you mean by [term]?",
      ],
    },
    probing: {
      description: "Digs deeper into student's understanding",
      examples: [
        "Why do you think that's true?",
        "What evidence supports that?",
        "Have you considered the opposite?",
      ],
    },
    leading: {
      description: "Guides student toward correct answer without stating it",
      examples: [
        "What would happen if we changed this variable?",
        "How does this relate to what we learned about [concept]?",
        "Can you think of a similar example?",
      ],
    },
    reflective: {
      description: "Asks student to reflect on their learning",
      examples: [
        "What have you learned so far?",
        "How does this connect to your previous knowledge?",
        "What would you do differently next time?",
      ],
    },
    evaluative: {
      description: "Asks student to evaluate their own understanding",
      examples: [
        "How confident are you in that answer?",
        "What would convince you that you're right?",
        "What are the limitations of your answer?",
      ],
    },
  };

  /**
   * Generate initial Socratic question for a concept
   */
  static generateInitialQuestion(
    conceptId: string,
    conceptName: string,
    studentLevel: number // 1-10
  ): SocraticQuestion {
    const difficulty = Math.min(studentLevel, 8); // Cap at 8 for initial question

    return {
      question: `Before we dive into ${conceptName}, I'd like to understand what you already know. What comes to mind when you think about ${conceptName}?`,
      questionType: "clarification",
      difficulty,
      targetConcept: conceptId,
      expectedAnswerGuidance: "Student should provide their current understanding, even if incomplete or partially incorrect.",
    };
  }

  /**
   * Evaluate student response and generate Socratic feedback
   */
  static evaluateStudentResponse(
    studentResponse: string,
    expectedConcepts: string[],
    questionType: "clarification" | "probing" | "leading" | "reflective" | "evaluative",
    conceptId: string
  ): SocraticResponse {
    // Analyze response for key concepts
    const responseLower = studentResponse.toLowerCase();
    const foundConcepts = expectedConcepts.filter((concept) =>
      responseLower.includes(concept.toLowerCase())
    );
    const missingConcepts = expectedConcepts.filter(
      (concept) => !responseLower.includes(concept.toLowerCase())
    );

    const isCorrectDirection = foundConcepts.length > 0;
    const misunderstandings: string[] = [];

    // Detect common misconceptions
    if (responseLower.includes("always") || responseLower.includes("never")) {
      misunderstandings.push("Absolute statements may be too broad. Are there exceptions?");
    }
    if (responseLower.includes("because") && responseLower.length < 50) {
      misunderstandings.push("Your reasoning is brief. Can you elaborate on why that's the case?");
    }

    // Generate next question based on response quality
    let nextQuestion: SocraticQuestion | null = null;

    if (isCorrectDirection && missingConcepts.length === 0) {
      // Student got it right - ask reflective question
      nextQuestion = {
        question: `Excellent! You've identified the key points. Now, how does this apply to real-world situations? Can you think of an example?`,
        questionType: "reflective",
        difficulty: Math.min(8, 5 + 1),
        targetConcept: conceptId,
        expectedAnswerGuidance: "Student should provide a concrete example applying the concept.",
      };
    } else if (isCorrectDirection && missingConcepts.length > 0) {
      // Partially correct - ask probing question
      nextQuestion = {
        question: `You're on the right track! You mentioned ${foundConcepts[0]}. But I'm curious - what about ${missingConcepts[0]}? How does that fit in?`,
        questionType: "probing",
        difficulty: 5,
        targetConcept: conceptId,
        expectedAnswerGuidance: `Student should explain the relationship between ${foundConcepts[0]} and ${missingConcepts[0]}.`,
      };
    } else {
      // Incorrect direction - ask leading question
      nextQuestion = {
        question: `Interesting perspective. Let me ask this differently: What would happen if we looked at this from the perspective of [related concept]? How would that change your answer?`,
        questionType: "leading",
        difficulty: 4,
        targetConcept: conceptId,
        expectedAnswerGuidance: "Student should reconsider their answer through a different lens.",
      };
    }

    // Generate encouragement
    const encouragements = [
      "That's a thoughtful response!",
      "I appreciate your thinking on this.",
      "You're asking good questions.",
      "That shows you're really engaging with the material.",
      "I like how you're approaching this.",
    ];
    const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

    return {
      feedback: `${encouragement} ${
        isCorrectDirection
          ? "You've identified some important aspects."
          : "Let's explore this a bit more together."
      }`,
      nextQuestion,
      isCorrectDirection,
      misunderstandings,
      encouragement,
    };
  }

  /**
   * Generate Socratic system prompt for LLM
   */
  static generateSocraticSystemPrompt(studentName: string, conceptName: string): string {
    return `You are a Socratic tutor using the Socratic method to help ${studentName} understand ${conceptName}.

CRITICAL RULES:
1. NEVER directly answer questions or provide the answer
2. ALWAYS ask questions to guide the student to discover the answer themselves
3. Ask clarifying questions when the student's understanding is unclear
4. Use leading questions to guide toward correct understanding
5. Acknowledge correct thinking and probe deeper
6. When student is wrong, ask questions that reveal the misconception

QUESTION PROGRESSION:
- Start with clarification questions about their current understanding
- Use probing questions to deepen their thinking
- Use leading questions to guide toward correct answers
- Use reflective questions to consolidate learning
- Use evaluative questions to assess their confidence

TONE:
- Encouraging and supportive
- Curious and genuinely interested in their thinking
- Never condescending or dismissive
- Celebrate their insights and correct reasoning

EXAMPLE RESPONSES:
❌ WRONG: "That's incorrect. The answer is actually..."
✅ RIGHT: "Interesting! Can you walk me through how you arrived at that conclusion?"

❌ WRONG: "You're missing the fact that..."
✅ RIGHT: "You've covered some important points. What about [related concept]? How does that fit in?"

❌ WRONG: "Think about it differently."
✅ RIGHT: "Let me ask this: If we approached it from the perspective of [different angle], what would change?"`;
  }

  /**
   * Create a new Socratic session
   */
  static createSession(
    conceptId: string,
    conceptName: string,
    studentName: string
  ): SocraticSession {
    return {
      conceptId,
      studentName,
      startTime: new Date(),
      questionsAsked: 0,
      correctAnswers: 0,
      studentResponses: [],
      sessionNotes: `Socratic session on ${conceptName} for ${studentName}`,
    };
  }

  /**
   * Update session with student response
   */
  static updateSession(
    session: SocraticSession,
    studentResponse: string,
    isCorrect: boolean
  ): SocraticSession {
    session.studentResponses.push(studentResponse);
    session.questionsAsked += 1;
    if (isCorrect) {
      session.correctAnswers += 1;
    }
    return session;
  }

  /**
   * Calculate Socratic learning metrics
   */
  static calculateMetrics(session: SocraticSession): {
    accuracy: number;
    questionsNeeded: number;
    engagementLevel: "low" | "medium" | "high";
    recommendedNextStep: string;
  } {
    const accuracy =
      session.questionsAsked > 0 ? (session.correctAnswers / session.questionsAsked) * 100 : 0;
    const questionsNeeded = session.questionsAsked;

    let engagementLevel: "low" | "medium" | "high" = "medium";
    if (questionsNeeded > 10) engagementLevel = "high"; // Student engaged deeply
    if (questionsNeeded < 3) engagementLevel = "low"; // Student answered quickly

    let recommendedNextStep = "Continue with more challenging questions";
    if (accuracy > 80) {
      recommendedNextStep = "Move to next concept or apply learning to real-world scenarios";
    } else if (accuracy < 50) {
      recommendedNextStep = "Revisit foundational concepts before advancing";
    }

    return {
      accuracy,
      questionsNeeded,
      engagementLevel,
      recommendedNextStep,
    };
  }
}
