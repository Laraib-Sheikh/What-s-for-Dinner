import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const recipeId = req.nextUrl.searchParams.get("recipeId");
  if (!recipeId) {
    return NextResponse.json({ error: "recipeId required" }, { status: 400 });
  }

  const reviews = await prisma.recipeReview.findMany({
    where: { recipeId, flagged: false },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const avg =
    reviews.length === 0
      ? 0
      : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;

  return NextResponse.json({ reviews, averageRating: avg, count: reviews.length });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const rating = Number(body.rating);
  if (!body.recipeId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "recipeId and rating 1-5 required" }, { status: 400 });
  }

  const recipe = await prisma.recipe.findFirst({
    where: { id: body.recipeId, status: "approved" },
  });
  if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const review = await prisma.recipeReview.upsert({
    where: {
      userId_recipeId: { userId: user!.id, recipeId: body.recipeId },
    },
    update: {
      rating,
      comment: body.comment?.trim() || null,
      flagged: false,
    },
    create: {
      userId: user!.id,
      recipeId: body.recipeId,
      rating,
      comment: body.comment?.trim() || null,
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json(review, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const review = await prisma.recipeReview.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = review.userId === user!.id;
  const isStaff = user!.role === "admin" || user!.role === "moderator";
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.recipeReview.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
