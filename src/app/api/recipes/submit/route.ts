import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

/** User submits a recipe for admin approval */
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const ingredients: Array<{ name: string; quantity?: string; isOptional?: boolean }> =
    body.ingredients || [];

  const recipeIngredients = [];
  for (const ing of ingredients) {
    if (!ing.name?.trim()) continue;
    const ingredient = await prisma.ingredient.upsert({
      where: { name: ing.name.toLowerCase().trim() },
      update: {},
      create: { name: ing.name.toLowerCase().trim() },
    });
    recipeIngredients.push({
      ingredientId: ingredient.id,
      quantity: ing.quantity || null,
      isOptional: !!ing.isOptional,
    });
  }

  const recipe = await prisma.recipe.create({
    data: {
      title: body.title.trim(),
      description: body.description || null,
      imageUrl: body.imageUrl || null,
      cuisine: body.cuisine || null,
      mealType: body.mealType || "dinner",
      cookTimeMinutes: Number(body.cookTimeMinutes) || 30,
      servings: Number(body.servings) || 4,
      dietaryTags: body.dietaryTags || [],
      instructions: body.instructions || [],
      status: "pending",
      submittedBy: user!.id,
      calories: body.calories ? Number(body.calories) : null,
      recipeIngredients: { create: recipeIngredients },
    },
  });

  return NextResponse.json(recipe, { status: 201 });
}
