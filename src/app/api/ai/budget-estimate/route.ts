import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { items, budget } = await req.json();

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  const itemList = items.map((i: { displayName: string; quantity?: string }) =>
    `- ${i.quantity ? `${i.quantity}x ` : ""}${i.displayName}`
  ).join("\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    const mockItems = items.map((i: { displayName: string; quantity?: string }) => ({
      name: i.displayName,
      estimatedCost: (Math.random() * 4 + 0.5).toFixed(2),
      cheaperAlternative: null,
    }));
    const total = mockItems.reduce((s: number, i: { estimatedCost: string }) => s + parseFloat(i.estimatedCost), 0);
    return NextResponse.json({
      items: mockItems,
      totalEstimate: total.toFixed(2),
      currency: "USD",
      overBudget: budget ? total > budget : false,
      budgetTip: "Add ANTHROPIC_API_KEY for real AI budget estimates.",
    });
  }

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Estimate grocery costs for these shopping list items (average US supermarket prices, 2024):

${itemList}
${budget ? `\nUser's budget: $${budget}` : ""}

For each item, estimate the typical retail price. Suggest a cheaper alternative only if it saves >30%.

Return ONLY JSON:
{
  "items": [
    {"name": "item", "estimatedCost": "2.49", "cheaperAlternative": "store brand eggs $1.89" or null}
  ],
  "totalEstimate": "24.50",
  "currency": "USD",
  "overBudget": false,
  "budgetTip": "brief tip if over budget, else null"
}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const raw = content.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const result = JSON.parse(jsonMatch[0]);
    if (budget) {
      result.overBudget = parseFloat(result.totalEstimate) > budget;
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("Budget estimate error:", err);
    return NextResponse.json({ error: "Failed to estimate budget" }, { status: 500 });
  }
}
