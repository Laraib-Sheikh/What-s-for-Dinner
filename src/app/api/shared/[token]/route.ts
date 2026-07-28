import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public shared shopping list — collaborative check-off via share token */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const list = await prisma.shoppingList.findUnique({
    where: { shareToken: token },
    include: {
      items: {
        include: { ingredient: true },
        orderBy: [{ category: "asc" }, { customItemName: "asc" }],
      },
      user: { select: { name: true } },
    },
  });

  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  return NextResponse.json({
    id: list.id,
    name: list.name,
    ownerName: list.user.name,
    shareToken: list.shareToken,
    updatedAt: list.updatedAt,
    items: list.items.map((item) => ({
      ...item,
      displayName: item.customItemName || item.ingredient?.name || "Item",
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();

  const list = await prisma.shoppingList.findUnique({
    where: { shareToken: token },
  });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  if (body.action === "toggle") {
    const item = await prisma.shoppingListItem.findFirst({
      where: { id: body.id, shoppingListId: list.id },
    });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const updated = await prisma.shoppingListItem.update({
      where: { id: item.id },
      data: { isChecked: !item.isChecked },
      include: { ingredient: true },
    });

    await prisma.shoppingList.update({
      where: { id: list.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      ...updated,
      displayName: updated.customItemName || updated.ingredient?.name || "Item",
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
