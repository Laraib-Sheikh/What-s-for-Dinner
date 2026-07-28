import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.cookLog.findMany({
    where: { userId: session.user.id },
    include: { recipe: true },
    orderBy: { cookedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipeId, rating } = await req.json();

  const log = await prisma.cookLog.create({
    data: {
      userId: session.user.id,
      recipeId,
      rating: rating || null,
    },
    include: { recipe: true },
  });

  return NextResponse.json(log, { status: 201 });
}
