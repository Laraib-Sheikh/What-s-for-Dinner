"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ShoppingCart, Plus, Trash2, CheckSquare, Square, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface GroceryItem {
  id: string;
  quantity?: string | null;
  isChecked: boolean;
  source: string;
  ingredient: { id: string; name: string; category: string };
}

const CATEGORY_ICONS: Record<string, string> = {
  produce: "🥦",
  dairy: "🧀",
  protein: "🥩",
  spice: "🌿",
  grains: "🌾",
  condiments: "🫙",
  legumes: "🫘",
  other: "🛒",
};

export default function GroceryPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState("");
  const [newQuantity, setNewQuantity] = useState("");

  const { data: items = [], isLoading } = useQuery<GroceryItem[]>({
    queryKey: ["grocery"],
    queryFn: () => fetch("/api/grocery").then((r) => r.json()),
    enabled: !!session,
  });

  const mutate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grocery"] }),
  });

  const grouped = items.reduce((acc, item) => {
    const cat = item.ingredient.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  const checkedCount = items.filter((i) => i.isChecked).length;
  const totalCount = items.length;

  const addItem = () => {
    if (!newItem.trim()) return;
    mutate.mutate({ action: "add", ingredientName: newItem.trim(), quantity: newQuantity || undefined });
    setNewItem("");
    setNewQuantity("");
  };

  if (!session) {
    return (
      <div className="text-center py-20">
        <ShoppingCart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Sign in to manage your grocery list</h2>
        <Link href="/auth/signin"><Button>Sign in</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-orange-500" />
            Grocery List
          </h1>
          {totalCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {checkedCount}/{totalCount} items checked off
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => mutate.mutate({ action: "generate" })}
            loading={mutate.isPending}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            From Meal Plan
          </Button>
          {checkedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mutate.mutate({ action: "clear-checked" })}
              className="text-red-500 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Checked
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Shopping progress</span>
            <span>{Math.round((checkedCount / totalCount) * 100)}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
          {checkedCount === totalCount && totalCount > 0 && (
            <p className="text-green-600 text-sm font-medium mt-2 text-center">
              ✓ All done! Happy cooking!
            </p>
          )}
        </div>
      )}

      {/* Add Item */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add ingredient..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <input
            type="text"
            placeholder="Amount"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <Button onClick={addItem} size="sm" disabled={!newItem.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Your grocery list is empty.</p>
          <p className="text-sm mt-1">
            <Link href="/meal-plan" className="text-orange-500 hover:underline">
              Generate from your meal plan
            </Link>{" "}
            or add items above.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2 capitalize">
                <span>{CATEGORY_ICONS[category] || "🛒"}</span>
                {category}
                <span className="text-gray-400 font-normal">({categoryItems.length})</span>
              </h3>
              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      item.isChecked
                        ? "bg-gray-50 border-gray-100 opacity-60"
                        : "bg-white border-gray-200 hover:border-orange-200"
                    }`}
                  >
                    <button
                      onClick={() => mutate.mutate({ action: "toggle", id: item.id, isChecked: item.isChecked })}
                      className="shrink-0 text-gray-400 hover:text-orange-500 transition-colors"
                    >
                      {item.isChecked ? (
                        <CheckSquare className="w-5 h-5 text-green-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm font-medium capitalize ${
                          item.isChecked ? "line-through text-gray-400" : "text-gray-800"
                        }`}
                      >
                        {item.ingredient.name}
                      </span>
                      {item.quantity && (
                        <span className="text-xs text-gray-400 ml-2">{item.quantity}</span>
                      )}
                    </div>

                    {item.source === "meal_plan" && (
                      <span className="text-xs text-blue-400 bg-blue-50 px-2 py-0.5 rounded-full">
                        meal plan
                      </span>
                    )}

                    <button
                      onClick={() => mutate.mutate({ action: "delete", id: item.id })}
                      className="shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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
