/**
 * Dual-Loop Multi-Agent System
 * Combines NeuroTutor's Feynman Technique with DeepTutor's dual-loop reasoning
 * Analysis Loop: InvestigateAgent → NoteAgent
 * Solve Loop: PlanAgent → ManagerAgent → SolveAgent → CheckAgent
 */

export interface AgentMessage {
  agentName: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AgentContext {
  topic: string;
  question: string;
  studentLevel: number;
  conversationHistory: AgentMessage[];
  knowledgeGraph: Record<string, unknown>;
}

export interface AgentResponse {
  agentName: string;
  response: string;
  reasoning: string;
  nextAgent?: string;
  confidence: number;
}

/**
 * Base Agent Class
 */
abstract class BaseAgent {
  protected name: string;
  protected role: string;

  constructor(name: string, role: string) {
    this.name = name;
    this.role = role;
  }

  abstract process(context: AgentContext): Promise<AgentResponse>;

  protected async callLLM(prompt: string): Promise<string> {
    // In production, call actual LLM (Gemini, OpenAI, etc.)
    // For now, return mock response
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `Mock response from ${this.name}: ${prompt.substring(0, 50)}...`;
  }
}

/**
 * ANALYSIS LOOP AGENTS
 */

/**
 * InvestigateAgent - Analyzes the problem domain
 * Breaks down the question into components
 */
class InvestigateAgent extends BaseAgent {
  constructor() {
    super("InvestigateAgent", "analyzer");
  }

  async process(context: AgentContext): Promise<AgentResponse> {
    const prompt = `Analyze the question: "${context.question}"
    
    Break it down into:
    1. Key concepts involved
    2. Prerequisites needed
    3. Complexity level
    4. Related topics
    
    Topic: ${context.topic}
    Student Level: ${context.studentLevel}/10`;

    const response = await this.callLLM(prompt);

    return {
      agentName: this.name,
      response,
      reasoning: "Analyzed question structure and identified key components",
      nextAgent: "NoteAgent",
      confidence: 0.85,
    };
  }
}

/**
 * NoteAgent - Extracts and organizes key information
 * Creates structured notes from investigation
 */
class NoteAgent extends BaseAgent {
  constructor() {
    super("NoteAgent", "organizer");
  }

  async process(context: AgentContext): Promise<AgentResponse> {
    const prompt = `Based on the investigation of "${context.question}",
    
    Create structured notes:
    1. Main concepts
    2. Key facts
    3. Important relationships
    4. Potential misconceptions
    
    Format as actionable learning points for student level ${context.studentLevel}`;

    const response = await this.callLLM(prompt);

    return {
      agentName: this.name,
      response,
      reasoning: "Organized key information into structured learning notes",
      nextAgent: "PlanAgent",
      confidence: 0.8,
    };
  }
}

/**
 * SOLVE LOOP AGENTS
 */

/**
 * PlanAgent - Develops solution strategy
 * Creates step-by-step plan using Feynman Technique
 */
class PlanAgent extends BaseAgent {
  constructor() {
    super("PlanAgent", "strategist");
  }

  async process(context: AgentContext): Promise<AgentResponse> {
    const prompt = `Create a Feynman-style teaching plan for: "${context.question}"
    
    Use Feynman's 4 steps:
    1. Teach it simply (as if to a child)
    2. Identify gaps
    3. Simplify and refine
    4. Teach again with analogies
    
    Adapt to student level: ${context.studentLevel}/10`;

    const response = await this.callLLM(prompt);

    return {
      agentName: this.name,
      response,
      reasoning: "Developed Feynman-based teaching strategy",
      nextAgent: "ManagerAgent",
      confidence: 0.9,
    };
  }
}

/**
 * ManagerAgent - Orchestrates the solution process
 * Coordinates between agents and manages flow
 */
class ManagerAgent extends BaseAgent {
  constructor() {
    super("ManagerAgent", "orchestrator");
  }

  async process(context: AgentContext): Promise<AgentResponse> {
    const prompt = `Orchestrate the solution for: "${context.question}"
    
    Coordinate:
    1. Which agents to call
    2. In what order
    3. How to combine their outputs
    4. Quality gates to pass
    
    Current context: ${JSON.stringify(context.conversationHistory.slice(-2))}`;

    const response = await this.callLLM(prompt);

    return {
      agentName: this.name,
      response,
      reasoning: "Orchestrated multi-agent solution process",
      nextAgent: "SolveAgent",
      confidence: 0.85,
    };
  }
}

/**
 * SolveAgent - Executes the solution
 * Generates detailed explanation following the plan
 */
class SolveAgent extends BaseAgent {
  constructor() {
    super("SolveAgent", "executor");
  }

  async process(context: AgentContext): Promise<AgentResponse> {
    const prompt = `Execute the solution for: "${context.question}"
    
    Provide:
    1. Step-by-step explanation
    2. Real-world examples
    3. Visual analogies
    4. Key takeaways
    
    Maintain Feynman's principle: Explain simply without jargon
    Student level: ${context.studentLevel}/10`;

    const response = await this.callLLM(prompt);

    return {
      agentName: this.name,
      response,
      reasoning: "Generated detailed solution with explanations",
      nextAgent: "CheckAgent",
      confidence: 0.88,
    };
  }
}

/**
 * CheckAgent - Validates solution quality
 * Ensures accuracy and completeness
 */
class CheckAgent extends BaseAgent {
  constructor() {
    super("CheckAgent", "validator");
  }

  async process(context: AgentContext): Promise<AgentResponse> {
    const prompt = `Validate the solution for: "${context.question}"
    
    Check:
    1. Accuracy of explanation
    2. Completeness
    3. Clarity for student level ${context.studentLevel}
    4. Misconception prevention
    5. Engagement level
    
    Provide quality score and suggestions`;

    const response = await this.callLLM(prompt);

    return {
      agentName: this.name,
      response,
      reasoning: "Validated solution quality and completeness",
      nextAgent: undefined,
      confidence: 0.82,
    };
  }
}

/**
 * Dual-Loop Reasoning Orchestrator
 * Manages Analysis Loop and Solve Loop
 */
export class DualLoopOrchestrator {
  private investigateAgent: InvestigateAgent;
  private noteAgent: NoteAgent;
  private planAgent: PlanAgent;
  private managerAgent: ManagerAgent;
  private solveAgent: SolveAgent;
  private checkAgent: CheckAgent;

  constructor() {
    this.investigateAgent = new InvestigateAgent();
    this.noteAgent = new NoteAgent();
    this.planAgent = new PlanAgent();
    this.managerAgent = new ManagerAgent();
    this.solveAgent = new SolveAgent();
    this.checkAgent = new CheckAgent();
  }

  /**
   * Run full dual-loop reasoning process
   */
  async runDualLoop(context: AgentContext): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    // ANALYSIS LOOP
    console.log("Starting Analysis Loop...");

    // InvestigateAgent
    const investigateResponse = await this.investigateAgent.process(context);
    responses.push(investigateResponse);
    context.conversationHistory.push({
      agentName: investigateResponse.agentName,
      role: "assistant",
      content: investigateResponse.response,
      timestamp: Date.now(),
    });

    // NoteAgent
    const noteResponse = await this.noteAgent.process(context);
    responses.push(noteResponse);
    context.conversationHistory.push({
      agentName: noteResponse.agentName,
      role: "assistant",
      content: noteResponse.response,
      timestamp: Date.now(),
    });

    // SOLVE LOOP
    console.log("Starting Solve Loop...");

    // PlanAgent
    const planResponse = await this.planAgent.process(context);
    responses.push(planResponse);
    context.conversationHistory.push({
      agentName: planResponse.agentName,
      role: "assistant",
      content: planResponse.response,
      timestamp: Date.now(),
    });

    // ManagerAgent
    const managerResponse = await this.managerAgent.process(context);
    responses.push(managerResponse);
    context.conversationHistory.push({
      agentName: managerResponse.agentName,
      role: "assistant",
      content: managerResponse.response,
      timestamp: Date.now(),
    });

    // SolveAgent
    const solveResponse = await this.solveAgent.process(context);
    responses.push(solveResponse);
    context.conversationHistory.push({
      agentName: solveResponse.agentName,
      role: "assistant",
      content: solveResponse.response,
      timestamp: Date.now(),
    });

    // CheckAgent
    const checkResponse = await this.checkAgent.process(context);
    responses.push(checkResponse);
    context.conversationHistory.push({
      agentName: checkResponse.agentName,
      role: "assistant",
      content: checkResponse.response,
      timestamp: Date.now(),
    });

    return responses;
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): BaseAgent | null {
    const agents: Record<string, BaseAgent> = {
      InvestigateAgent: this.investigateAgent,
      NoteAgent: this.noteAgent,
      PlanAgent: this.planAgent,
      ManagerAgent: this.managerAgent,
      SolveAgent: this.solveAgent,
      CheckAgent: this.checkAgent,
    };

    return agents[name] || null;
  }

  /**
   * Combine all agent responses into final answer
   */
  combineResponses(responses: AgentResponse[]): string {
    let combined = "## Multi-Agent Analysis\n\n";

    combined += "### Analysis Loop\n";
    combined += `**${responses[0]?.agentName}**: ${responses[0]?.response}\n\n`;
    combined += `**${responses[1]?.agentName}**: ${responses[1]?.response}\n\n`;

    combined += "### Solve Loop\n";
    for (let i = 2; i < responses.length; i++) {
      combined += `**${responses[i]?.agentName}**: ${responses[i]?.response}\n\n`;
    }

    return combined;
  }

  /**
   * Get reasoning chain
   */
  getReasoningChain(responses: AgentResponse[]): string {
    return responses.map((r) => `${r.agentName}: ${r.reasoning}`).join(" → ");
  }
}

// Export singleton instance
export const dualLoopOrchestrator = new DualLoopOrchestrator();
