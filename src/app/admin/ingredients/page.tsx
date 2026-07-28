"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Merge } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface IngredientRow {
  id: string;
  name: string;
  category: string;
  _count: { recipeIngredients: number; pantryItems: number };
}

const CATEGORIES = [
  "produce", "dairy", "protein", "grains", "legumes", "spice", "condiments", "household", "other",
];

export default function AdminIngredientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [mergeKeep, setMergeKeep] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");

  const { data: ingredients = [], isLoading } = useQuery<IngredientRow[]>({
    queryKey: ["admin-ingredients", search],
    queryFn: () => {
      const p = search ? `?search=${encodeURIComponent(search)}` : "";
      return fetch(`/api/admin/ingredients${p}`).then((r) => r.json());
    },
  });

  const mutate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/admin/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ingredients"] });
      setName("");
      setMergeKeep("");
      setMergeFrom("");
    },
  });

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-sm">Add ingredient</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="tomato"
            className="flex-1 min-w-[140px] px-3 py-2 border rounded-lg text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm capitalize"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => mutate.mutate({ action: "create", name, category })}
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Merge className="w-4 h-4" />
          Merge duplicates
        </h2>
        <p className="text-xs text-gray-400">
          Keep one ingredient and merge another into it (e.g. tomatoes → tomato).
        </p>
        <div className="flex gap-2 flex-wrap">
          <select
            value={mergeKeep}
            onChange={(e) => setMergeKeep(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Keep…</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <select
            value={mergeFrom}
            onChange={(e) => setMergeFrom(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Merge away…</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!mergeKeep || !mergeFrom || mergeKeep === mergeFrom}
            onClick={() =>
              mutate.mutate({ action: "merge", keepId: mergeKeep, mergeId: mergeFrom })
            }
          >
            Merge
          </Button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ingredients…"
        className="w-full px-3 py-2 border rounded-lg text-sm"
      />

      {isLoading ? (
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y max-h-[480px] overflow-y-auto">
          {ingredients.map((i) => (
            <div key={i.id} className="p-3 flex items-center justify-between gap-2">
              <div>
                <span className="text-sm font-medium capitalize">{i.name}</span>
                <span className="text-xs text-gray-400 ml-2 capitalize">{i.category}</span>
                <p className="text-xs text-gray-400">
                  {i._count.recipeIngredients} recipes · {i._count.pantryItems} pantries
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={i.category}
                  onChange={(e) =>
                    mutate.mutate({
                      action: "update",
                      id: i.id,
                      name: i.name,
                      category: e.target.value,
                    })
                  }
                  className="text-xs border rounded-lg px-2 py-1"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${i.name}?`))
                      mutate.mutate({ action: "delete", id: i.id });
                  }}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
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
