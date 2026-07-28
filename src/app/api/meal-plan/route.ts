import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("weekStart");

  const startDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const entries = await prisma.mealPlanEntry.findMany({
    where: {
      userId: session.user.id,
      plannedDate: { gte: startDate, lt: endDate },
    },
    include: { recipe: true },
    orderBy: { plannedDate: "asc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipeId, plannedDate, mealSlot } = await req.json();

  const entry = await prisma.mealPlanEntry.create({
    data: {
      userId: session.user.id,
      recipeId,
      plannedDate: new Date(plannedDate),
      mealSlot: mealSlot || "dinner",
    },
    include: { recipe: true },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.mealPlanEntry.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
