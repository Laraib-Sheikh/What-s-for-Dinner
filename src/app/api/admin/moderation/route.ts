import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/rbac";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [pendingRecipes, flaggedReviews] = await Promise.all([
    prisma.recipe.findMany({
      where: { status: "pending" },
      include: {
        submitter: { select: { id: true, name: true, email: true } },
        recipeIngredients: { include: { ingredient: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.recipeReview.findMany({
      where: { flagged: true },
      include: {
        user: { select: { name: true, email: true } },
        recipe: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ pendingRecipes, flaggedReviews });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();

  if (body.action === "flag-review") {
    await prisma.recipeReview.update({
      where: { id: body.id },
      data: { flagged: true },
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "clear-flag") {
    await prisma.recipeReview.update({
      where: { id: body.id },
      data: { flagged: false },
    });
    await logAdminAction(user!.id, "review_flag_cleared", "review", body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete-review") {
    await prisma.recipeReview.delete({ where: { id: body.id } });
    await logAdminAction(user!.id, "review_deleted", "review", body.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
