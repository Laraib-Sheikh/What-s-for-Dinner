import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.groceryListItem.findMany({
    where: { userId: session.user.id },
    include: { ingredient: true },
    orderBy: [{ ingredient: { category: "asc" } }, { ingredient: { name: "asc" } }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.action === "generate") {
    return generateFromMealPlan(session.user.id);
  }

  if (body.action === "toggle") {
    const item = await prisma.groceryListItem.update({
      where: { id: body.id },
      data: { isChecked: !body.isChecked },
      include: { ingredient: true },
    });
    return NextResponse.json(item);
  }

  if (body.action === "add") {
    const ingredient = await prisma.ingredient.upsert({
      where: { name: body.ingredientName.toLowerCase().trim() },
      update: {},
      create: { name: body.ingredientName.toLowerCase().trim() },
    });

    const item = await prisma.groceryListItem.create({
      data: {
        userId: session.user.id,
        ingredientId: ingredient.id,
        quantity: body.quantity || null,
        source: "manual",
      },
      include: { ingredient: true },
    });
    return NextResponse.json(item, { status: 201 });
  }

  if (body.action === "delete") {
    await prisma.groceryListItem.deleteMany({
      where: { id: body.id, userId: session.user.id },
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "clear-checked") {
    await prisma.groceryListItem.deleteMany({
      where: { userId: session.user.id, isChecked: true },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function generateFromMealPlan(userId: string) {
  const startDate = getWeekStart(new Date());
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const mealPlanEntries = await prisma.mealPlanEntry.findMany({
    where: {
      userId,
      plannedDate: { gte: startDate, lt: endDate },
    },
    include: {
      recipe: {
        include: {
          recipeIngredients: {
            include: { ingredient: true },
          },
        },
      },
    },
  });

  const pantryItems = await prisma.pantryItem.findMany({
    where: { userId },
    select: { ingredientId: true },
  });
  const ownedIds = new Set(pantryItems.map((p) => p.ingredientId));

  const needed = new Map<string, { ingredient: { id: string; name: string; category: string }; quantities: string[] }>();

  for (const entry of mealPlanEntries) {
    for (const ri of entry.recipe.recipeIngredients) {
      if (!ownedIds.has(ri.ingredientId)) {
        if (!needed.has(ri.ingredientId)) {
          needed.set(ri.ingredientId, { ingredient: ri.ingredient, quantities: [] });
        }
        if (ri.quantity) {
          needed.get(ri.ingredientId)!.quantities.push(ri.quantity);
        }
      }
    }
  }

  await prisma.groceryListItem.deleteMany({
    where: { userId, source: "meal_plan" },
  });

  const created = [];
  for (const [ingredientId, data] of needed) {
    const quantity = data.quantities.length > 0 ? data.quantities.join(", ") : null;
    const item = await prisma.groceryListItem.create({
      data: {
        userId,
        ingredientId,
        quantity,
        source: "meal_plan",
        isChecked: false,
      },
      include: { ingredient: true },
    });
    created.push(item);
  }

  return NextResponse.json({ generated: created.length, items: created });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
