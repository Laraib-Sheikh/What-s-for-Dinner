import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, categorizeCustomItem } from "@/lib/rbac";
import { randomBytes } from "crypto";

async function getOrCreateDefaultList(userId: string) {
  const existing = await prisma.shoppingList.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.shoppingList.create({
    data: { userId, name: "This week" },
  });
}

function serializeList(
  list: Awaited<ReturnType<typeof fetchList>>,
  pantryMap: Map<string, { quantityNote: string | null }>
) {
  if (!list) return null;
  return {
    ...list,
    items: list.items.map((item) => {
      const pantry = item.ingredientId ? pantryMap.get(item.ingredientId) : undefined;
      let pantryHint = item.pantryHint;
      if (item.ingredientId && pantry) {
        pantryHint =
          pantry.quantityNote === "running low" || pantry.quantityNote === "a little"
            ? "have_some"
            : "in_pantry";
      }
      return {
        ...item,
        displayName: item.customItemName || item.ingredient?.name || "Item",
        pantryHint,
      };
    }),
  };
}

async function fetchList(listId: string, userId: string) {
  return prisma.shoppingList.findFirst({
    where: { id: listId, userId },
    include: {
      items: {
        include: { ingredient: true },
        orderBy: [{ category: "asc" }, { customItemName: "asc" }],
      },
    },
  });
}

async function pantryMapFor(userId: string) {
  const items = await prisma.pantryItem.findMany({
    where: { userId },
    select: { ingredientId: true, quantityNote: true },
  });
  return new Map(items.map((p) => [p.ingredientId, { quantityNote: p.quantityNote }]));
}

/** GET /api/shopping-lists — all lists; ?id= for one list with items */
export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const listId = req.nextUrl.searchParams.get("id");

  if (listId) {
    const list = await fetchList(listId, user!.id);
    if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pantry = await pantryMapFor(user!.id);
    return NextResponse.json(serializeList(list, pantry));
  }

  let lists = await prisma.shoppingList.findMany({
    where: { userId: user!.id },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (lists.length === 0) {
    const created = await getOrCreateDefaultList(user!.id);
    lists = [
      {
        ...created,
        _count: { items: 0 },
      },
    ];
  }

  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const action = body.action as string;

  if (action === "create-list") {
    const list = await prisma.shoppingList.create({
      data: { userId: user!.id, name: body.name?.trim() || "New list" },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json(list, { status: 201 });
  }

  if (action === "rename-list") {
    const list = await prisma.shoppingList.updateMany({
      where: { id: body.id, userId: user!.id },
      data: { name: body.name?.trim() || "My List" },
    });
    if (list.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete-list") {
    await prisma.shoppingList.deleteMany({ where: { id: body.id, userId: user!.id } });
    return NextResponse.json({ success: true });
  }

  if (action === "share") {
    const token = randomBytes(12).toString("hex");
    const updated = await prisma.shoppingList.updateMany({
      where: { id: body.id, userId: user!.id },
      data: { shareToken: token },
    });
    if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ shareToken: token, url: `/shared/${token}` });
  }

  if (action === "unshare") {
    await prisma.shoppingList.updateMany({
      where: { id: body.id, userId: user!.id },
      data: { shareToken: null },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "add") {
    let listId = body.listId as string | undefined;
    if (!listId) {
      listId = (await getOrCreateDefaultList(user!.id)).id;
    }

    const list = await prisma.shoppingList.findFirst({
      where: { id: listId, userId: user!.id },
    });
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

    const name = (body.name || body.ingredientName || "").toLowerCase().trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const isCustom = body.custom === true || body.customItem === true;

    if (isCustom) {
      const item = await prisma.shoppingListItem.create({
        data: {
          shoppingListId: listId,
          customItemName: name,
          quantity: body.quantity || null,
          category: body.category || categorizeCustomItem(name),
          source: "manual",
        },
        include: { ingredient: true },
      });
      return NextResponse.json(item, { status: 201 });
    }

    const ingredient = await prisma.ingredient.upsert({
      where: { name },
      update: {},
      create: { name, category: body.category || "other" },
    });

    const pantry = await prisma.pantryItem.findUnique({
      where: {
        userId_ingredientId: { userId: user!.id, ingredientId: ingredient.id },
      },
    });

    const item = await prisma.shoppingListItem.create({
      data: {
        shoppingListId: listId,
        ingredientId: ingredient.id,
        quantity: body.quantity || null,
        category: ingredient.category,
        source: "manual",
        pantryHint: pantry
          ? pantry.quantityNote === "running low" || pantry.quantityNote === "a little"
            ? "have_some"
            : "in_pantry"
          : null,
      },
      include: { ingredient: true },
    });
    return NextResponse.json(item, { status: 201 });
  }

  if (action === "toggle") {
    const existing = await prisma.shoppingListItem.findFirst({
      where: { id: body.id, shoppingList: { userId: user!.id } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const item = await prisma.shoppingListItem.update({
      where: { id: body.id },
      data: { isChecked: !existing.isChecked },
      include: { ingredient: true },
    });
    return NextResponse.json(item);
  }

  if (action === "delete") {
    await prisma.shoppingListItem.deleteMany({
      where: { id: body.id, shoppingList: { userId: user!.id } },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "clear-checked") {
    await prisma.shoppingListItem.deleteMany({
      where: {
        shoppingListId: body.listId,
        isChecked: true,
        shoppingList: { userId: user!.id },
      },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "generate") {
    return generateFromMealPlan(user!.id, body.listId, body.includePantryHints !== false);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function generateFromMealPlan(
  userId: string,
  listId: string | undefined,
  includePantryHints: boolean
) {
  const list = listId
    ? await prisma.shoppingList.findFirst({ where: { id: listId, userId } })
    : await getOrCreateDefaultList(userId);

  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

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
          recipeIngredients: { include: { ingredient: true } },
        },
      },
    },
  });

  const pantryItems = await prisma.pantryItem.findMany({
    where: { userId },
    select: { ingredientId: true, quantityNote: true },
  });
  const pantryById = new Map(pantryItems.map((p) => [p.ingredientId, p]));

  type Needed = {
    ingredient: { id: string; name: string; category: string };
    quantities: string[];
    pantryHint: string | null;
  };

  const needed = new Map<string, Needed>();

  for (const entry of mealPlanEntries) {
    for (const ri of entry.recipe.recipeIngredients) {
      if (ri.isOptional) continue;
      const pantry = pantryById.get(ri.ingredientId);

      // Fully exclude items clearly in pantry unless running low / a little
      if (pantry && includePantryHints) {
        const note = pantry.quantityNote || "";
        if (note !== "running low" && note !== "a little" && note !== "half") {
          continue; // exclude — you have it
        }
      } else if (pantry && !includePantryHints) {
        continue;
      }

      if (!needed.has(ri.ingredientId)) {
        let pantryHint: string | null = null;
        if (pantry) {
          pantryHint =
            pantry.quantityNote === "running low" ||
            pantry.quantityNote === "a little" ||
            pantry.quantityNote === "half"
              ? "have_some"
              : "in_pantry";
        }
        needed.set(ri.ingredientId, {
          ingredient: ri.ingredient,
          quantities: [],
          pantryHint,
        });
      }
      if (ri.quantity) needed.get(ri.ingredientId)!.quantities.push(ri.quantity);
    }
  }

  await prisma.shoppingListItem.deleteMany({
    where: { shoppingListId: list.id, source: "meal_plan" },
  });

  const created = [];
  for (const [ingredientId, data] of needed) {
    const item = await prisma.shoppingListItem.create({
      data: {
        shoppingListId: list.id,
        ingredientId,
        quantity: data.quantities.length > 0 ? [...new Set(data.quantities)].join(", ") : null,
        category: data.ingredient.category || "other",
        source: "meal_plan",
        pantryHint: data.pantryHint,
        isChecked: false,
      },
      include: { ingredient: true },
    });
    created.push(item);
  }

  return NextResponse.json({ generated: created.length, listId: list.id, items: created });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
