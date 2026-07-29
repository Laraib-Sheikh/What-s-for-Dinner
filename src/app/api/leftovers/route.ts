import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

async function searchRecipes(
  userId: string,
  body: { ingredientIds?: string[]; names?: string[]; maxServings?: number }
) {
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
      where: { userId },
      select: { ingredientId: true },
    });
    ingredientIds = pantry.map((p) => p.ingredientId);
  }

  if (ingredientIds.length === 0) {
    return [];
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

  return recipes
    .map((recipe) => {
      const required = recipe.recipeIngredients;
      const have = required.filter((ri) => owned.has(ri.ingredientId));
      const missing = required.filter((ri) => !owned.has(ri.ingredientId));
      const coverage = required.length === 0 ? 0 : have.length / required.length;
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
}

function defaultExpiry(storedAt: Date, days = 4) {
  const d = new Date(storedAt);
  d.setDate(d.getDate() + days);
  return d;
}

function serializeContainer(
  c: Awaited<ReturnType<typeof fetchContainers>>[number]
) {
  return {
    ...c,
    imageUrl: c.imageUrl || c.recipe?.imageUrl || null,
  };
}

async function fetchContainers(userId: string, activeOnly = true) {
  return prisma.leftoverContainer.findMany({
    where: {
      userId,
      ...(activeOnly ? { consumedAt: null } : {}),
    },
    include: { recipe: { select: { id: true, title: true, imageUrl: true } } },
    orderBy: { storedAt: "desc" },
  });
}

/** GET /api/leftovers — active fridge containers + stats */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const [containers, consumedCount] = await Promise.all([
    fetchContainers(user!.id),
    prisma.leftoverContainer.count({
      where: { userId: user!.id, consumedAt: { not: null } },
    }),
  ]);

  return NextResponse.json({
    containers: containers.map(serializeContainer),
    stats: {
      activeCount: containers.length,
      wasteAvoidedKg: Math.round(consumedCount * 0.52 * 10) / 10,
    },
  });
}

/**
 * POST /api/leftovers
 * - action "search" (default): recipe suggestions from pantry / names
 * - action "create" | "consume" | "delete" | "suggest"
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const action = (body.action as string) || "search";

  if (action === "create") {
    const name = (body.name as string)?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const storedAt = body.storedAt ? new Date(body.storedAt) : new Date();
    const shelfDays = Number(body.shelfLifeDays) || 4;
    const expiresAt = body.expiresAt
      ? new Date(body.expiresAt)
      : defaultExpiry(storedAt, shelfDays);

    const container = await prisma.leftoverContainer.create({
      data: {
        userId: user!.id,
        name,
        imageUrl: body.imageUrl || null,
        storedAt,
        expiresAt,
        servings: body.servings ? Number(body.servings) : 2,
        tags: Array.isArray(body.tags) ? body.tags : [],
        recipeId: body.recipeId || null,
      },
      include: { recipe: { select: { id: true, title: true, imageUrl: true } } },
    });

    return NextResponse.json(serializeContainer(container), { status: 201 });
  }

  if (action === "consume") {
    const updated = await prisma.leftoverContainer.updateMany({
      where: { id: body.id, userId: user!.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const deleted = await prisma.leftoverContainer.deleteMany({
      where: { id: body.id, userId: user!.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "suggest") {
    const container = await prisma.leftoverContainer.findFirst({
      where: { id: body.id, userId: user!.id, consumedAt: null },
      include: { recipe: true },
    });
    if (!container) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const names = container.name.toLowerCase().split(/\s+/).slice(0, 4);
    const recipes = await searchRecipes(user!.id, { names, maxServings: 4 });
    const top = recipes[0];

    if (top && !container.aiSuggestion) {
      await prisma.leftoverContainer.update({
        where: { id: container.id },
        data: { aiSuggestion: top.title },
      });
    }

    return NextResponse.json({
      container: serializeContainer(container),
      suggestion: top
        ? {
            recipeId: top.id,
            title: top.title,
            description: `Repurpose your ${container.name} into ${top.title}. Uses ${top.using.slice(0, 3).join(", ")}${top.missing.length ? ` — add ${top.missing.join(", ")}` : ""}.`,
          }
        : null,
      recipes,
    });
  }

  const recipes = await searchRecipes(user!.id, body);
  return NextResponse.json({ recipes });
}
