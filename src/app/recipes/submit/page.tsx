"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function SubmitRecipePage() {
  const { data: session } = useSession();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    cuisine: "",
    mealType: "dinner",
    cookTimeMinutes: "30",
    servings: "4",
    dietaryTags: "",
    ingredients: "",
    instructions: "",
  });

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/recipes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cookTimeMinutes: Number(form.cookTimeMinutes),
          servings: Number(form.servings),
          dietaryTags: form.dietaryTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ingredients: form.ingredients
            .split("\n")
            .map((line) => {
              const [name, quantity] = line.split("|").map((s) => s.trim());
              return name ? { name, quantity } : null;
            })
            .filter(Boolean),
          instructions: form.instructions
            .split("\n")
            .map((text, i) => ({ step_number: i + 1, text: text.trim() }))
            .filter((s) => s.text),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => setDone(true),
  });

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Sign in to submit a recipe.</p>
        <Link href="/auth/signin"><Button>Sign in</Button></Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ✓
        </div>
        <h1 className="text-2xl font-bold mb-2">Submitted for review</h1>
        <p className="text-gray-500 mb-6">
          An admin will approve your recipe before it appears in the catalog.
        </p>
        <Link href="/"><Button>Back to recipes</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <Upload className="w-6 h-6 text-orange-500" />
        Submit a recipe
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Share a dish with the community — it goes through a quick admin review.
      </p>

      <div className="space-y-3 bg-white border border-gray-200 rounded-xl p-5">
        <input
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Title *"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Description"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="px-3 py-2 border rounded-lg text-sm"
            placeholder="Cuisine"
            value={form.cuisine}
            onChange={(e) => setForm({ ...form, cuisine: e.target.value })}
          />
          <select
            className="px-3 py-2 border rounded-lg text-sm"
            value={form.mealType}
            onChange={(e) => setForm({ ...form, mealType: e.target.value })}
          >
            {["breakfast", "lunch", "dinner", "snack"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            className="px-3 py-2 border rounded-lg text-sm"
            placeholder="Cook time (min)"
            value={form.cookTimeMinutes}
            onChange={(e) => setForm({ ...form, cookTimeMinutes: e.target.value })}
          />
          <input
            className="px-3 py-2 border rounded-lg text-sm"
            placeholder="Servings"
            value={form.servings}
            onChange={(e) => setForm({ ...form, servings: e.target.value })}
          />
        </div>
        <input
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Dietary tags (comma-separated)"
          value={form.dietaryTags}
          onChange={(e) => setForm({ ...form, dietaryTags: e.target.value })}
        />
        <textarea
          className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
          placeholder={"Ingredients (one per line)\ntomato|2 cups"}
          rows={5}
          value={form.ingredients}
          onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
        />
        <textarea
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Instructions (one step per line)"
          rows={5}
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
        />
        <Button
          className="w-full"
          disabled={!form.title.trim()}
          loading={submit.isPending}
          onClick={() => submit.mutate()}
        >
          Submit for approval
        </Button>
      </div>
    </div>
  );
}
