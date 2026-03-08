/**
 * Client-side Gemini API Service
 * Uses user-provided API key from AsyncStorage
 * Supports Gemini 3.1 Pro Preview
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{
    text: string;
  }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class GeminiClientService {
  private static API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  private static MODEL = "gemini-2.0-flash";

  /**
   * Get API key from AsyncStorage
   */
  static async getAPIKey(): Promise<string> {
    const apiKey = await AsyncStorage.getItem("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("Gemini API key not configured. Please set it up in Settings.");
    }
    return apiKey;
  }

  /**
   * Send message to Gemini API
   */
  static async sendMessage(
    userMessage: string,
    systemPrompt?: string,
    conversationHistory?: GeminiMessage[]
  ): Promise<string> {
    try {
      const apiKey = await this.getAPIKey();

      // Build messages array
      const messages: GeminiMessage[] = [];

      // Add system prompt as first message if provided
      if (systemPrompt) {
        messages.push({
          role: "user",
          parts: [{ text: systemPrompt }],
        });
        messages.push({
          role: "model",
          parts: [{ text: "I understand. I will follow these instructions." }],
        });
      }

      // Add conversation history
      if (conversationHistory) {
        messages.push(...conversationHistory);
      }

      // Add current user message
      messages.push({
        role: "user",
        parts: [{ text: userMessage }],
      });

      // Call Gemini API
      const response = await fetch(
        `${this.API_ENDPOINT}?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: messages,
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Gemini API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = (await response.json()) as GeminiResponse;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response from Gemini API");
      }

      const responseText = data.candidates[0].content.parts[0].text;
      return responseText;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get Gemini response: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate explanation using Feynman Technique
   */
  static async generateFeynmanExplanation(
    concept: string,
    depthLevel: number,
    studentName: string
  ): Promise<string> {
    const systemPrompt = `You are an expert educator using the Feynman Technique to teach ${studentName}.
Your goal is to explain "${concept}" at depth level ${depthLevel}/10 in a way that achieves "superunderstanding."

Follow these steps:
1. Explain the concept simply, as if teaching a beginner
2. Identify gaps in your explanation
3. Refine the explanation to be clearer
4. Use analogies and real-world examples
5. Avoid jargon unless necessary

Adjust complexity based on depth level:
- Level 1-2: Elementary school concepts, simple words
- Level 3-4: Middle school, basic principles
- Level 5-6: High school, mathematical relationships
- Level 7-8: Undergraduate, theoretical foundations
- Level 9-10: Graduate/Research, cutting-edge understanding

Provide a clear, engaging explanation that builds understanding progressively.`;

    return this.sendMessage(
      `Please explain "${concept}" to me using the Feynman Technique.`,
      systemPrompt
    );
  }

  /**
   * Generate Socratic question
   */
  static async generateSocraticQuestion(
    concept: string,
    studentResponse: string,
    previousQuestions: string[]
  ): Promise<string> {
    const systemPrompt = `You are a Socratic tutor helping students understand "${concept}".
Your role is to ask guiding questions that help students discover the answer themselves.
NEVER directly answer the question - always guide them to think deeper.

Previous questions asked:
${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

The student just said: "${studentResponse}"

Generate a follow-up Socratic question that:
1. Acknowledges what they said
2. Guides them to think deeper
3. Helps them discover misconceptions
4. Builds on their understanding progressively`;

    return this.sendMessage(
      `The student said: "${studentResponse}". What should I ask next?`,
      systemPrompt
    );
  }

  /**
   * Evaluate student explanation
   */
  static async evaluateExplanation(
    studentExplanation: string,
    concept: string,
    keyPoints: string[]
  ): Promise<{
    accuracy: number;
    feedback: string;
    misunderstandings: string[];
  }> {
    const systemPrompt = `You are an expert evaluator of student explanations for "${concept}".

Key points that should be covered:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Evaluate the student's explanation and provide:
1. Accuracy score (0-100)
2. Constructive feedback
3. List of misconceptions (if any)

Format your response as JSON:
{
  "accuracy": <number>,
  "feedback": "<string>",
  "misunderstandings": ["<string>", ...]
}`;

    const response = await this.sendMessage(
      `Evaluate this explanation: "${studentExplanation}"`,
      systemPrompt
    );

    try {
      const parsed = JSON.parse(response);
      return {
        accuracy: parsed.accuracy || 0,
        feedback: parsed.feedback || "No feedback available",
        misunderstandings: parsed.misunderstandings || [],
      };
    } catch {
      return {
        accuracy: 50,
        feedback: response,
        misunderstandings: [],
      };
    }
  }

  /**
   * Generate quiz question
   */
  static async generateQuizQuestion(
    concept: string,
    difficulty: 1 | 2 | 3 | 4 | 5,
    questionType: "multiple_choice" | "short_answer" | "explain"
  ): Promise<{
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  }> {
    const systemPrompt = `Generate a ${questionType} question about "${concept}" at difficulty level ${difficulty}/5.

Difficulty levels:
1-2: Basic recall and comprehension
3: Application and understanding
4-5: Analysis, synthesis, and evaluation

Format your response as JSON:
{
  "question": "<string>",
  "options": ["<string>", ...] or null,
  "correctAnswer": "<string>",
  "explanation": "<string>"
}`;

    const response = await this.sendMessage(
      `Generate a ${questionType} question about "${concept}" at difficulty ${difficulty}/5.`,
      systemPrompt
    );

    try {
      const parsed = JSON.parse(response);
      return {
        question: parsed.question || "",
        options: parsed.options,
        correctAnswer: parsed.correctAnswer || "",
        explanation: parsed.explanation || "",
      };
    } catch {
      return {
        question: "Unable to generate question",
        correctAnswer: "",
        explanation: response,
      };
    }
  }

  /**
   * Detect misconceptions from student response
   */
  static async detectMisconceptions(
    studentResponse: string,
    concept: string,
    correctConcept: string
  ): Promise<string[]> {
    const systemPrompt = `Analyze the student's response for misconceptions about "${concept}".
The correct understanding is: "${correctConcept}"

Identify specific misconceptions and return as JSON array:
["<misconception 1>", "<misconception 2>", ...]

Only include actual misconceptions, not minor wording differences.`;

    const response = await this.sendMessage(
      `Student said: "${studentResponse}". What misconceptions are present?`,
      systemPrompt
    );

    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate learning recommendation
   */
  static async generateLearningRecommendation(
    studentPerformance: {
      conceptId: string;
      masteryLevel: number;
      recentAccuracy: number;
      timeSpent: number;
    },
    allConcepts: string[]
  ): Promise<{
    recommendation: string;
    nextSteps: string[];
  }> {
    const systemPrompt = `You are a learning advisor analyzing student performance.

Student Performance:
- Concept: ${studentPerformance.conceptId}
- Mastery Level: ${studentPerformance.masteryLevel}/10
- Recent Accuracy: ${studentPerformance.recentAccuracy}%
- Time Spent: ${studentPerformance.timeSpent} minutes

Available concepts to learn: ${allConcepts.join(", ")}

Provide personalized recommendation in JSON format:
{
  "recommendation": "<string>",
  "nextSteps": ["<step 1>", "<step 2>", ...]
}`;

    const response = await this.sendMessage(
      `What should this student do next?`,
      systemPrompt
    );

    try {
      const parsed = JSON.parse(response);
      return {
        recommendation: parsed.recommendation || "",
        nextSteps: parsed.nextSteps || [],
      };
    } catch {
      return {
        recommendation: response,
        nextSteps: [],
      };
    }
  }
}
