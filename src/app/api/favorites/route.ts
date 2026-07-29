import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    include: {
      recipe: {
        include: {
          recipeIngredients: {
            include: { ingredient: true },
            where: { isOptional: false },
          },
        },
      },
    },
    orderBy: { savedAt: "desc" },
  });

  const recipeIds = favorites.map((f) => f.recipeId);

  const [pantryItems, reviewStats, cookStats] = await Promise.all([
    prisma.pantryItem.findMany({
      where: { userId: session.user.id },
      select: { ingredientId: true },
    }),
    recipeIds.length
      ? prisma.recipeReview.groupBy({
          by: ["recipeId"],
          where: { recipeId: { in: recipeIds } },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : Promise.resolve([]),
    recipeIds.length
      ? prisma.cookLog.groupBy({
          by: ["recipeId"],
          where: { userId: session.user.id, recipeId: { in: recipeIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const ownedIds = new Set(pantryItems.map((p) => p.ingredientId));
  const reviewMap = new Map(
    reviewStats.map((r) => [
      r.recipeId,
      { averageRating: r._avg.rating ?? 0, reviewCount: r._count.rating },
    ])
  );
  const cookMap = new Map(cookStats.map((c) => [c.recipeId, c._count._all]));

  const result = favorites.map((f) => {
    const required = f.recipe.recipeIngredients;
    const owned = required.filter((ri) => ownedIds.has(ri.ingredientId));
    const matchScore =
      required.length === 0 ? 100 : Math.round((owned.length / required.length) * 100);
    const reviews = reviewMap.get(f.recipeId);
    return {
      ...f.recipe,
      savedAt: f.savedAt,
      matchScore,
      isFavorite: true,
      averageRating: reviews?.averageRating ?? null,
      reviewCount: reviews?.reviewCount ?? 0,
      cookCount: cookMap.get(f.recipeId) ?? 0,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipeId } = await req.json();

  const existing = await prisma.favorite.findUnique({
    where: { userId_recipeId: { userId: session.user.id, recipeId } },
  });

  if (existing) {
    await prisma.favorite.delete({
      where: { userId_recipeId: { userId: session.user.id, recipeId } },
    });
    return NextResponse.json({ favorited: false });
  }

  await prisma.favorite.create({
    data: { userId: session.user.id, recipeId },
  });
  return NextResponse.json({ favorited: true });
}
