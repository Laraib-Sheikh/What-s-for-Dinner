"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface AdminRecipe {
  id: string;
  title: string;
  status: string;
  cuisine?: string | null;
  mealType: string;
  cookTimeMinutes: number;
  submitter?: { name: string | null; email: string | null } | null;
  _count: { recipeIngredients: number; reviews: number; favorites: number };
}

export default function AdminRecipesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    cuisine: "",
    mealType: "dinner",
    cookTimeMinutes: "30",
    servings: "4",
    ingredients: "",
    instructions: "",
    dietaryTags: "",
  });

  const { data: recipes = [], isLoading } = useQuery<AdminRecipe[]>({
    queryKey: ["admin-recipes", status, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      if (search) p.set("search", search);
      return fetch(`/api/admin/recipes?${p}`).then((r) => r.json());
    },
  });

  const mutate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/admin/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-recipes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      setShowForm(false);
      setCsvText("");
    },
  });

  const createRecipe = () => {
    mutate.mutate({
      action: "create",
      title: form.title,
      description: form.description,
      cuisine: form.cuisine || null,
      mealType: form.mealType,
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
    });
  };

  const importCsv = () => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] || "";
      });
      return {
        title: row.title,
        description: row.description,
        cuisine: row.cuisine,
        mealType: row.mealType,
        cookTimeMinutes: Number(row.cookTimeMinutes) || 30,
        servings: Number(row.servings) || 4,
        dietaryTags: row.dietaryTags,
        ingredients: row.ingredients,
        instructions: row.instructions,
      };
    });
    mutate.mutate({ action: "bulk-import", rows });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {["", "approved", "pending", "rejected"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-lg text-sm border ${
                status === s
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white border-gray-200 text-gray-600"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" />
          Add recipe
        </Button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">New recipe</h2>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Title"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              placeholder="Minutes"
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
            placeholder={"Ingredients (one per line: name|quantity)\ne.g. tomato|2 cups"}
            rows={4}
            value={form.ingredients}
            onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
          />
          <textarea
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Instructions (one step per line)"
            rows={4}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={createRecipe} loading={mutate.isPending} disabled={!form.title}>
              Save recipe
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Bulk CSV import
            </h3>
            <p className="text-xs text-gray-400 mb-2">
              Header: title,description,cuisine,mealType,cookTimeMinutes,servings,dietaryTags,ingredients,instructions
              — use | to separate tags/ingredients/steps
            </p>
            <textarea
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="title,description,cuisine,..."
            />
            <Button size="sm" className="mt-2" onClick={importCsv} disabled={!csvText.trim()}>
              Import CSV
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {recipes.map((r) => (
            <div key={r.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/recipes/${r.id}`} className="font-medium hover:text-orange-600">
                  {r.title}
                </Link>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">
                  {r.status} · {r.mealType} · {r.cookTimeMinutes}m ·{" "}
                  {r._count.recipeIngredients} ingredients
                  {r.submitter && ` · by ${r.submitter.name || r.submitter.email}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => mutate.mutate({ action: "approve", id: r.id })}
                      className="p-2 rounded-lg hover:bg-green-50 text-green-600"
                      title="Approve"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => mutate.mutate({ action: "reject", id: r.id })}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    if (confirm("Delete recipe?")) mutate.mutate({ action: "delete", id: r.id });
                  }}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
