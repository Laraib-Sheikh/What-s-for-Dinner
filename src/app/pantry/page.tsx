"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Plus, X, ShoppingBasket, Sparkles, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { format } from "date-fns";

const QUICK_ADD_CHIPS = [
  "eggs", "milk", "butter", "onion", "garlic", "tomato", "potato", "rice",
  "pasta", "chicken", "cheese", "flour", "olive oil", "lemon", "spinach",
  "carrot", "broccoli", "pepper", "salt", "sugar",
];

const QUANTITY_OPTIONS = ["some", "a little", "a lot", "half", "full", "running low"];

interface PantryItem {
  id: string;
  quantityNote?: string | null;
  expiresAt?: string | null;
  addedAt: string;
  ingredient: { id: string; name: string; category: string };
}

const CATEGORY_COLORS: Record<string, string> = {
  dairy: "bg-blue-50 border-blue-200",
  protein: "bg-red-50 border-red-200",
  produce: "bg-green-50 border-green-200",
  spice: "bg-yellow-50 border-yellow-200",
  grains: "bg-amber-50 border-amber-200",
  condiments: "bg-purple-50 border-purple-200",
  legumes: "bg-lime-50 border-lime-200",
  other: "bg-gray-50 border-gray-200",
};

export default function PantryPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState("");
  const [quantityNote, setQuantityNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [showExpiry, setShowExpiry] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: pantryItems = [], isLoading } = useQuery<PantryItem[]>({
    queryKey: ["pantry"],
    queryFn: () => fetch("/api/pantry").then((r) => r.json()),
    enabled: !!session,
  });

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientName: name,
          quantityNote: quantityNote || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setInputValue("");
      setQuantityNote("");
      setExpiresAt("");
      setShowExpiry(false);
      setSuggestions([]);
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/pantry?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (value.length > 1) {
      const filtered = QUICK_ADD_CHIPS.filter(
        (chip) =>
          chip.toLowerCase().includes(value.toLowerCase()) &&
          !pantryItems.some((p) => p.ingredient.name === chip.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const handleAdd = (name: string) => {
    if (!name.trim()) return;
    if (!session) return;
    addItem.mutate(name.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      handleAdd(inputValue);
    }
  };

  const grouped = pantryItems.reduce((acc, item) => {
    const cat = item.ingredient.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, PantryItem[]>);

  const isExpiringSoon = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  };

  const isExpired = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  };

  if (!session) {
    return (
      <div className="text-center py-20">
        <ShoppingBasket className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Sign in to manage your pantry</h2>
        <p className="text-gray-400 mb-6">Track what&apos;s in your fridge and get personalized recipe matches</p>
        <Link href="/auth/signin">
          <Button>Sign in to get started</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBasket className="w-6 h-6 text-orange-500" />
            My Pantry
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{pantryItems.length} ingredients tracked</p>
        </div>
        <Link href="/">
          <Button variant="secondary" size="sm">
            <Sparkles className="w-3.5 h-3.5" />
            Find Recipes
          </Button>
        </Link>
      </div>

      {/* Add Item */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Ingredients</h2>

        <div className="relative">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type an ingredient and press Enter..."
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <Button
              onClick={() => handleAdd(inputValue)}
              disabled={!inputValue.trim() || addItem.isPending}
              loading={addItem.isPending}
              size="md"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleAdd(s)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors capitalize"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-3 flex-wrap items-center">
          <select
            value={quantityNote}
            onChange={(e) => setQuantityNote(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="">No quantity note</option>
            {QUANTITY_OPTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>

          <button
            onClick={() => setShowExpiry(!showExpiry)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-600 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            {showExpiry ? "Hide expiry" : "Add expiry date"}
          </button>

          {showExpiry && (
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          )}
        </div>

        {/* Quick add chips */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Quick add:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ADD_CHIPS.filter(
              (chip) => !pantryItems.some((p) => p.ingredient.name === chip)
            )
              .slice(0, 12)
              .map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleAdd(chip)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-orange-100 hover:text-orange-700 transition-colors capitalize"
                >
                  + {chip}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Pantry Items */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pantryItems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingBasket className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Your pantry is empty. Add some ingredients above!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className={`rounded-xl border p-4 ${CATEGORY_COLORS[category] || CATEGORY_COLORS.other}`}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">
                {category} ({items.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full text-sm font-medium border ${
                      isExpired(item.expiresAt)
                        ? "bg-red-100 border-red-300 text-red-700"
                        : isExpiringSoon(item.expiresAt)
                        ? "bg-yellow-100 border-yellow-300 text-yellow-700"
                        : "bg-white border-gray-200 text-gray-800"
                    }`}
                  >
                    <span className="capitalize">{item.ingredient.name}</span>
                    {item.quantityNote && (
                      <span className="text-xs opacity-60">· {item.quantityNote}</span>
                    )}
                    {item.expiresAt && (
                      <span className="text-xs opacity-60">
                        · {isExpired(item.expiresAt) ? "expired" : `exp ${format(new Date(item.expiresAt), "MMM d")}`}
                      </span>
                    )}
                    <button
                      onClick={() => removeItem.mutate(item.id)}
                      className="p-0.5 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
