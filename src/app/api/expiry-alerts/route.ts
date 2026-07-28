import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

/** Expiring pantry items + recipe suggestions that use them */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiring = await prisma.pantryItem.findMany({
    where: {
      userId: user!.id,
      expiresAt: { gte: now, lte: inThreeDays },
    },
    include: { ingredient: true },
    orderBy: { expiresAt: "asc" },
  });

  const expired = await prisma.pantryItem.findMany({
    where: {
      userId: user!.id,
      expiresAt: { lt: now },
    },
    include: { ingredient: true },
    orderBy: { expiresAt: "asc" },
    take: 10,
  });

  const alerts = [];
  for (const item of expiring) {
    const recipes = await prisma.recipe.findMany({
      where: {
        status: "approved",
        recipeIngredients: { some: { ingredientId: item.ingredientId } },
      },
      take: 3,
      select: {
        id: true,
        title: true,
        cookTimeMinutes: true,
        imageUrl: true,
      },
      orderBy: { cookTimeMinutes: "asc" },
    });

    alerts.push({
      pantryItemId: item.id,
      ingredient: item.ingredient,
      expiresAt: item.expiresAt,
      quantityNote: item.quantityNote,
      recipes,
    });
  }

  return NextResponse.json({ alerts, expired });
}
