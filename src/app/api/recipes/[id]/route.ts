import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      recipeIngredients: {
        include: { ingredient: true },
      },
    },
  });

  if (!recipe || (recipe.status !== "approved" && recipe.submittedBy !== session?.user?.id)) {
    // Allow admins to preview any recipe
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (recipe && role !== "admin" && role !== "moderator") {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
  }

  let ownedIds = new Set<string>();
  let isFavorite = false;

  if (session?.user?.id) {
    const pantryItems = await prisma.pantryItem.findMany({
      where: { userId: session.user.id },
      select: { ingredientId: true },
    });
    ownedIds = new Set(pantryItems.map((p) => p.ingredientId));

    const fav = await prisma.favorite.findUnique({
      where: {
        userId_recipeId: { userId: session.user.id, recipeId: id },
      },
    });
    isFavorite = !!fav;
  }

  const ingredients = recipe.recipeIngredients.map((ri) => ({
    ...ri,
    have: ownedIds.has(ri.ingredientId),
  }));

  const required = ingredients.filter((i) => !i.isOptional);
  const owned = required.filter((i) => i.have);
  const matchScore =
    required.length === 0 ? 100 : Math.round((owned.length / required.length) * 100);

  return NextResponse.json({ ...recipe, recipeIngredients: ingredients, matchScore, isFavorite });
}
