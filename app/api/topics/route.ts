import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Reusable askClaude function with retry logic
const askClaude = async (prompt: string, options: Record<string, any> = {}) => {
  const maxRetries = 3;
  const baseDelay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.NEXT_CLAUDE_API_KEY,
      });

      const defaultParams = {
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      };

      const params: any = { ...defaultParams, ...options };
      const response: any = await anthropic.messages.create(params);

      console.log("Claude Response Generated:", {
        prompt_length: prompt.length,
        response_length: response.content[0].text.length,
        model: params.model,
        attempt: attempt + 1,
      });

      return response;
    } catch (error: any) {
      const isOverloaded = error.message.includes("overloaded");
      const isLastAttempt = attempt === maxRetries - 1;

      console.warn(`Claude API attempt ${attempt + 1} failed:`, error.message);

      if (isOverloaded && !isLastAttempt) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Claude API Error: ${error.message}`);
    }
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 }
    );
  }

  try {
    const prompt = `Based on the user's interest in "${query}", suggest 5 specific, engaging podcast topic ideas. 
    Format the response as a JSON array of objects, where each object has:
    {
      "title": "A catchy title for the podcast episode",
      "description": "A brief, engaging description of what the episode would cover (2-3 sentences)",
      "tags": ["array", "of", "relevant", "keywords"]
    }
    
    Make the topics specific, interesting, and diverse within the general theme. Avoid generic suggestions.
    Ensure the response is valid JSON format.`;

    const response = await askClaude(prompt, {
      temperature: 0.8, // Slightly higher temperature for more creative suggestions
    });

    // Parse and validate the JSON response
    try {
      const suggestions = JSON.parse(response.content[0].text);
      return NextResponse.json(suggestions);
    } catch (parseError) {
      console.error(
        "Failed to parse Claude response:",
        response.content[0].text
      );
      throw new Error("Invalid response format from AI");
    }
  } catch (error: any) {
    console.error("Error suggesting topics:", error);
    return NextResponse.json(
      {
        error: "Failed to generate suggestions",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
