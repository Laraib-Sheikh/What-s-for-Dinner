import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ingredients: ["eggs", "milk", "butter"],
      note: "Demo mode — add ANTHROPIC_API_KEY to enable real photo scanning.",
    });
  }

  try {
    const { imageBase64, mediaType = "image/jpeg", mode = "pantry" } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }

    const prompt =
      mode === "leftover"
        ? `You are a food identification assistant. Look at this image of food containers or leftovers in a fridge.
Identify each distinct food item / leftover container visible.
For each item, provide:
1. A short name (e.g. "Thai red curry", "leftover rice", "roasted chicken")
2. Estimated servings visible (1-4)
3. Estimated days fresh (1-5)

Return ONLY a JSON array like:
[{"name": "...", "servings": 2, "shelfLifeDays": 3}]

Be practical. Only list clearly visible food items. Max 8 items.`
        : `You are a pantry inventory assistant. Look at this image of a fridge, pantry shelf, or kitchen counter.
Identify all food ingredients and grocery items you can see.
Return ONLY a JSON array of ingredient names like:
["eggs", "milk", "cheddar cheese", "spinach", "garlic", "butter"]

Rules:
- Use common, simple ingredient names (lowercase)
- Only list clearly visible items
- Max 20 items
- No brands, just ingredient names`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const raw = content.text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(mode === "leftover" ? { containers: parsed } : { ingredients: parsed });
  } catch (err) {
    console.error("Photo scan error:", err);
    return NextResponse.json({ error: "Failed to scan photo" }, { status: 500 });
  }
}
