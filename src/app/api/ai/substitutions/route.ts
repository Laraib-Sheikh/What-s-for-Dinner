import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const { missingIngredient, recipeTitle, context } = await req.json();

  if (!missingIngredient) {
    return NextResponse.json({ error: "Missing ingredient required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      substitutions: [
        {
          substitute: "Check your pantry for similar ingredients",
          ratio: "1:1",
          notes: "Add your Anthropic API key to enable AI-powered substitution suggestions.",
        },
      ],
    });
  }

  try {
    const prompt = `You are a helpful cooking assistant. The user is making "${recipeTitle || "a recipe"}" but doesn't have ${missingIngredient}. 
    
${context ? `Additional context: ${context}` : ""}

Suggest 2-3 practical substitutes for ${missingIngredient} that most home cooks would have. For each substitute, provide:
1. The substitute ingredient
2. The ratio/amount to use (compared to the original)
3. A brief note about how it changes the dish (if at all)

Keep responses concise and practical. Format as JSON array like:
[{"substitute": "...", "ratio": "...", "notes": "..."}]

Only output the JSON array, nothing else.`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const substitutions = JSON.parse(content.text);
    return NextResponse.json({ substitutions });
  } catch (error) {
    console.error("AI substitution error:", error);
    return NextResponse.json(
      { error: "Failed to get substitution suggestions" },
      { status: 500 }
    );
  }
}
