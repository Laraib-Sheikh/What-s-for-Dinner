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

  const { weekStart } = await req.json();

  const startDate = weekStart ? new Date(weekStart) : new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const entries = await prisma.mealPlanEntry.findMany({
    where: {
      userId: session.user.id,
      plannedDate: { gte: startDate, lt: endDate },
    },
    include: { recipe: true },
  });

  if (entries.length === 0) {
    return NextResponse.json({
      score: 0,
      summary: "No meals planned this week.",
      flags: [],
      swapSuggestion: null,
    });
  }

  const mealSummary = entries.map((e) => ({
    title: e.recipe.title,
    slot: e.mealSlot,
    calories: e.recipe.calories,
    protein: e.recipe.proteinGrams,
    carbs: e.recipe.carbsGrams,
    fat: e.recipe.fatGrams,
    cuisine: e.recipe.cuisine,
    mealType: e.recipe.mealType,
    dietaryTags: e.recipe.dietaryTags,
  }));

  const totalCalories = mealSummary.reduce((s, m) => s + (m.calories ?? 500), 0);
  const totalProtein = mealSummary.reduce((s, m) => s + (m.protein ?? 0), 0);
  const totalCarbs = mealSummary.reduce((s, m) => s + (m.carbs ?? 0), 0);

  const titleCounts: Record<string, number> = {};
  mealSummary.forEach((m) => {
    titleCounts[m.title] = (titleCounts[m.title] || 0) + 1;
  });
  const duplicates = Object.entries(titleCounts)
    .filter(([, c]) => c > 1)
    .map(([t]) => t);

  if (!process.env.ANTHROPIC_API_KEY) {
    const flags: string[] = [];
    if (duplicates.length > 0) flags.push(`Repeated meals: ${duplicates.join(", ")}`);
    if (totalCarbs > totalProtein * 3) flags.push("High carb-to-protein ratio");
    return NextResponse.json({
      score: Math.max(40, 100 - flags.length * 15),
      summary: `${entries.length} meals planned. Avg ~${Math.round(totalCalories / Math.max(entries.length, 1))} kcal/meal.`,
      flags,
      swapSuggestion: flags.length > 0 ? "Consider adding more protein-rich meals." : null,
    });
  }

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Analyze the nutritional balance of this week's meal plan:

${JSON.stringify(mealSummary, null, 2)}

Total approx: ${totalCalories} kcal, ${Math.round(totalProtein)}g protein, ${Math.round(totalCarbs)}g carbs

Give a brief, practical nutritional assessment. Return ONLY JSON:
{
  "score": 0-100,
  "summary": "one sentence overview",
  "flags": ["flag1", "flag2"],
  "swapSuggestion": "specific actionable tip or null"
}

Be encouraging but honest. Flags should be specific (e.g. "4 pasta dishes this week — heavy on carbs").`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const raw = content.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("Nutrition check error:", err);
    return NextResponse.json({
      score: 70,
      summary: `${entries.length} meals planned this week.`,
      flags: duplicates.length > 0 ? [`Repeated: ${duplicates.join(", ")}`] : [],
      swapSuggestion: null,
    });
  }
}
