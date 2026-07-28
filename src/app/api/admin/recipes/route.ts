import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) where.title = { contains: search, mode: "insensitive" };

  const recipes = await prisma.recipe.findMany({
    where,
    include: {
      submitter: { select: { id: true, name: true, email: true } },
      _count: { select: { recipeIngredients: true, reviews: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(recipes);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();

  if (body.action === "create" || !body.action) {
    const recipe = await prisma.recipe.create({
      data: {
        title: body.title,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        cuisine: body.cuisine || null,
        mealType: body.mealType || "dinner",
        cookTimeMinutes: Number(body.cookTimeMinutes) || 30,
        servings: Number(body.servings) || 4,
        dietaryTags: body.dietaryTags || [],
        instructions: body.instructions || [],
        status: "approved",
        calories: body.calories ? Number(body.calories) : null,
        proteinGrams: body.proteinGrams != null ? Number(body.proteinGrams) : null,
        carbsGrams: body.carbsGrams != null ? Number(body.carbsGrams) : null,
        fatGrams: body.fatGrams != null ? Number(body.fatGrams) : null,
        recipeIngredients: body.ingredients?.length
          ? {
              create: await Promise.all(
                body.ingredients.map(
                  async (ing: { name: string; quantity?: string; isOptional?: boolean }) => {
                    const ingredient = await prisma.ingredient.upsert({
                      where: { name: ing.name.toLowerCase().trim() },
                      update: {},
                      create: { name: ing.name.toLowerCase().trim() },
                    });
                    return {
                      ingredientId: ingredient.id,
                      quantity: ing.quantity || null,
                      isOptional: !!ing.isOptional,
                    };
                  }
                )
              ),
            }
          : undefined,
      },
    });

    await logAdminAction(user!.id, "recipe_created", "recipe", recipe.id);
    return NextResponse.json(recipe, { status: 201 });
  }

  if (body.action === "update") {
    const recipe = await prisma.recipe.update({
      where: { id: body.id },
      data: {
        title: body.title,
        description: body.description,
        imageUrl: body.imageUrl,
        cuisine: body.cuisine,
        mealType: body.mealType,
        cookTimeMinutes: body.cookTimeMinutes != null ? Number(body.cookTimeMinutes) : undefined,
        servings: body.servings != null ? Number(body.servings) : undefined,
        dietaryTags: body.dietaryTags,
        instructions: body.instructions,
        status: body.status,
        calories: body.calories != null ? Number(body.calories) : undefined,
        proteinGrams: body.proteinGrams != null ? Number(body.proteinGrams) : undefined,
        carbsGrams: body.carbsGrams != null ? Number(body.carbsGrams) : undefined,
        fatGrams: body.fatGrams != null ? Number(body.fatGrams) : undefined,
      },
    });
    await logAdminAction(user!.id, "recipe_updated", "recipe", recipe.id);
    return NextResponse.json(recipe);
  }

  if (body.action === "approve" || body.action === "reject") {
    const status = body.action === "approve" ? "approved" : "rejected";
    const recipe = await prisma.recipe.update({
      where: { id: body.id },
      data: { status },
    });
    await logAdminAction(user!.id, `recipe_${status}`, "recipe", recipe.id);
    return NextResponse.json(recipe);
  }

  if (body.action === "delete") {
    await prisma.recipe.delete({ where: { id: body.id } });
    await logAdminAction(user!.id, "recipe_deleted", "recipe", body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "bulk-import") {
    const rows = body.rows as Array<{
      title: string;
      description?: string;
      cuisine?: string;
      mealType?: string;
      cookTimeMinutes?: number;
      servings?: number;
      dietaryTags?: string;
      ingredients?: string;
      instructions?: string;
    }>;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }

    let created = 0;
    for (const row of rows.slice(0, 200)) {
      if (!row.title?.trim()) continue;
      const dietaryTags = row.dietaryTags
        ? row.dietaryTags.split("|").map((t) => t.trim()).filter(Boolean)
        : [];
      const instructions = row.instructions
        ? row.instructions.split("|").map((text, i) => ({ step_number: i + 1, text: text.trim() }))
        : [];
      const ingredientNames = row.ingredients
        ? row.ingredients.split("|").map((s) => s.trim()).filter(Boolean)
        : [];

      await prisma.recipe.create({
        data: {
          title: row.title.trim(),
          description: row.description || null,
          cuisine: row.cuisine || null,
          mealType: row.mealType || "dinner",
          cookTimeMinutes: Number(row.cookTimeMinutes) || 30,
          servings: Number(row.servings) || 4,
          dietaryTags,
          instructions,
          status: "approved",
          recipeIngredients: {
            create: await Promise.all(
              ingredientNames.map(async (name) => {
                const ingredient = await prisma.ingredient.upsert({
                  where: { name: name.toLowerCase() },
                  update: {},
                  create: { name: name.toLowerCase() },
                });
                return { ingredientId: ingredient.id };
              })
            ),
          },
        },
      });
      created++;
    }

    await logAdminAction(user!.id, "recipes_bulk_import", "recipe", undefined, { created });
    return NextResponse.json({ created });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
