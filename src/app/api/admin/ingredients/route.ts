import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const search = req.nextUrl.searchParams.get("search");
  const where = search
    ? { name: { contains: search.toLowerCase(), mode: "insensitive" as const } }
    : {};

  const ingredients = await prisma.ingredient.findMany({
    where,
    include: {
      _count: {
        select: {
          recipeIngredients: true,
          pantryItems: true,
        },
      },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json(ingredients);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();

  if (body.action === "create") {
    const name = body.name?.toLowerCase().trim();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const ingredient = await prisma.ingredient.create({
      data: { name, category: body.category || "other" },
    });
    await logAdminAction(user!.id, "ingredient_created", "ingredient", ingredient.id);
    return NextResponse.json(ingredient, { status: 201 });
  }

  if (body.action === "update") {
    const ingredient = await prisma.ingredient.update({
      where: { id: body.id },
      data: {
        name: body.name?.toLowerCase().trim(),
        category: body.category,
      },
    });
    await logAdminAction(user!.id, "ingredient_updated", "ingredient", ingredient.id);
    return NextResponse.json(ingredient);
  }

  if (body.action === "delete") {
    await prisma.ingredient.delete({ where: { id: body.id } });
    await logAdminAction(user!.id, "ingredient_deleted", "ingredient", body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "merge") {
    const { keepId, mergeId } = body as { keepId: string; mergeId: string };
    if (!keepId || !mergeId || keepId === mergeId) {
      return NextResponse.json({ error: "keepId and mergeId required" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Re-point recipe ingredients (skip duplicates)
      const mergeRis = await tx.recipeIngredient.findMany({ where: { ingredientId: mergeId } });
      for (const ri of mergeRis) {
        const exists = await tx.recipeIngredient.findFirst({
          where: { recipeId: ri.recipeId, ingredientId: keepId },
        });
        if (exists) {
          await tx.recipeIngredient.delete({ where: { id: ri.id } });
        } else {
          await tx.recipeIngredient.update({
            where: { id: ri.id },
            data: { ingredientId: keepId },
          });
        }
      }

      // Re-point pantry (skip duplicates)
      const pantry = await tx.pantryItem.findMany({ where: { ingredientId: mergeId } });
      for (const p of pantry) {
        const exists = await tx.pantryItem.findUnique({
          where: { userId_ingredientId: { userId: p.userId, ingredientId: keepId } },
        });
        if (exists) {
          await tx.pantryItem.delete({ where: { id: p.id } });
        } else {
          await tx.pantryItem.update({
            where: { id: p.id },
            data: { ingredientId: keepId },
          });
        }
      }

      await tx.shoppingListItem.updateMany({
        where: { ingredientId: mergeId },
        data: { ingredientId: keepId },
      });

      await tx.groceryListItem.updateMany({
        where: { ingredientId: mergeId },
        data: { ingredientId: keepId },
      });

      await tx.ingredient.delete({ where: { id: mergeId } });
    });

    await logAdminAction(user!.id, "ingredient_merged", "ingredient", keepId, { mergeId });
    return NextResponse.json({ success: true, keepId });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
