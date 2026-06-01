/**
 * Gemini AI Service
 * Handles all interactions with Google Gemini 1.5 Pro API
 */

export interface GeminiMessage {
  role: "user" | "model";
  content: string;
}

export interface TutoringMode {
  name: string;
  systemPrompt: string;
  description: string;
}

export const TUTORING_MODES: Record<string, TutoringMode> = {
  explainer: {
    name: "Explainer",
    systemPrompt: `You are an expert physics tutor using the Feynman Technique. 
Your goal is to explain concepts in the simplest, clearest way possible.
Use analogies, avoid jargon, and focus on intuition over mathematics.
Keep your response to 2-3 paragraphs.`,
    description: "AI explains concepts clearly using simple language",
  },
  socratic: {
    name: "Socratic",
    systemPrompt: `You are a Socratic tutor asking probing questions to deepen understanding.
Ask ONE thoughtful question that guides the student to discover the answer themselves.
Don't give the answer directly - help them think through it.`,
    description: "AI asks guiding questions for deeper understanding",
  },
  feedback: {
    name: "Feedback",
    systemPrompt: `You are an AI tutor analyzing student explanations.
Evaluate the student's understanding and provide constructive feedback.
Point out what they got right and what needs clarification.`,
    description: "AI provides feedback on student's explanation",
  },
  misconception: {
    name: "Misconception",
    systemPrompt: `You are a tutor specializing in detecting and correcting misconceptions.
Identify any incorrect beliefs in the student's statement and gently correct them with accurate information.`,
    description: "AI detects and corrects misconceptions",
  },
  quiz: {
    name: "Quiz",
    systemPrompt: `You are creating an adaptive quiz question.
Generate a multiple-choice question appropriate for the student's level.
Format: Question, then 4 options (A, B, C, D), then indicate the correct answer.`,
    description: "AI generates quiz questions",
  },
  application: {
    name: "Application",
    systemPrompt: `You are explaining real-world applications of concepts.
Connect theory to practical technology and everyday life.
Make it concrete and relatable.`,
    description: "AI connects theory to real-world applications",
  },
};

export class GeminiService {
  private apiKey: string;
  private conversationHistory: GeminiMessage[] = [];
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Send a message to Gemini with a specific tutoring mode
   */
  async sendMessage(userMessage: string, mode: keyof typeof TUTORING_MODES = "explainer"): Promise<string> {
    const modeConfig = TUTORING_MODES[mode];
    if (!modeConfig) {
      throw new Error(`Unknown tutoring mode: ${mode}`);
    }

    try {
      const prompt = `${modeConfig.systemPrompt}\n\nUser: ${userMessage}`;

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: {
            parts: [{ text: prompt }],
          },
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 500,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API Error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponse) {
        throw new Error("No response generated from Gemini");
      }

      // Add to conversation history
      this.conversationHistory.push({ role: "user", content: userMessage });
      this.conversationHistory.push({ role: "model", content: aiResponse });

      return aiResponse;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  /**
   * Send a message with full conversation context
   */
  async sendMessageWithContext(userMessage: string, mode: keyof typeof TUTORING_MODES = "explainer"): Promise<string> {
    const modeConfig = TUTORING_MODES[mode];
    if (!modeConfig) {
      throw new Error(`Unknown tutoring mode: ${mode}`);
    }

    try {
      // Build conversation with system prompt injected at the beginning
      const systemPromptPart = { text: modeConfig.systemPrompt };
      
      const contents = [
        {
          role: "user",
          parts: [systemPromptPart],
        },
        {
          role: "model",
          parts: [{ text: "I understand. I will follow these instructions for this conversation." }],
        },
        ...this.conversationHistory.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        })),
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ];

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 500,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API Error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponse) {
        throw new Error("No response generated from Gemini");
      }

      // Add to conversation history
      this.conversationHistory.push({ role: "user", content: userMessage });
      this.conversationHistory.push({ role: "model", content: aiResponse });

      return aiResponse;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): GeminiMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Set conversation history
   */
  setHistory(history: GeminiMessage[]): void {
    this.conversationHistory = history;
  }
}

export default GeminiService;
