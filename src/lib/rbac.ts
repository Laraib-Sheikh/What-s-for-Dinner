import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export type AppRole = "user" | "admin" | "moderator";

export async function getSessionUser() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        suspendedAt: true,
        image: true,
      },
    });

    if (!user || user.suspendedAt) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, error: null };
}

export async function requireAdmin() {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };

  if (user!.role !== "admin" && user!.role !== "moderator") {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user: user!, error: null };
}

export async function requireFullAdmin() {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };

  if (user!.role !== "admin") {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user: user!, error: null };
}

export async function logAdminAction(
  adminId: string,
  actionType: string,
  targetType?: string,
  targetId?: string,
  meta?: Record<string, unknown>
) {
  await prisma.adminAction.create({
    data: {
      adminId,
      actionType,
      targetType,
      targetId,
      meta: meta ? (meta as Prisma.InputJsonValue) : undefined,
    },
  });
}

export function isAdminRole(role?: string | null) {
  return role === "admin" || role === "moderator";
}

export const STORE_CATEGORIES = [
  "produce",
  "dairy",
  "protein",
  "grains",
  "legumes",
  "spice",
  "condiments",
  "household",
  "other",
] as const;

export function categorizeCustomItem(name: string): string {
  const n = name.toLowerCase();
  if (/soap|towel|foil|bag|cleaner|detergent|sponge|paper/.test(n)) return "household";
  return "other";
}
