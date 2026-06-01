import { describe, it, expect } from "vitest";

describe("Gemini API Integration", () => {
  it("should have GEMINI_API_KEY configured", () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(apiKey?.length).toBeGreaterThan(0);
  });

  it("should validate API key format", () => {
    const apiKey = process.env.GEMINI_API_KEY || "";
    expect(apiKey).toMatch(/^AIza/);
  });
});
