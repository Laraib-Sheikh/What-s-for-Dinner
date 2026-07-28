import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);

  const cuisine = searchParams.get("cuisine");
  const mealType = searchParams.get("mealType");
  const dietaryTag = searchParams.get("dietaryTag");
  const maxTime = searchParams.get("maxTime");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (cuisine) where.cuisine = cuisine;
  if (mealType) where.mealType = mealType;
  if (maxTime) where.cookTimeMinutes = { lte: parseInt(maxTime) };
  if (dietaryTag) where.dietaryTags = { has: dietaryTag };
  if (search) where.title = { contains: search, mode: "insensitive" };

  const recipes = await prisma.recipe.findMany({
    where,
    include: {
      recipeIngredients: {
        include: { ingredient: true },
        where: { isOptional: false },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session?.user?.id) {
    return NextResponse.json(recipes.map((r) => ({ ...r, matchScore: 0, missingIngredients: [] })));
  }

  const pantryItems = await prisma.pantryItem.findMany({
    where: { userId: session.user.id },
    select: { ingredientId: true },
  });
  const ownedIds = new Set(pantryItems.map((p) => p.ingredientId));

  const favoriteIds = new Set(
    (
      await prisma.favorite.findMany({
        where: { userId: session.user.id },
        select: { recipeId: true },
      })
    ).map((f) => f.recipeId)
  );

  const scored = recipes.map((recipe) => {
    const required = recipe.recipeIngredients.filter((ri) => !ri.isOptional);
    const owned = required.filter((ri) => ownedIds.has(ri.ingredientId));
    const missing = required.filter((ri) => !ownedIds.has(ri.ingredientId));
    const matchScore =
      required.length === 0 ? 100 : Math.round((owned.length / required.length) * 100);

    return {
      ...recipe,
      matchScore,
      missingCount: missing.length,
      missingIngredients: missing.map((ri) => ri.ingredient.name),
      isFavorite: favoriteIds.has(recipe.id),
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return NextResponse.json(scored);
}
