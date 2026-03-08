/**
 * Exam Question Mimicking Service
 * Analyzes exam papers and generates practice questions in the same style
 * Inspired by DeepTutor's exam question mimicking feature
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "crypto";

export interface ExamPaper {
  id: string;
  name: string;
  content: string;
  uploadedAt: number;
  questionCount: number;
  avgDifficulty: number;
  style: ExamStyle;
}

export interface ExamStyle {
  questionTypes: QuestionType[];
  avgLength: number;
  difficultyDistribution: Record<string, number>; // e.g., { "easy": 0.3, "medium": 0.5, "hard": 0.2 }
  topics: string[];
  keywords: string[];
}

export type QuestionType = "multiple-choice" | "short-answer" | "essay" | "fill-in-blank" | "true-false";

export interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer?: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  sourceExamId: string;
  style: "mimicked" | "original";
}

/**
 * Exam Question Mimicking Service
 * Analyzes exam patterns and generates similar questions
 */
export class ExamQuestionMimicService {
  private examPapers: Map<string, ExamPaper> = new Map();
  private storageKey = "exam_papers";

  constructor() {
    this.loadExamPapers();
  }

  /**
   * Load exam papers from storage
   */
  private async loadExamPapers(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.examPapers = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error("Failed to load exam papers:", error);
    }
  }

  /**
   * Save exam papers to storage
   */
  private async saveExamPapers(): Promise<void> {
    try {
      const data = Object.fromEntries(this.examPapers);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save exam papers:", error);
    }
  }

  /**
   * Upload and analyze exam paper
   */
  async uploadExamPaper(name: string, content: string): Promise<ExamPaper> {
    const style = this.analyzeExamStyle(content);
    const questionCount = this.countQuestions(content);
    const avgDifficulty = this.estimateDifficulty(content);

    const paper: ExamPaper = {
      id: randomUUID(),
      name,
      content,
      uploadedAt: Date.now(),
      questionCount,
      avgDifficulty,
      style,
    };

    this.examPapers.set(paper.id, paper);
    await this.saveExamPapers();

    return paper;
  }

  /**
   * Analyze exam style from content
   */
  private analyzeExamStyle(content: string): ExamStyle {
    const questionTypes: QuestionType[] = [];
    const keywords: string[] = [];
    const topics: string[] = [];

    // Detect question types
    if (content.includes("A)") || content.includes("a)")) {
      questionTypes.push("multiple-choice");
    }
    if (content.includes("True") || content.includes("False")) {
      questionTypes.push("true-false");
    }
    if (content.includes("___") || content.includes("____")) {
      questionTypes.push("fill-in-blank");
    }
    if (content.match(/\d+\.\s+[A-Z]/)) {
      questionTypes.push("short-answer");
    }
    if (content.match(/essay|discuss|explain/i)) {
      questionTypes.push("essay");
    }

    // Extract keywords (simplified)
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
    ]);
    keywords.push(
      ...words
        .filter((w) => w.length > 5 && !stopWords.has(w))
        .slice(0, 10)
    );

    // Extract topics (simplified)
    const topicMatches = content.match(/Chapter|Section|Unit|Topic|Module/gi);
    if (topicMatches) {
      topics.push(...topicMatches.slice(0, 5));
    }

    return {
      questionTypes: [...new Set(questionTypes)],
      avgLength: Math.round(content.length / Math.max(this.countQuestions(content), 1)),
      difficultyDistribution: {
        easy: 0.3,
        medium: 0.5,
        hard: 0.2,
      },
      topics: [...new Set(topics)],
      keywords: [...new Set(keywords)],
    };
  }

  /**
   * Count questions in exam paper
   */
  private countQuestions(content: string): number {
    const patterns = [
      /^\d+\./gm, // Numbered questions
      /^Q\d+:/gm, // Q1: format
      /^Question \d+/gm, // Question 1 format
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        return matches.length;
      }
    }

    return Math.max(1, Math.round(content.split(/[.!?]/).length / 5));
  }

  /**
   * Estimate difficulty of exam paper
   */
  private estimateDifficulty(content: string): number {
    let difficulty = 0.5; // Default to medium

    // Check for advanced terms
    const advancedTerms = [
      "analyze",
      "synthesize",
      "evaluate",
      "complex",
      "theoretical",
      "advanced",
    ];
    const advancedCount = advancedTerms.filter((term) =>
      content.toLowerCase().includes(term)
    ).length;

    difficulty += advancedCount * 0.05;

    // Check for simple terms
    const simpleTerms = ["define", "list", "identify", "basic", "simple", "introductory"];
    const simpleCount = simpleTerms.filter((term) => content.toLowerCase().includes(term))
      .length;

    difficulty -= simpleCount * 0.05;

    return Math.max(0, Math.min(1, difficulty));
  }

  /**
   * Generate practice questions mimicking exam style
   */
  async generateMimicQuestions(
    examId: string,
    count: number = 5,
    topic?: string
  ): Promise<GeneratedQuestion[]> {
    const exam = this.examPapers.get(examId);
    if (!exam) {
      throw new Error(`Exam paper ${examId} not found`);
    }

    const questions: GeneratedQuestion[] = [];

    for (let i = 0; i < count; i++) {
      const type = this.selectQuestionType(exam.style.questionTypes);
      const difficulty = this.selectDifficulty(exam.style.difficultyDistribution);
      const selectedTopic = topic || this.selectTopic(exam.style.topics);

      const question = this.generateQuestion(type, difficulty, selectedTopic, exam.style);

      questions.push({
        id: `q_${Date.now()}_${i}`,
        type,
        question: question.text,
        options: question.options,
        correctAnswer: question.answer,
        difficulty,
        topic: selectedTopic,
        sourceExamId: examId,
        style: "mimicked",
      });
    }

    return questions;
  }

  /**
   * Select question type based on exam style
   */
  private selectQuestionType(types: QuestionType[]): QuestionType {
    if (types.length === 0) {
      return "multiple-choice";
    }
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Select difficulty based on distribution
   */
  private selectDifficulty(distribution: Record<string, number>): "easy" | "medium" | "hard" {
    const rand = Math.random();
    let cumulative = 0;

    for (const [difficulty, probability] of Object.entries(distribution)) {
      cumulative += probability;
      if (rand <= cumulative) {
        return difficulty as "easy" | "medium" | "hard";
      }
    }

    return "medium";
  }

  /**
   * Select topic from exam style
   */
  private selectTopic(topics: string[]): string {
    if (topics.length === 0) {
      return "General";
    }
    return topics[Math.floor(Math.random() * topics.length)];
  }

  /**
   * Generate question based on type and difficulty
   */
  private generateQuestion(
    type: QuestionType,
    difficulty: string,
    topic: string,
    style: ExamStyle
  ): { text: string; options?: string[]; answer?: string } {
    const difficultyPrefix =
      difficulty === "easy" ? "Define" : difficulty === "medium" ? "Explain" : "Analyze";

    switch (type) {
      case "multiple-choice": {
        const question = `${difficultyPrefix} the concept of ${topic}?`;
        return {
          text: question,
          options: [
            `Option A: A definition related to ${topic}`,
            `Option B: Another aspect of ${topic}`,
            `Option C: A related concept`,
            `Option D: An unrelated concept`,
          ],
          answer: "Option A: A definition related to " + topic,
        };
      }

      case "true-false": {
        const statement = `${topic} is a fundamental concept in modern education.`;
        return {
          text: `True or False: ${statement}`,
          answer: "True",
        };
      }

      case "fill-in-blank": {
        return {
          text: `The main principle of ${topic} is _____.`,
          answer: "learning through understanding",
        };
      }

      case "short-answer": {
        return {
          text: `${difficultyPrefix} ${topic} in 2-3 sentences.`,
          answer: `${topic} is an important concept that involves...`,
        };
      }

      case "essay": {
        return {
          text: `Write an essay on "${topic}". Discuss its importance, applications, and implications.`,
          answer: `An essay should cover the definition, key points, and real-world applications of ${topic}...`,
        };
      }

      default:
        return { text: `Question about ${topic}`, answer: "Answer" };
    }
  }

  /**
   * Get all exam papers
   */
  getExamPapers(): ExamPaper[] {
    return Array.from(this.examPapers.values());
  }

  /**
   * Get exam paper by ID
   */
  getExamPaper(examId: string): ExamPaper | undefined {
    return this.examPapers.get(examId);
  }

  /**
   * Delete exam paper
   */
  async deleteExamPaper(examId: string): Promise<void> {
    this.examPapers.delete(examId);
    await this.saveExamPapers();
  }

  /**
   * Compare two exam styles
   */
  compareStyles(exam1Id: string, exam2Id: string): Record<string, unknown> {
    const exam1 = this.examPapers.get(exam1Id);
    const exam2 = this.examPapers.get(exam2Id);

    if (!exam1 || !exam2) {
      throw new Error("One or both exam papers not found");
    }

    return {
      exam1Name: exam1.name,
      exam2Name: exam2.name,
      questionTypeMatch: this.calculateMatch(exam1.style.questionTypes, exam2.style.questionTypes),
      difficultyMatch: Math.abs(exam1.avgDifficulty - exam2.avgDifficulty),
      topicOverlap: this.calculateOverlap(exam1.style.topics, exam2.style.topics),
    };
  }

  /**
   * Calculate match between two arrays
   */
  private calculateMatch(arr1: string[], arr2: string[]): number {
    const intersection = arr1.filter((item) => arr2.includes(item));
    return intersection.length / Math.max(arr1.length, arr2.length, 1);
  }

  /**
   * Calculate overlap between two arrays
   */
  private calculateOverlap(arr1: string[], arr2: string[]): number {
    const intersection = arr1.filter((item) => arr2.includes(item));
    return intersection.length / Math.max(arr1.length, arr2.length, 1);
  }
}

// Export singleton instance
export const examQuestionMimic = new ExamQuestionMimicService();
