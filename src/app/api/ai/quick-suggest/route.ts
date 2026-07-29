import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { timeOfDay } = await req.json();

  const pantryItems = await prisma.pantryItem.findMany({
    where: { userId: session.user.id },
    include: { ingredient: true },
    take: 40,
  });

  const recipes = await prisma.recipe.findMany({
    where: { status: "approved" },
    include: { recipeIngredients: { include: { ingredient: true } } },
    take: 80,
  });

  const pantryNames = pantryItems.map((p) => p.ingredient.name);

  if (!process.env.ANTHROPIC_API_KEY) {
    const scored = recipes
      .map((r) => {
        const required = r.recipeIngredients.filter((ri) => !ri.isOptional);
        const have = required.filter((ri) => pantryNames.includes(ri.ingredient.name));
        const score = required.length > 0 ? Math.round((have.length / required.length) * 100) : 0;
        return { ...r, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => ({ id: r.id, title: r.title, reason: `${r.score}% pantry match`, cookTimeMinutes: r.cookTimeMinutes }));
    return NextResponse.json({ suggestions: scored });
  }

  const hour = timeOfDay === "morning" ? 8 : timeOfDay === "afternoon" ? 14 : 19;
  const mealContext = hour < 11 ? "breakfast" : hour < 15 ? "lunch" : "dinner";

  const recipeList = recipes.slice(0, 50).map((r) => {
    const required = r.recipeIngredients.filter((ri) => !ri.isOptional);
    const have = required.filter((ri) => pantryNames.includes(ri.ingredient.name));
    const score = required.length > 0 ? Math.round((have.length / required.length) * 100) : 0;
    return `- ${r.title} (${r.cookTimeMinutes}min, ${r.mealType}, ${score}% match) [id:${r.id}]`;
  }).join("\n");

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `User wants to cook something right now (${mealContext} time).
Pantry: ${pantryNames.slice(0, 25).join(", ")}

Available recipes:
${recipeList}

Pick the 3 BEST recipes to make RIGHT NOW considering:
1. High pantry match (they have the ingredients)
2. Appropriate for ${mealContext}
3. Variety (different cuisines/types)

Return ONLY a JSON array:
[{"id": "...", "title": "...", "reason": "short reason why this is perfect right now"}]`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const raw = content.text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");

    const aiSuggestions = JSON.parse(jsonMatch[0]) as Array<{ id: string; title: string; reason: string }>;

    const enriched = aiSuggestions.map((s) => {
      const recipe = recipes.find((r) => r.id === s.id);
      return {
        id: s.id,
        title: s.title,
        reason: s.reason,
        cookTimeMinutes: recipe?.cookTimeMinutes ?? 30,
        imageUrl: recipe?.imageUrl ?? null,
        mealType: recipe?.mealType ?? "dinner",
      };
    });

    return NextResponse.json({ suggestions: enriched });
  } catch (err) {
    console.error("Quick suggest error:", err);
    const fallback = recipes
      .map((r) => {
        const required = r.recipeIngredients.filter((ri) => !ri.isOptional);
        const have = required.filter((ri) => pantryNames.includes(ri.ingredient.name));
        return { ...r, score: required.length > 0 ? (have.length / required.length) * 100 : 0 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => ({ id: r.id, title: r.title, reason: `${Math.round(r.score)}% match with your pantry`, cookTimeMinutes: r.cookTimeMinutes, imageUrl: r.imageUrl, mealType: r.mealType }));
    return NextResponse.json({ suggestions: fallback });
  }
}
