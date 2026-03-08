/**
 * Comprehensive Tests for DeepTutor-Inspired Enhancements
 * Tests RAG Pipeline, Web Search, Exam Mimicking, Dual-Loop Agents, and Code Executor
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RAGPipelineService } from "../rag-pipeline";
import { WebSearchService } from "../web-search";
import { ExamQuestionMimicService } from "../exam-question-mimic";
import { DualLoopOrchestrator } from "../dual-loop-agents";
import { CodeExecutorService } from "../code-executor";

describe("DeepTutor-Inspired Enhancements", () => {
  describe("RAG Pipeline Service", () => {
    let ragService: RAGPipelineService;

    beforeEach(() => {
      ragService = new RAGPipelineService();
    });

    it("should create a knowledge base", async () => {
      const kb = await ragService.createKnowledgeBase("Math", "Mathematics concepts");
      expect(kb.name).toBe("Math");
      expect(kb.description).toBe("Mathematics concepts");
      expect(kb.id).toMatch(/^kb_/);
    });

    it("should add document to knowledge base", async () => {
      const kb = await ragService.createKnowledgeBase("Science", "Science topics");
      const doc = await ragService.addDocument(
        kb.id,
        "Photosynthesis",
        "Photosynthesis is the process by which plants convert light energy into chemical energy...",
        "txt",
        "Biology Textbook"
      );

      expect(doc.title).toBe("Photosynthesis");
      expect(doc.type).toBe("txt");
      expect(doc.source).toBe("Biology Textbook");
    });

    it("should retrieve relevant documents", async () => {
      const kb = await ragService.createKnowledgeBase("Knowledge", "Test KB");
      await ragService.addDocument(
        kb.id,
        "Quantum Mechanics",
        "Quantum mechanics is the study of behavior at atomic scales...",
        "md",
        "Physics Paper"
      );

      const results = await ragService.retrieve(kb.id, "quantum physics", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].relevanceScore).toBeGreaterThan(0);
    });

    it("should perform hybrid search", async () => {
      const kb = await ragService.createKnowledgeBase("Hybrid", "Test hybrid search");
      await ragService.addDocument(
        kb.id,
        "Machine Learning",
        "Machine learning is a subset of artificial intelligence...",
        "txt",
        "AI Guide"
      );

      const results = await ragService.hybridSearch(kb.id, "machine learning", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should export and import knowledge base", async () => {
      const kb = await ragService.createKnowledgeBase("Export", "Test export");
      await ragService.addDocument(
        kb.id,
        "Test Doc",
        "Test content for export...",
        "txt",
        "Test Source"
      );

      const exported = ragService.exportKnowledgeBase(kb.id);
      expect(exported).toContain("Test Doc");
      expect(exported).toContain("Test content");
    });
  });

  describe("Web Search Service", () => {
    let searchService: WebSearchService;

    beforeEach(() => {
      searchService = new WebSearchService();
    });

    it("should search the web", async () => {
      const results = await searchService.search("photosynthesis", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBeDefined();
      expect(results[0].url).toBeDefined();
    });

    it("should cache search results", async () => {
      const query = "quantum mechanics";
      const results1 = await searchService.search(query, 5);
      const cached = searchService.getCachedResults(query);

      expect(cached).toBeDefined();
      expect(cached?.length).toBe(results1.length);
    });

    it("should perform academic search", async () => {
      const results = await searchService.academicSearch("machine learning", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should format search results", async () => {
      const results = await searchService.search("python programming", 3);
      const formatted = searchService.formatResults(results);
      expect(formatted).toContain("**");
      expect(formatted).toContain("URL:");
    });

    it("should extract citations", async () => {
      const results = await searchService.search("data science", 3);
      const citations = searchService.extractCitations(results);
      expect(citations.length).toBeGreaterThan(0);
      expect(citations[0]).toContain("http");
    });
  });

  describe("Exam Question Mimicking Service", () => {
    let mimicService: ExamQuestionMimicService;

    beforeEach(() => {
      mimicService = new ExamQuestionMimicService();
    });

    it("should upload and analyze exam paper", async () => {
      const examContent = `
        1. Define photosynthesis.
        A) The process of converting light to chemical energy
        B) The breakdown of glucose
        C) The production of oxygen only
        D) None of the above
        
        2. True or False: Photosynthesis occurs in the mitochondria.
        
        3. Explain the light-dependent reactions.
      `;

      const exam = await mimicService.uploadExamPaper("Biology Exam", examContent);
      expect(exam.name).toBe("Biology Exam");
      expect(exam.questionCount).toBeGreaterThan(0);
      expect(exam.style.questionTypes.length).toBeGreaterThan(0);
    });

    it("should generate mimic questions", async () => {
      const examContent = `
        1. What is photosynthesis?
        A) Light to energy conversion
        B) Energy breakdown
        C) Oxygen production
        D) All of the above
      `;

      const exam = await mimicService.uploadExamPaper("Test Exam", examContent);
      const questions = await mimicService.generateMimicQuestions(exam.id, 3);

      expect(questions.length).toBe(3);
      expect(questions[0].type).toBeDefined();
      expect(questions[0].difficulty).toMatch(/easy|medium|hard/);
    });

    it("should compare exam styles", async () => {
      const exam1Content = "1. A) Option\n2. B) Option\n3. C) Option";
      const exam2Content = "1. True or False\n2. Define\n3. Explain";

      const exam1 = await mimicService.uploadExamPaper("Exam 1", exam1Content);
      const exam2 = await mimicService.uploadExamPaper("Exam 2", exam2Content);

      const comparison = mimicService.compareStyles(exam1.id, exam2.id);
      expect(comparison.exam1Name).toBe("Exam 1");
      expect(comparison.exam2Name).toBe("Exam 2");
      expect(comparison.questionTypeMatch).toBeDefined();
    });
  });

  describe("Dual-Loop Multi-Agent System", () => {
    let orchestrator: DualLoopOrchestrator;

    beforeEach(() => {
      orchestrator = new DualLoopOrchestrator();
    });

    it("should run dual-loop reasoning", async () => {
      const context = {
        topic: "Photosynthesis",
        question: "How does photosynthesis work?",
        studentLevel: 5,
        conversationHistory: [],
        knowledgeGraph: {},
      };

      const responses = await orchestrator.runDualLoop(context);
      expect(responses.length).toBe(6); // 6 agents
      expect(responses[0].agentName).toBe("InvestigateAgent");
      expect(responses[1].agentName).toBe("NoteAgent");
      expect(responses[2].agentName).toBe("PlanAgent");
      expect(responses[3].agentName).toBe("ManagerAgent");
      expect(responses[4].agentName).toBe("SolveAgent");
      expect(responses[5].agentName).toBe("CheckAgent");
    });

    it("should combine agent responses", async () => {
      const context = {
        topic: "Quantum Mechanics",
        question: "What is superposition?",
        studentLevel: 8,
        conversationHistory: [],
        knowledgeGraph: {},
      };

      const responses = await orchestrator.runDualLoop(context);
      const combined = orchestrator.combineResponses(responses);

      expect(combined).toContain("Analysis Loop");
      expect(combined).toContain("Solve Loop");
      expect(combined).toContain("InvestigateAgent");
    });

    it("should get reasoning chain", async () => {
      const context = {
        topic: "Machine Learning",
        question: "How do neural networks learn?",
        studentLevel: 7,
        conversationHistory: [],
        knowledgeGraph: {},
      };

      const responses = await orchestrator.runDualLoop(context);
      const chain = orchestrator.getReasoningChain(responses);

      expect(chain).toContain("→");
      expect(chain).toContain("InvestigateAgent");
      expect(chain).toContain("CheckAgent");
    });
  });

  describe("Code Executor Service", () => {
    let executor: CodeExecutorService;

    beforeEach(() => {
      executor = new CodeExecutorService();
    });

    it("should execute Python code", async () => {
      const code = `
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        print(a, end=' ')
        a, b = b, a + b
fibonacci(10)
      `;

      const result = await executor.executePython(code, "Mathematics");
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should execute JavaScript code", async () => {
      const code = `
const sum = (a, b) => a + b;
console.log(sum(5, 3));
      `;

      const result = await executor.executeJavaScript(code, "Programming");
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should get code examples", async () => {
      const examples = executor.getAllExamples();
      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0].title).toBeDefined();
      expect(examples[0].code).toBeDefined();
    });

    it("should get examples by topic", async () => {
      const mathExamples = executor.getExamplesByTopic("Mathematics");
      expect(mathExamples.length).toBeGreaterThan(0);
      expect(mathExamples[0].topic).toBe("Mathematics");
    });

    it("should get examples by difficulty", async () => {
      const beginnerExamples = executor.getExamplesByDifficulty("beginner");
      expect(beginnerExamples.length).toBeGreaterThan(0);
      expect(beginnerExamples[0].difficulty).toBe("beginner");
    });

    it("should get execution history", async () => {
      await executor.executePython("print('test')", "Test");
      const history = executor.getExecutionHistory(10);
      expect(history.length).toBeGreaterThan(0);
    });

    it("should get execution statistics", async () => {
      await executor.executePython("print('test1')", "Math");
      await executor.executeJavaScript("console.log('test2')", "Programming");

      const stats = executor.getStatistics();
      expect(stats.totalExecutions).toBeGreaterThan(0);
      expect(stats.successRate).toBeDefined();
      expect(stats.averageDuration).toBeDefined();
    });
  });

  describe("Integration Tests", () => {
    it("should integrate RAG with Web Search", async () => {
      const ragService = new RAGPipelineService();
      const searchService = new WebSearchService();

      const kb = await ragService.createKnowledgeBase("Integrated", "Test integration");
      const searchResults = await searchService.search("machine learning", 3);

      // Add search results as documents
      for (const result of searchResults) {
        await ragService.addDocument(kb.id, result.title, result.snippet, "txt", result.source);
      }

      const retrieved = await ragService.retrieve(kb.id, "machine learning", 3);
      expect(retrieved.length).toBeGreaterThan(0);
    });

    it("should integrate Exam Mimicking with Code Executor", async () => {
      const mimicService = new ExamQuestionMimicService();
      const executor = new CodeExecutorService();

      const examContent = "1. Write a function to calculate factorial";
      const exam = await mimicService.uploadExamPaper("Programming Exam", examContent);
      const questions = await mimicService.generateMimicQuestions(exam.id, 1);

      expect(questions[0].type).toBeDefined();

      // Execute a code example
      const examples = executor.getAllExamples();
      const result = await executor.executePython(examples[0].code, examples[0].topic);
      expect(result.success).toBe(true);
    });

    it("should integrate Dual-Loop with RAG", async () => {
      const orchestrator = new DualLoopOrchestrator();
      const ragService = new RAGPipelineService();

      const kb = await ragService.createKnowledgeBase("Learning", "Test KB");
      await ragService.addDocument(
        kb.id,
        "Photosynthesis",
        "Photosynthesis converts light energy into chemical energy through complex biochemical processes...",
        "txt",
        "Biology Textbook"
      );

      const context = {
        topic: "Photosynthesis",
        question: "How does photosynthesis work?",
        studentLevel: 5,
        conversationHistory: [],
        knowledgeGraph: {},
      };

      const responses = await orchestrator.runDualLoop(context);
      expect(responses.length).toBe(6);
    });
  });
});
