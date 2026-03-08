/**
 * Direct Gemini API Tests (without AsyncStorage)
 * Tests AI tutoring features directly with Gemini API
 */

import { describe, it, expect } from "vitest";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Use gemini-2.0-flash for best performance, or gemini-1.5-flash for faster responses
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{
    text: string;
  }>;
}

/**
 * Send message directly to Gemini API
 */
async function sendGeminiMessage(
  userMessage: string,
  systemPrompt?: string,
  conversationHistory?: GeminiMessage[]
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set");
  }

  const messages: GeminiMessage[] = [];

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

  if (conversationHistory) {
    messages.push(...conversationHistory);
  }

  messages.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
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
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Gemini API Error Response:", errorData);
    throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from Gemini API");
  }

  return data.candidates[0].content.parts[0].text;
}

describe("Gemini API Direct Integration", () => {
  it("should verify API key is configured", () => {
    expect(GEMINI_API_KEY).toBeDefined();
    expect(GEMINI_API_KEY?.length).toBeGreaterThan(0);
  });

  it("should send simple message to Gemini API", async () => {
    const response = await sendGeminiMessage("Say hello");
    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(0);
  });

  it("should generate Feynman explanation", async () => {
    const systemPrompt = `You are an expert educator using the Feynman Technique.
Explain "Photosynthesis" at depth level 5/10 in a way that achieves "superunderstanding."
Use simple language, identify gaps, and provide real-world examples.`;

    const response = await sendGeminiMessage(
      "Please explain photosynthesis to me using the Feynman Technique.",
      systemPrompt
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(100);
    expect(response.toLowerCase()).toContain("photosynthesis");
  });

  it("should generate Socratic question", async () => {
    const systemPrompt = `You are a Socratic tutor helping students understand "Quantum Mechanics".
Your role is to ask guiding questions that help students discover the answer themselves.
NEVER directly answer the question - always guide them to think deeper.`;

    const response = await sendGeminiMessage(
      'The student said: "I think light is always a wave". What should I ask next?',
      systemPrompt
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(20);
    expect(response.includes("?")).toBe(true);
  });

  it("should evaluate student explanation", async () => {
    const systemPrompt = `You are an expert evaluator of student explanations for "Photosynthesis".
Key points that should be covered:
1. Plants use sunlight
2. Converts CO2 and water
3. Produces glucose and oxygen

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

    const response = await sendGeminiMessage(
      'Evaluate this explanation: "Photosynthesis is when plants use sunlight to make food from water and carbon dioxide"',
      systemPrompt
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(50);

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(response);
      expect(parsed.accuracy).toBeDefined();
      expect(parsed.feedback).toBeDefined();
      expect(Array.isArray(parsed.misunderstandings)).toBe(true);
    } catch {
      // Response might not be JSON, but should still contain evaluation info
      expect(response.toLowerCase()).toMatch(/accuracy|feedback|score/);
    }
  });

  it("should generate multiple choice quiz question", async () => {
    const systemPrompt = `Generate a multiple choice question about "Newton's Laws of Motion" at difficulty level 3/5.

Format your response as JSON:
{
  "question": "<string>",
  "options": ["<string>", ...],
  "correctAnswer": "<string>",
  "explanation": "<string>"
}`;

    const response = await sendGeminiMessage(
      "Generate a multiple choice question about Newton's Laws of Motion at difficulty 3/5.",
      systemPrompt
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(50);

    try {
      const parsed = JSON.parse(response);
      expect(parsed.question).toBeDefined();
      expect(Array.isArray(parsed.options)).toBe(true);
      expect(parsed.correctAnswer).toBeDefined();
      expect(parsed.explanation).toBeDefined();
    } catch {
      // Response might not be JSON, but should contain question content
      expect(response.length).toBeGreaterThan(100);
    }
  });

  it("should detect misconceptions", async () => {
    const systemPrompt = `Analyze the student's response for misconceptions about "Thermodynamics".
The correct understanding is: "Heat flows from hot to cold objects, and the rate depends on temperature difference"

Identify specific misconceptions and return as JSON array:
["<misconception 1>", "<misconception 2>", ...]

Only include actual misconceptions, not minor wording differences.`;

    const response = await sendGeminiMessage(
      'Student said: "Heat always flows from hot to cold objects". What misconceptions are present?',
      systemPrompt
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(0);
  });

  it("should generate learning recommendation", async () => {
    const systemPrompt = `You are a learning advisor analyzing student performance.

Student Performance:
- Concept: photosynthesis
- Mastery Level: 6/10
- Recent Accuracy: 75%
- Time Spent: 120 minutes

Available concepts to learn: Cellular Respiration, Plant Biology, Energy Transfer, Ecology

Provide personalized recommendation in JSON format:
{
  "recommendation": "<string>",
  "nextSteps": ["<step 1>", "<step 2>", ...]
}`;

    const response = await sendGeminiMessage(
      "What should this student do next?",
      systemPrompt
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(50);

    try {
      const parsed = JSON.parse(response);
      expect(parsed.recommendation).toBeDefined();
      expect(Array.isArray(parsed.nextSteps)).toBe(true);
    } catch {
      // Response might not be JSON, but should contain recommendation
      expect(response.toLowerCase()).toMatch(/recommend|next|learn|study/);
    }
  });

  it("should maintain conversation history", async () => {
    const conversationHistory: GeminiMessage[] = [
      {
        role: "user",
        parts: [{ text: "What is photosynthesis?" }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose.",
          },
        ],
      },
    ];

    const response = await sendGeminiMessage(
      "Can you explain it more simply for a 10-year-old?",
      "You are a helpful tutor.",
      conversationHistory
    );

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(20);
    // Response should be simpler/shorter for 10-year-old
  });

  it("should handle error for invalid API key", async () => {
    const invalidKey = "invalid-api-key-12345";
    const response = await fetch(
      `${API_ENDPOINT}?key=${invalidKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "Hello" }],
            },
          ],
        }),
      }
    );

    expect(response.ok).toBe(false);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
