import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays } from "date-fns";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + 5);

  const [expiringPantry, leftovers] = await Promise.all([
    prisma.pantryItem.findMany({
      where: {
        userId: session.user.id,
        expiresAt: { lte: cutoff },
      },
      include: {
        ingredient: true,
      },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.leftoverContainer.findMany({
      where: {
        userId: session.user.id,
        consumedAt: null,
      },
      include: { recipe: { select: { id: true, title: true } } },
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  type PriorityItem = {
    type: "pantry" | "leftover";
    id: string;
    name: string;
    daysLeft: number | null;
    urgency: "expired" | "today" | "soon" | "this_week";
    recipeId?: string | null;
    recipeTitle?: string | null;
    servings?: number | null;
  };

  const items: PriorityItem[] = [];

  for (const item of expiringPantry) {
    const daysLeft = item.expiresAt
      ? differenceInCalendarDays(new Date(item.expiresAt), now)
      : null;
    let urgency: PriorityItem["urgency"] = "this_week";
    if (daysLeft !== null) {
      if (daysLeft < 0) urgency = "expired";
      else if (daysLeft === 0) urgency = "today";
      else if (daysLeft <= 2) urgency = "soon";
    }
    items.push({
      type: "pantry",
      id: item.id,
      name: item.ingredient.name,
      daysLeft,
      urgency,
    });
  }

  for (const container of leftovers) {
    const daysLeft = container.expiresAt
      ? differenceInCalendarDays(new Date(container.expiresAt), now)
      : null;
    let urgency: PriorityItem["urgency"] = "this_week";
    if (daysLeft !== null) {
      if (daysLeft < 0) urgency = "expired";
      else if (daysLeft === 0) urgency = "today";
      else if (daysLeft <= 2) urgency = "soon";
    }
    items.push({
      type: "leftover",
      id: container.id,
      name: container.name,
      daysLeft,
      urgency,
      recipeId: container.recipe?.id ?? null,
      recipeTitle: container.recipe?.title ?? null,
      servings: container.servings,
    });
  }

  // Sort: expired first, then today, then by daysLeft ascending
  const order = { expired: 0, today: 1, soon: 2, this_week: 3 };
  items.sort((a, b) => {
    const urgencyDiff = order[a.urgency] - order[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    const aD = a.daysLeft ?? 99;
    const bD = b.daysLeft ?? 99;
    return aD - bD;
  });

  return NextResponse.json({ items });
}
