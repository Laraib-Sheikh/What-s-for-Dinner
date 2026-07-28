import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

/**
 * Leftover mode: given ingredient names (or use full pantry),
 * return single-serving-friendly recipes with high match to ONLY those items.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  let ingredientIds: string[] = body.ingredientIds || [];

  if (body.names?.length) {
    const names = (body.names as string[]).map((n) => n.toLowerCase().trim());
    const found = await prisma.ingredient.findMany({
      where: { name: { in: names } },
    });
    ingredientIds = found.map((f) => f.id);
  }

  if (ingredientIds.length === 0) {
    const pantry = await prisma.pantryItem.findMany({
      where: { userId: user!.id },
      select: { ingredientId: true },
    });
    ingredientIds = pantry.map((p) => p.ingredientId);
  }

  if (ingredientIds.length === 0) {
    return NextResponse.json({ recipes: [] });
  }

  const owned = new Set(ingredientIds);

  const recipes = await prisma.recipe.findMany({
    where: {
      status: "approved",
      servings: { lte: body.maxServings ? Number(body.maxServings) : 4 },
      recipeIngredients: {
        some: { ingredientId: { in: ingredientIds }, isOptional: false },
      },
    },
    include: {
      recipeIngredients: {
        where: { isOptional: false },
        include: { ingredient: true },
      },
    },
    take: 60,
  });

  const scored = recipes
    .map((recipe) => {
      const required = recipe.recipeIngredients;
      const have = required.filter((ri) => owned.has(ri.ingredientId));
      const missing = required.filter((ri) => !owned.has(ri.ingredientId));
      // Prefer recipes that use leftovers well and need few extras
      const coverage =
        required.length === 0 ? 0 : have.length / required.length;
      const leftoverUse = have.length;
      const score =
        Math.round(coverage * 70) +
        Math.min(leftoverUse * 8, 24) -
        missing.length * 5;

      return {
        id: recipe.id,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
        cookTimeMinutes: recipe.cookTimeMinutes,
        servings: recipe.servings,
        matchScore: Math.max(0, Math.min(100, Math.round(coverage * 100))),
        leftoverScore: score,
        using: have.map((h) => h.ingredient.name),
        missing: missing.map((m) => m.ingredient.name),
      };
    })
    .filter((r) => r.using.length > 0 && r.missing.length <= 2)
    .sort((a, b) => b.leftoverScore - a.leftoverScore)
    .slice(0, 12);

  return NextResponse.json({ recipes: scored });
}
