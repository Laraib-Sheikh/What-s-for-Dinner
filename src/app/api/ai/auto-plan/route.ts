import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { addDays, startOfWeek } from "date-fns";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekStart: weekStartStr } = await req.json();

  const weekStart = weekStartStr ? new Date(weekStartStr) : startOfWeek(new Date(), { weekStartsOn: 1 });

  const [pantryItems, favorites, cookLogs, expiryAlerts, allRecipes] = await Promise.all([
    prisma.pantryItem.findMany({
      where: { userId: session.user.id },
      include: { ingredient: true },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { recipe: true },
      take: 20,
    }),
    prisma.cookLog.findMany({
      where: { userId: session.user.id },
      include: { recipe: true },
      orderBy: { cookedAt: "desc" },
      take: 30,
    }),
    prisma.pantryItem.findMany({
      where: {
        userId: session.user.id,
        expiresAt: { lte: addDays(new Date(), 5), gte: new Date() },
      },
      include: { ingredient: true },
    }),
    prisma.recipe.findMany({
      where: { status: "approved" },
      include: { recipeIngredients: { include: { ingredient: true } } },
      take: 80,
    }),
  ]);

  const pantryNames = pantryItems.map((p) => p.ingredient.name);
  const expiringNames = expiryAlerts.map((p) => p.ingredient.name);
  const favoriteIds = new Set(favorites.map((f) => f.recipeId));
  const recentlyCooked = cookLogs.slice(0, 14).map((l) => l.recipe.title);

  const scoredRecipes = allRecipes
    .map((r) => {
      const required = r.recipeIngredients.filter((ri) => !ri.isOptional);
      const have = required.filter((ri) => pantryNames.includes(ri.ingredient.name));
      const expiryBoost = r.recipeIngredients.some((ri) => expiringNames.includes(ri.ingredient.name)) ? 20 : 0;
      const favBoost = favoriteIds.has(r.id) ? 10 : 0;
      const score = required.length > 0
        ? Math.round((have.length / required.length) * 100) + expiryBoost + favBoost
        : expiryBoost + favBoost;
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);

  const slots = ["breakfast", "lunch", "dinner"] as const;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  if (!process.env.ANTHROPIC_API_KEY) {
    const plan: Array<{ date: string; slot: string; recipeId: string; title: string }> = [];
    let recipeIndex = 0;
    for (const day of days) {
      for (const slot of slots) {
        const recipe = scoredRecipes[recipeIndex % scoredRecipes.length];
        if (recipe) {
          plan.push({ date: day.toISOString(), slot, recipeId: recipe.id, title: recipe.title });
        }
        recipeIndex++;
      }
    }
    return NextResponse.json({ plan });
  }

  const recipeList = scoredRecipes.slice(0, 40).map((r) =>
    `[${r.id}] "${r.title}" (${r.mealType}, ${r.cookTimeMinutes}min, score:${r.score}${favoriteIds.has(r.id) ? ", ★FAV" : ""}${r.recipeIngredients.some((ri) => expiringNames.includes(ri.ingredient.name)) ? ", USES_EXPIRING" : ""})`
  ).join("\n");

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Build a 7-day meal plan (breakfast, lunch, dinner each day).

Available recipes (higher score = better match):
${recipeList}

Pantry: ${pantryNames.slice(0, 20).join(", ")}
Expiring soon (prioritize): ${expiringNames.join(", ") || "none"}
Recently cooked (avoid repeating): ${recentlyCooked.slice(0, 7).join(", ") || "none"}

Rules:
1. Use expiring ingredients first
2. Don't repeat same recipe twice
3. Vary protein types across days (no chicken 4 nights in a row)
4. Mix quick meals (lunch) with more elaborate dinners
5. Prefer high-score (pantry match) recipes
6. Favor favorites (★FAV) for dinners

Return ONLY a JSON array for all 21 meals:
[
  {"date": "${days[0].toISOString()}", "slot": "breakfast", "recipeId": "...", "title": "..."},
  {"date": "${days[0].toISOString()}", "slot": "lunch", "recipeId": "...", "title": "..."},
  ...
]`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const raw = content.text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");

    const plan = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ plan });
  } catch (err) {
    console.error("Auto-plan error:", err);
    const fallbackPlan: Array<{ date: string; slot: string; recipeId: string; title: string }> = [];
    let idx = 0;
    for (const day of days) {
      for (const slot of slots) {
        const recipe = scoredRecipes[idx % scoredRecipes.length];
        if (recipe) {
          fallbackPlan.push({ date: day.toISOString(), slot, recipeId: recipe.id, title: recipe.title });
        }
        idx++;
      }
    }
    return NextResponse.json({ plan: fallbackPlan });
  }
}
