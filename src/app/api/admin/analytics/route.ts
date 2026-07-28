import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [
    userCount,
    recipeCount,
    pendingRecipes,
    ingredientCount,
    cookCount,
    reviewCount,
    popularRecipes,
    topPantry,
    matchSample,
    flaggedReviews,
    recentActions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.recipe.count({ where: { status: "approved" } }),
    prisma.recipe.count({ where: { status: "pending" } }),
    prisma.ingredient.count(),
    prisma.cookLog.count(),
    prisma.recipeReview.count(),
    prisma.recipe.findMany({
      where: { status: "approved" },
      take: 8,
      orderBy: { favorites: { _count: "desc" } },
      select: {
        id: true,
        title: true,
        _count: { select: { favorites: true, cookLog: true, reviews: true } },
      },
    }),
    prisma.ingredient.findMany({
      take: 10,
      orderBy: { pantryItems: { _count: "desc" } },
      select: {
        id: true,
        name: true,
        category: true,
        _count: { select: { pantryItems: true } },
      },
    }),
    prisma.cookLog.groupBy({
      by: ["rating"],
      _count: true,
      where: { rating: { not: null } },
    }),
    prisma.recipeReview.findMany({
      where: { flagged: true },
      take: 20,
      include: {
        user: { select: { name: true, email: true } },
        recipe: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.adminAction.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { name: true, email: true } } },
    }),
  ]);

  // Approximate match-score distribution from users with pantry
  const usersWithPantry = await prisma.user.findMany({
    take: 50,
    select: {
      id: true,
      pantryItems: { select: { ingredientId: true } },
    },
  });

  const recipes = await prisma.recipe.findMany({
    where: { status: "approved" },
    take: 40,
    include: {
      recipeIngredients: {
        where: { isOptional: false },
        select: { ingredientId: true },
      },
    },
  });

  const buckets = { high: 0, mid: 0, low: 0, total: 0 };
  for (const u of usersWithPantry) {
    if (u.pantryItems.length === 0) continue;
    const owned = new Set(u.pantryItems.map((p) => p.ingredientId));
    for (const r of recipes) {
      const req = r.recipeIngredients;
      if (req.length === 0) continue;
      const have = req.filter((ri) => owned.has(ri.ingredientId)).length;
      const score = Math.round((have / req.length) * 100);
      buckets.total++;
      if (score >= 80) buckets.high++;
      else if (score >= 50) buckets.mid++;
      else buckets.low++;
    }
  }

  return NextResponse.json({
    stats: {
      userCount,
      recipeCount,
      pendingRecipes,
      ingredientCount,
      cookCount,
      reviewCount,
    },
    popularRecipes,
    topPantry,
    ratingDistribution: matchSample,
    matchScoreDistribution: buckets,
    flaggedReviews,
    recentActions,
  });
}
