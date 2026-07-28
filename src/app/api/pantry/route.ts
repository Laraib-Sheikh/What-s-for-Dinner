import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addItemSchema = z.object({
  ingredientName: z.string().min(1),
  quantityNote: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.pantryItem.findMany({
    where: { userId: session.user.id },
    include: { ingredient: true },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ingredientName, quantityNote, expiresAt } = parsed.data;

  const ingredient = await prisma.ingredient.upsert({
    where: { name: ingredientName.toLowerCase().trim() },
    update: {},
    create: {
      name: ingredientName.toLowerCase().trim(),
      category: guessCategory(ingredientName),
    },
  });

  const item = await prisma.pantryItem.upsert({
    where: {
      userId_ingredientId: {
        userId: session.user.id,
        ingredientId: ingredient.id,
      },
    },
    update: {
      quantityNote: quantityNote || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    create: {
      userId: session.user.id,
      ingredientId: ingredient.id,
      quantityNote: quantityNote || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: { ingredient: true },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.pantryItem.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/milk|cheese|butter|cream|yogurt|egg/.test(n)) return "dairy";
  if (/chicken|beef|pork|fish|salmon|tuna|shrimp|lamb|turkey/.test(n)) return "protein";
  if (/apple|banana|orange|lemon|lime|berry|tomato|avocado|mango/.test(n)) return "produce";
  if (/carrot|potato|onion|garlic|pepper|celery|lettuce|spinach|broccoli|zucchini/.test(n)) return "produce";
  if (/flour|sugar|salt|pepper|cumin|paprika|cinnamon|oregano|basil|thyme|spice/.test(n)) return "spice";
  if (/rice|pasta|bread|noodle|oat|quinoa|barley/.test(n)) return "grains";
  if (/oil|vinegar|sauce|ketchup|mayo|mustard/.test(n)) return "condiments";
  if (/bean|lentil|chickpea|tofu/.test(n)) return "legumes";
  return "other";
}
