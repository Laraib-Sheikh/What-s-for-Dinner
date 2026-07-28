"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import { Leaf, Clock, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { formatCookTime } from "@/lib/utils";

interface LeftoverRecipe {
  id: string;
  title: string;
  imageUrl?: string | null;
  cookTimeMinutes: number;
  servings: number;
  matchScore: number;
  using: string[];
  missing: string[];
}

export default function LeftoversPage() {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [results, setResults] = useState<LeftoverRecipe[]>([]);

  const search = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/leftovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          names: chips.length ? chips : undefined,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => setResults(data.recipes || []),
  });

  const addChip = () => {
    const name = input.trim().toLowerCase();
    if (!name || chips.includes(name)) return;
    setChips([...chips, name]);
    setInput("");
  };

  if (!session) {
    return (
      <div className="text-center py-20">
        <Leaf className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Sign in for leftover mode</h2>
        <Link href="/auth/signin"><Button>Sign in</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Leaf className="w-6 h-6 text-green-600" />
          Leftover mode
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Tell us what you have left — we&apos;ll suggest single-serving-friendly meals that use them.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addChip()}
            placeholder="e.g. spinach, rice, egg…"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <Button size="sm" variant="secondary" onClick={addChip}>
            Add
          </Button>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-800 text-sm capitalize"
              >
                {c}
                <button onClick={() => setChips(chips.filter((x) => x !== c))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <Button onClick={() => search.mutate()} loading={search.isPending}>
            Find meals
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setChips([]);
              search.mutate();
            }}
            loading={search.isPending}
          >
            Use whole pantry
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {results.map((r) => (
          <Link
            key={r.id}
            href={`/recipes/${r.id}`}
            className="flex gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-300 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">{r.title}</h3>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {formatCookTime(r.cookTimeMinutes)} · {r.servings} servings · {r.matchScore}% match
              </p>
              <p className="text-xs text-green-700 mt-2 capitalize">
                Using: {r.using.join(", ")}
              </p>
              {r.missing.length > 0 && (
                <p className="text-xs text-amber-600 mt-0.5 capitalize">
                  Need: {r.missing.join(", ")}
                </p>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
          </Link>
        ))}
        {search.isSuccess && results.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">
            No close matches — try adding more leftover ingredients.
          </p>
        )}
      </div>
    </div>
  );
}
