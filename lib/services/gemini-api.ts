/**
 * Gemini API Integration Service
 * Handles all AI-powered tutoring features using Google's Gemini model
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || "";

if (!API_KEY) {
  console.warn("GEMINI_API_KEY not set. AI features will be unavailable.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Gemini API Service
 * Provides AI-powered explanations, analysis, and feedback
 */
export class GeminiAPIService {
  private static readonly model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  /**
   * Generate Feynman-style simple explanation for a concept
   */
  static async generateSimpleExplanation(
    conceptName: string,
    description: string,
    keyPoints: string[],
    learningStyle: string
  ): Promise<string> {
    try {
      const prompt = `You are an expert educator using the Feynman Technique to teach ${conceptName}.

Concept Description: ${description}

Key Points to Cover:
${keyPoints.map((p) => `- ${p}`).join("\n")}

Learning Style: ${learningStyle}

Generate a simple, clear explanation of ${conceptName} that:
1. Uses everyday language (avoid jargon)
2. Starts with the most fundamental idea
3. Uses analogies to familiar concepts
4. Explains why this concept matters
5. Includes 2-3 real-world examples

Keep the explanation to 2-3 paragraphs, suitable for someone learning this for the first time.`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Error generating explanation:", error);
      throw error;
    }
  }

  /**
   * Analyze student's explanation for accuracy and gaps
   */
  static async analyzeStudentExplanation(
    studentExplanation: string,
    correctConcept: string,
    keyPoints: string[],
    commonMisconceptions: string[]
  ): Promise<{
    accuracy: number;
    missingPoints: string[];
    misconceptions: string[];
    suggestions: string[];
    refinedExplanation: string;
  }> {
    try {
      const prompt = `You are an expert educator analyzing a student's explanation using the Feynman Technique.

Concept: ${correctConcept}

Key Points That Should Be Covered:
${keyPoints.map((p) => `- ${p}`).join("\n")}

Common Misconceptions to Watch For:
${commonMisconceptions.map((m) => `- ${m}`).join("\n")}

Student's Explanation:
"${studentExplanation}"

Analyze the student's explanation and provide:
1. An accuracy score (0-100)
2. List of missing key points (if any)
3. Any misconceptions detected
4. Specific suggestions for improvement
5. A refined/corrected version of the explanation

Format your response as JSON with these exact keys:
{
  "accuracy": <number>,
  "missingPoints": [<array of strings>],
  "misconceptions": [<array of strings>],
  "suggestions": [<array of strings>],
  "refinedExplanation": "<string>"
}`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error("Could not parse analysis response");
    } catch (error) {
      console.error("Error analyzing explanation:", error);
      throw error;
    }
  }

  /**
   * Generate follow-up questions based on identified gaps
   */
  static async generateFollowUpQuestions(
    conceptName: string,
    identifiedGaps: string[],
    learningStyle: string,
    count: number = 3
  ): Promise<string[]> {
    try {
      const prompt = `You are an expert educator creating follow-up questions to help a student understand ${conceptName} better.

Identified Knowledge Gaps:
${identifiedGaps.map((g) => `- ${g}`).join("\n")}

Learning Style: ${learningStyle}

Generate ${count} targeted follow-up questions that:
1. Address the identified gaps
2. Use the Socratic method (guide student to discover answers)
3. Are appropriate for the ${learningStyle} learning style
4. Progress from simpler to more complex
5. Encourage deep thinking

Format your response as a JSON array of strings:
["question 1", "question 2", "question 3"]`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error("Could not parse questions response");
    } catch (error) {
      console.error("Error generating follow-up questions:", error);
      throw error;
    }
  }

  /**
   * Generate adaptive quiz questions
   */
  static async generateQuizQuestions(
    conceptName: string,
    masteryLevel: string,
    learningStyle: string,
    count: number = 5
  ): Promise<
    Array<{
      id: string;
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }>
  > {
    try {
      const difficulty =
        masteryLevel === "novice"
          ? "basic"
          : masteryLevel === "intermediate"
          ? "intermediate"
          : masteryLevel === "proficient"
          ? "advanced"
          : "expert";

      const prompt = `You are an expert educator creating ${count} quiz questions about ${conceptName}.

Mastery Level: ${masteryLevel} (${difficulty} difficulty)
Learning Style: ${learningStyle}

Generate ${count} multiple-choice questions that:
1. Test understanding of key concepts
2. Match the ${difficulty} difficulty level
3. Include one correct answer and 3 plausible distractors
4. Have clear, concise explanations for the correct answer
5. Help identify misconceptions

Format your response as a JSON array:
[
  {
    "id": "q1",
    "question": "question text",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "option1",
    "explanation": "explanation of why this is correct"
  }
]`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error("Could not parse quiz questions response");
    } catch (error) {
      console.error("Error generating quiz questions:", error);
      throw error;
    }
  }

  /**
   * Correct misconceptions with targeted explanation
   */
  static async correctMisconception(
    misconception: string,
    correctConcept: string,
    keyPoints: string[]
  ): Promise<{
    correctionExplanation: string;
    whyMisconceptionOccurs: string;
    correctUnderstanding: string;
    examples: string[];
  }> {
    try {
      const prompt = `You are an expert educator addressing a student misconception.

Misconception: "${misconception}"
Correct Concept: ${correctConcept}

Key Points of Correct Understanding:
${keyPoints.map((p) => `- ${p}`).join("\n")}

Provide a comprehensive response that:
1. Explains why this misconception is common
2. Clarifies the correct understanding
3. Provides 2-3 concrete examples showing the difference
4. Offers a memorable way to remember the correct concept

Format your response as JSON:
{
  "correctionExplanation": "<clear explanation of the correct concept>",
  "whyMisconceptionOccurs": "<explanation of why students believe the misconception>",
  "correctUnderstanding": "<concise statement of correct understanding>",
  "examples": ["<example 1>", "<example 2>", "<example 3>"]
}`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error("Could not parse correction response");
    } catch (error) {
      console.error("Error correcting misconception:", error);
      throw error;
    }
  }

  /**
   * Generate adaptive tutor response based on student question
   */
  static async generateAdaptiveResponse(
    studentQuestion: string,
    conceptName: string,
    learningStyle: string,
    communicationPreference: string
  ): Promise<{
    explanation: string;
    followUpQuestion: string;
    relatedConcepts: string[];
  }> {
    try {
      const tone =
        communicationPreference === "encouraging"
          ? "warm, supportive, and encouraging"
          : communicationPreference === "formal"
          ? "formal and academic"
          : "neutral and objective";

      const prompt = `You are an expert tutor using the Feynman Technique to help a student understand ${conceptName}.

Student Question: "${studentQuestion}"
Concept: ${conceptName}
Learning Style: ${learningStyle}
Communication Tone: ${tone}

Provide a response that:
1. Directly addresses the student's question
2. Uses simple, clear language
3. Includes a relevant analogy or example
4. Maintains a ${tone} tone
5. Ends with a follow-up question to deepen understanding

Format your response as JSON:
{
  "explanation": "<your explanation>",
  "followUpQuestion": "<a Socratic follow-up question>",
  "relatedConcepts": ["<related concept 1>", "<related concept 2>"]
}`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error("Could not parse adaptive response");
    } catch (error) {
      console.error("Error generating adaptive response:", error);
      throw error;
    }
  }

  /**
   * Test API connectivity
   */
  static async testConnection(): Promise<boolean> {
    try {
      const result = await this.model.generateContent("Say 'API connection successful' in one sentence.");
      return result.response.text().length > 0;
    } catch (error) {
      console.error("Gemini API connection test failed:", error);
      return false;
    }
  }
}
