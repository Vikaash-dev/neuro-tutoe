import { describe, it, expect } from "vitest";
import { AdaptiveDepth10LevelEngine } from "../adaptive-depth-10-level";
import { SocraticDialogueEngine } from "../socratic-dialogue";
import { MultiAgentTutorEngine } from "../multi-agent-tutor";

describe("Adaptive Depth 10-Level System", () => {
  it("should have all 10 depth levels defined", () => {
    const levels = AdaptiveDepth10LevelEngine.getAllDepthLevels();
    expect(levels).toHaveLength(10);
    expect(levels[0]).toBe("elementary");
    expect(levels[9]).toBe("expert_researcher");
  });

  it("should get correct depth level config", () => {
    const config = AdaptiveDepth10LevelEngine.getDepthConfig("high_school");
    expect(config.name).toBe("High School (Standard)");
    expect(config.conceptComplexity).toBe(3);
    expect(config.vocabulary).toBe("advanced");
  });

  it("should recommend next depth level for excellent performance", () => {
    const recommended = AdaptiveDepth10LevelEngine.recommendDepthLevel("high_school", 90, 0.9);
    expect(recommended).toBe("advanced_hs");
  });

  it("should recommend previous depth level for poor performance", () => {
    const recommended = AdaptiveDepth10LevelEngine.recommendDepthLevel("high_school", 40, 0.3);
    expect(recommended).toBe("middle_school");
  });

  it("should stay at current level for medium performance", () => {
    const recommended = AdaptiveDepth10LevelEngine.recommendDepthLevel("high_school", 65, 0.6);
    expect(recommended).toBe("high_school");
  });

  it("should generate appropriate system prompt modifier", () => {
    const prompt = AdaptiveDepth10LevelEngine.getSystemPromptModifier("elementary");
    expect(prompt).toContain("simple words");
  });

  it("should generate full tutor system prompt", () => {
    const prompt = AdaptiveDepth10LevelEngine.generateTutorSystemPrompt(
      "Base prompt",
      "high_school",
      "Alice"
    );
    expect(prompt).toContain("Base prompt");
    expect(prompt).toContain("High School");
  });

  it("should determine if student is ready to advance", () => {
    const isReady = AdaptiveDepth10LevelEngine.isReadyToAdvance("high_school", 85, 120, 5);
    expect(isReady).toBe(true);
  });

  it("should not allow advancement past expert level", () => {
    const isReady = AdaptiveDepth10LevelEngine.isReadyToAdvance("expert_researcher", 100, 1000, 100);
    expect(isReady).toBe(false);
  });

  it("should create student profile", () => {
    const profile = AdaptiveDepth10LevelEngine.createStudentProfile("high_school");
    expect(profile.currentLevel).toBe("high_school");
    expect(profile.targetLevel).toBe("expert_researcher");
    expect(profile.learningVelocity).toBe(0.5);
  });

  it("should update student profile based on performance", () => {
    const profile = AdaptiveDepth10LevelEngine.createStudentProfile("high_school");
    const updated = AdaptiveDepth10LevelEngine.updateStudentProfile(profile, "concept1", 90, 0.9);
    expect(updated.conceptDepths["concept1"]).toBe("advanced_hs");
    expect(updated.recommendedNextLevel).toBe("advanced_hs");
  });

  it("should get explanation complexity guidance", () => {
    const guidance = AdaptiveDepth10LevelEngine.getExplanationGuidance("elementary");
    expect(guidance.useFormulas).toBe(false);
    expect(guidance.includeProofs).toBe(false);

    const advancedGuidance = AdaptiveDepth10LevelEngine.getExplanationGuidance("phd_candidate");
    expect(advancedGuidance.useFormulas).toBe(true);
    expect(advancedGuidance.includeProofs).toBe(true);
    expect(advancedGuidance.referenceResearch).toBe(true);
  });
});

describe("Socratic Dialogue Engine", () => {
  it("should generate initial Socratic question", () => {
    const question = SocraticDialogueEngine.generateInitialQuestion("photosynthesis", "Photosynthesis", 5);
    expect(question.questionType).toBe("clarification");
    expect(question.targetConcept).toBe("photosynthesis");
    expect(question.question).toContain("Photosynthesis");
  });

  it("should evaluate correct student response", () => {
    const response = SocraticDialogueEngine.evaluateStudentResponse(
      "Photosynthesis is the process where plants convert sunlight into chemical energy",
      ["photosynthesis", "sunlight", "chemical energy"],
      "clarification",
      "photosynthesis"
    );
    expect(response.isCorrectDirection).toBe(true);
    expect(response.misunderstandings).toHaveLength(0);
    expect(response.nextQuestion).not.toBeNull();
  });

  it("should evaluate partially correct response", () => {
    const response = SocraticDialogueEngine.evaluateStudentResponse(
      "Plants use sunlight",
      ["photosynthesis", "sunlight", "chemical energy"],
      "clarification",
      "photosynthesis"
    );
    expect(response.isCorrectDirection).toBe(true);
    expect(response.nextQuestion?.questionType).toBe("probing");
  });

  it("should detect absolute statement misconception", () => {
    const response = SocraticDialogueEngine.evaluateStudentResponse(
      "Plants always need sunlight",
      ["photosynthesis", "sunlight"],
      "clarification",
      "photosynthesis"
    );
    expect(response.misunderstandings.length).toBeGreaterThan(0);
  });

  it("should generate Socratic system prompt", () => {
    const prompt = SocraticDialogueEngine.generateSocraticSystemPrompt("Alice", "Photosynthesis");
    expect(prompt).toContain("Socratic");
    expect(prompt).toContain("Alice");
    expect(prompt).toContain("Photosynthesis");
    expect(prompt).toContain("NEVER directly answer");
  });

  it("should create Socratic session", () => {
    const session = SocraticDialogueEngine.createSession("photosynthesis", "Photosynthesis", "Alice");
    expect(session.conceptId).toBe("photosynthesis");
    expect(session.studentName).toBe("Alice");
    expect(session.questionsAsked).toBe(0);
    expect(session.correctAnswers).toBe(0);
  });

  it("should update session with student response", () => {
    let session = SocraticDialogueEngine.createSession("photosynthesis", "Photosynthesis", "Alice");
    session = SocraticDialogueEngine.updateSession(session, "Plants convert sunlight to energy", true);
    expect(session.questionsAsked).toBe(1);
    expect(session.correctAnswers).toBe(1);
    expect(session.studentResponses).toHaveLength(1);
  });

  it("should calculate Socratic metrics", () => {
    let session = SocraticDialogueEngine.createSession("photosynthesis", "Photosynthesis", "Alice");
    session = SocraticDialogueEngine.updateSession(session, "Response 1", true);
    session = SocraticDialogueEngine.updateSession(session, "Response 2", true);
    session = SocraticDialogueEngine.updateSession(session, "Response 3", false);

    const metrics = SocraticDialogueEngine.calculateMetrics(session);
    expect(metrics.accuracy).toBe((2 / 3) * 100);
    expect(metrics.questionsNeeded).toBe(3);
  });
});

describe("Multi-Agent Tutor Engine", () => {
  it("should have all agent roles defined", () => {
    const roles = Object.keys(MultiAgentTutorEngine.AGENT_ROLES);
    expect(roles).toContain("explainer");
    expect(roles).toContain("questioner");
    expect(roles).toContain("evaluator");
    expect(roles).toContain("socratic");
  });

  it("should create multi-agent session", () => {
    const session = MultiAgentTutorEngine.createSession("student1", "photosynthesis");
    expect(session.studentId).toBe("student1");
    expect(session.conceptId).toBe("photosynthesis");
    expect(session.agents.size).toBe(4);
    expect(session.currentPhase).toBe("introduction");
  });

  it("should select explainer agent for introduction phase", () => {
    const session = MultiAgentTutorEngine.createSession("student1", "photosynthesis");
    const nextAgent = MultiAgentTutorEngine.selectNextAgent(session, "Tell me about photosynthesis");
    expect(nextAgent).toBe("explainer");
  });

  it("should advance to next phase", () => {
    const session = MultiAgentTutorEngine.createSession("student1", "photosynthesis");
    expect(session.currentPhase).toBe("introduction");
    MultiAgentTutorEngine.advancePhase(session);
    expect(session.currentPhase).toBe("explanation");
  });

  it("should get complementary agent", () => {
    expect(MultiAgentTutorEngine.getComplementaryAgent("explainer")).toBe("questioner");
    expect(MultiAgentTutorEngine.getComplementaryAgent("questioner")).toBe("evaluator");
    expect(MultiAgentTutorEngine.getComplementaryAgent("evaluator")).toBe("socratic");
    expect(MultiAgentTutorEngine.getComplementaryAgent("socratic")).toBe("explainer");
  });

  it("should generate agent system prompt", () => {
    const prompt = MultiAgentTutorEngine.getAgentSystemPrompt("explainer", "Photosynthesis", 5, "Alice");
    expect(prompt).toContain("Explainer Agent");
    expect(prompt).toContain("Photosynthesis");
    expect(prompt).toContain("Alice");
    expect(prompt).toContain("Level: 5/10");
  });

  it("should generate session summary", () => {
    const session = MultiAgentTutorEngine.createSession("student1", "photosynthesis");

    session.conversationHistory.push({
      role: "explainer",
      content: "Explanation...",
      confidence: 0.9,
      metadata: {
        conceptsCovered: ["photosynthesis"],
        questionsAsked: 0,
        feedbackProvided: false,
      },
    });

    session.conversationHistory.push({
      role: "questioner",
      content: "Question...",
      confidence: 0.85,
      metadata: {
        conceptsCovered: ["photosynthesis"],
        questionsAsked: 1,
        feedbackProvided: false,
      },
    });

    const summary = MultiAgentTutorEngine.generateSessionSummary(session);
    expect(summary.totalResponses).toBe(2);
    expect(summary.agentContributions.explainer).toBe(1);
    expect(summary.agentContributions.questioner).toBe(1);
    expect(summary.conceptsCovered).toContain("photosynthesis");
  });
});
