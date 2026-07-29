import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { craving } = await req.json();

  if (!craving?.trim()) {
    return NextResponse.json({ error: "craving required" }, { status: 400 });
  }

  const recipes = await prisma.recipe.findMany({
    where: { status: "approved" },
    select: {
      id: true,
      title: true,
      description: true,
      cuisine: true,
      mealType: true,
      cookTimeMinutes: true,
      dietaryTags: true,
      imageUrl: true,
    },
    take: 100,
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    const lower = craving.toLowerCase();
    const matched = recipes
      .filter(
        (r) =>
          r.title.toLowerCase().includes(lower) ||
          r.description?.toLowerCase().includes(lower) ||
          r.cuisine?.toLowerCase().includes(lower) ||
          r.dietaryTags.some((t) => t.toLowerCase().includes(lower))
      )
      .slice(0, 5);
    return NextResponse.json({ recipes: matched, query: craving });
  }

  const recipeList = recipes.map((r) =>
    `[${r.id}] "${r.title}" — ${r.cuisine || r.mealType}, ${r.cookTimeMinutes}min${r.dietaryTags.length ? `, ${r.dietaryTags.join("/")}` : ""}${r.description ? ` — ${r.description.slice(0, 80)}` : ""}`
  ).join("\n");

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `User is craving: "${craving}"

Available recipes:
${recipeList}

Find the 3-5 recipes that best match this craving description. Consider flavor profiles, textures, mood, cuisine types.
Return ONLY a JSON array of recipe IDs like: ["id1", "id2", "id3"]`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const raw = content.text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");

    const ids: string[] = JSON.parse(jsonMatch[0]);
    const matched = ids
      .map((id) => recipes.find((r) => r.id === id))
      .filter(Boolean);

    return NextResponse.json({ recipes: matched, query: craving });
  } catch (err) {
    console.error("Craving search error:", err);
    return NextResponse.json({ recipes: recipes.slice(0, 5), query: craving });
  }
}
