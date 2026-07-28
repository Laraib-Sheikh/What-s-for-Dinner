import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAdmin, logAdminAction } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const { error } = await requireFullAdmin();
  if (error) return error;

  const search = req.nextUrl.searchParams.get("search");
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      suspendedAt: true,
      createdAt: true,
      _count: {
        select: {
          pantryItems: true,
          cookLog: true,
          favorites: true,
          mealPlanEntries: true,
          reviews: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireFullAdmin();
  if (error) return error;

  const body = await req.json();

  if (body.action === "set-role") {
    if (!["user", "admin", "moderator"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (body.id === user!.id) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: body.id },
      data: { role: body.role },
    });
    await logAdminAction(user!.id, "user_role_changed", "user", body.id, { role: body.role });
    return NextResponse.json(updated);
  }

  if (body.action === "suspend") {
    if (body.id === user!.id) {
      return NextResponse.json({ error: "Cannot suspend yourself" }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: body.id },
      data: { suspendedAt: new Date() },
    });
    await logAdminAction(user!.id, "user_suspended", "user", body.id);
    return NextResponse.json(updated);
  }

  if (body.action === "unsuspend") {
    const updated = await prisma.user.update({
      where: { id: body.id },
      data: { suspendedAt: null },
    });
    await logAdminAction(user!.id, "user_unsuspended", "user", body.id);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
