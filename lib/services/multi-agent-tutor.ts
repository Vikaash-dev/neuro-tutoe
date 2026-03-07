/**
 * Multi-Agent Tutor System
 * Inspired by DeepTutor's dual-loop reasoning and multi-agent architecture
 * Specialized agents for different tutoring roles
 */

export type AgentRole = "explainer" | "questioner" | "evaluator" | "socratic";

export interface AgentResponse {
  role: AgentRole;
  content: string;
  confidence: number; // 0-1
  metadata: {
    conceptsCovered: string[];
    questionsAsked: number;
    feedbackProvided: boolean;
  };
}

export interface MultiAgentTutorSession {
  studentId: string;
  conceptId: string;
  agents: Map<AgentRole, AgentState>;
  conversationHistory: AgentResponse[];
  currentPhase: "introduction" | "explanation" | "questioning" | "evaluation" | "reflection";
}

export interface AgentState {
  role: AgentRole;
  systemPrompt: string;
  responseCount: number;
  lastResponse: string | null;
  isActive: boolean;
}

export class MultiAgentTutorEngine {
  /**
   * Agent role definitions and responsibilities
   */
  static readonly AGENT_ROLES = {
    explainer: {
      name: "Explainer Agent",
      description: "Provides clear, comprehensive explanations of concepts",
      responsibility:
        "Break down complex ideas into understandable parts. Use analogies and examples.",
      systemPromptBase: `You are the Explainer Agent. Your role is to provide clear, comprehensive explanations.
      
RESPONSIBILITIES:
- Break down complex concepts into digestible parts
- Use analogies and real-world examples
- Provide visual descriptions when helpful
- Explain the "why" behind concepts, not just the "what"
- Adapt complexity to student level

STYLE:
- Clear and organized
- Use step-by-step breakdowns
- Include relevant examples
- Encourage questions`,
    },

    questioner: {
      name: "Questioner Agent",
      description: "Asks probing questions to deepen understanding",
      responsibility: "Generate questions that reveal gaps in understanding and promote critical thinking.",
      systemPromptBase: `You are the Questioner Agent. Your role is to ask probing questions.
      
RESPONSIBILITIES:
- Ask questions that reveal gaps in understanding
- Promote critical thinking and deeper analysis
- Guide students to discover answers themselves
- Adjust question difficulty based on responses
- Ask follow-up questions to probe deeper

STYLE:
- Curious and inquisitive tone
- Open-ended questions when possible
- Avoid yes/no questions unless strategic
- Build on previous responses`,
    },

    evaluator: {
      name: "Evaluator Agent",
      description: "Assesses understanding and provides constructive feedback",
      responsibility: "Evaluate student responses, identify misconceptions, and provide actionable feedback.",
      systemPromptBase: `You are the Evaluator Agent. Your role is to assess understanding.
      
RESPONSIBILITIES:
- Evaluate the correctness and depth of student responses
- Identify misconceptions and gaps
- Provide constructive, specific feedback
- Highlight strengths in student's thinking
- Suggest areas for improvement

STYLE:
- Supportive and constructive
- Specific and actionable feedback
- Balance praise with constructive criticism
- Focus on growth mindset`,
    },

    socratic: {
      name: "Socratic Agent",
      description: "Guides learning through Socratic questioning",
      responsibility:
        "Never directly answer. Guide student to discover answers through strategic questioning.",
      systemPromptBase: `You are the Socratic Agent. Your role is to guide through questioning.
      
RESPONSIBILITIES:
- Never directly provide answers
- Guide students to discover answers themselves
- Use strategic questioning to reveal thinking
- Help identify and resolve misconceptions
- Build confidence through guided discovery

STYLE:
- Curious and non-judgmental
- Patient and encouraging
- Questions that guide, not lecture
- Celebrate insights and correct reasoning`,
    },
  };

  /**
   * Create a new multi-agent tutoring session
   */
  static createSession(studentId: string, conceptId: string): MultiAgentTutorSession {
    const agents = new Map<AgentRole, AgentState>();

    const roles: AgentRole[] = ["explainer", "questioner", "evaluator", "socratic"];
    roles.forEach((role) => {
      agents.set(role, {
        role,
        systemPrompt: this.AGENT_ROLES[role].systemPromptBase,
        responseCount: 0,
        lastResponse: null,
        isActive: role === "explainer", // Start with explainer
      });
    });

    return {
      studentId,
      conceptId,
      agents,
      conversationHistory: [],
      currentPhase: "introduction",
    };
  }

  /**
   * Determine which agent should respond next based on session state
   */
  static selectNextAgent(
    session: MultiAgentTutorSession,
    studentResponse: string
  ): AgentRole {
    const responseLength = studentResponse.length;
    const responseCount = session.conversationHistory.length;

    // Phase-based agent selection
    switch (session.currentPhase) {
      case "introduction":
        return "explainer"; // Start with explanation

      case "explanation":
        // After explanation, move to questioning
        if (responseCount > 2) {
          return "questioner";
        }
        return "explainer";

      case "questioning":
        // If student seems confused, return to explanation
        if (responseLength < 20 || studentResponse.includes("don't understand")) {
          return "explainer";
        }
        // Otherwise continue questioning
        if (responseCount % 3 === 0) {
          return "evaluator"; // Periodic evaluation
        }
        return "questioner";

      case "evaluation":
        // Evaluate response, then decide next step
        if (responseCount % 4 === 0) {
          return "socratic"; // Introduce Socratic method
        }
        return "evaluator";

      case "reflection":
        // Final reflection with Socratic agent
        return "socratic";

      default:
        return "explainer";
    }
  }

  /**
   * Transition to next phase based on progress
   */
  static advancePhase(session: MultiAgentTutorSession): void {
    const phases: Array<"introduction" | "explanation" | "questioning" | "evaluation" | "reflection"> = [
      "introduction",
      "explanation",
      "questioning",
      "evaluation",
      "reflection",
    ];

    const currentIndex = phases.indexOf(session.currentPhase);
    if (currentIndex < phases.length - 1) {
      session.currentPhase = phases[currentIndex + 1];
    }
  }

  /**
   * Get system prompt for specific agent with context
   */
  static getAgentSystemPrompt(
    role: AgentRole,
    conceptName: string,
    studentLevel: number,
    studentName: string
  ): string {
    const basePrompt = this.AGENT_ROLES[role].systemPromptBase;

    return `${basePrompt}

CONTEXT:
- Student: ${studentName}
- Concept: ${conceptName}
- Level: ${studentLevel}/10
- Role: ${this.AGENT_ROLES[role].name}

Tailor your responses to this student's level and the current concept.`;
  }

  /**
   * Coordinate multi-agent response for complex questions
   */
  static async coordinateAgentResponse(
    session: MultiAgentTutorSession,
    studentInput: string,
    conceptName: string
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    // Determine which agents should respond
    const primaryAgent = this.selectNextAgent(session, studentInput);
    const secondaryAgent = this.getComplementaryAgent(primaryAgent);

    // Simulate agent responses (in real implementation, would call LLM)
    const primaryResponse: AgentResponse = {
      role: primaryAgent,
      content: `[${primaryAgent} response to: "${studentInput}"]`,
      confidence: 0.85,
      metadata: {
        conceptsCovered: [conceptName],
        questionsAsked: primaryAgent === "questioner" ? 1 : 0,
        feedbackProvided: primaryAgent === "evaluator",
      },
    };

    const secondaryResponse: AgentResponse = {
      role: secondaryAgent,
      content: `[${secondaryAgent} response building on ${primaryAgent}]`,
      confidence: 0.75,
      metadata: {
        conceptsCovered: [conceptName],
        questionsAsked: secondaryAgent === "questioner" ? 1 : 0,
        feedbackProvided: secondaryAgent === "evaluator",
      },
    };

    responses.push(primaryResponse, secondaryResponse);

    // Update session
    session.conversationHistory.push(...responses);
    const primaryAgentState = session.agents.get(primaryAgent);
    if (primaryAgentState) {
      primaryAgentState.responseCount += 1;
      primaryAgentState.lastResponse = primaryResponse.content;
    }

    return responses;
  }

  /**
   * Get complementary agent that works well with primary agent
   */
  static getComplementaryAgent(primaryAgent: AgentRole): AgentRole {
    const complements: Record<AgentRole, AgentRole> = {
      explainer: "questioner",
      questioner: "evaluator",
      evaluator: "socratic",
      socratic: "explainer",
    };
    return complements[primaryAgent];
  }

  /**
   * Generate multi-agent session summary
   */
  static generateSessionSummary(session: MultiAgentTutorSession): {
    totalResponses: number;
    agentContributions: Record<AgentRole, number>;
    conceptsCovered: string[];
    studentEngagement: "low" | "medium" | "high";
    recommendedNextStep: string;
  } {
    const agentContributions: Record<AgentRole, number> = {
      explainer: 0,
      questioner: 0,
      evaluator: 0,
      socratic: 0,
    };

    const conceptsSet = new Set<string>();

    session.conversationHistory.forEach((response) => {
      agentContributions[response.role] += 1;
      response.metadata.conceptsCovered.forEach((concept) => conceptsSet.add(concept));
    });

    const totalResponses = session.conversationHistory.length;
    const engagement =
      totalResponses > 10 ? "high" : totalResponses > 5 ? "medium" : ("low" as const);

    let recommendedNextStep = "Continue with current approach";
    if (engagement === "low") {
      recommendedNextStep = "Increase engagement with more interactive questions";
    } else if (engagement === "high") {
      recommendedNextStep = "Consider moving to next concept or deeper exploration";
    }

    return {
      totalResponses,
      agentContributions,
      conceptsCovered: Array.from(conceptsSet),
      studentEngagement: engagement,
      recommendedNextStep,
    };
  }
}
