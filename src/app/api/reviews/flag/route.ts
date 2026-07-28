import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

/** Any signed-in user can flag a review for moderation */
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const review = await prisma.recipeReview.findUnique({ where: { id: body.id } });
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.recipeReview.update({
    where: { id: body.id },
    data: { flagged: true },
  });

  return NextResponse.json({ success: true });
}
