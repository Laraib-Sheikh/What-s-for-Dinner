import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const { recipeId, instruction } = await req.json();

  if (!recipeId || !instruction?.trim()) {
    return NextResponse.json({ error: "recipeId and instruction required" }, { status: 400 });
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { recipeIngredients: { include: { ingredient: true } } },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  let pantryNames: string[] = [];
  if (session?.user?.id) {
    const pantry = await prisma.pantryItem.findMany({
      where: { userId: session.user.id },
      include: { ingredient: true },
    });
    pantryNames = pantry.map((p) => p.ingredient.name);
  }

  const ingredientList = recipe.recipeIngredients.map((ri) =>
    `- ${ri.quantity || ""} ${ri.ingredient.name}${ri.isOptional ? " (optional)" : ""}`
  ).join("\n");

  const instructionsList = (recipe.instructions as Array<{ step_number: number; text: string }>)
    .map((s) => `${s.step_number}. ${s.text}`)
    .join("\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      title: `${recipe.title} (Remixed)`,
      description: `AI remix: "${instruction}". Add your ANTHROPIC_API_KEY for full AI-powered remixes.`,
      ingredients: recipe.recipeIngredients.map((ri) => ({
        name: ri.ingredient.name,
        quantity: ri.quantity,
        isOptional: ri.isOptional,
      })),
      instructions: recipe.instructions,
      remixNote: instruction,
    });
  }

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are a creative chef. Remix this recipe based on the user's request.

Original recipe: "${recipe.title}"
Description: ${recipe.description || "N/A"}
Cook time: ${recipe.cookTimeMinutes} minutes

Ingredients:
${ingredientList}

Instructions:
${instructionsList}

User wants: "${instruction}"
${pantryNames.length ? `User's pantry: ${pantryNames.slice(0, 20).join(", ")}` : ""}

Create a remixed version. Keep it practical. Return ONLY JSON:
{
  "title": "new title",
  "description": "one line description",
  "remixNote": "brief explanation of what changed",
  "cookTimeMinutes": number,
  "ingredients": [{"name": "...", "quantity": "...", "isOptional": false}],
  "instructions": [{"step_number": 1, "text": "..."}]
}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const raw = content.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const remixed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(remixed);
  } catch (err) {
    console.error("Recipe remix error:", err);
    return NextResponse.json({ error: "Failed to remix recipe" }, { status: 500 });
  }
}
