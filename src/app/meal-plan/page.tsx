"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { formatCookTime } from "@/lib/utils";
import { useRouter } from "next/navigation";

const MEAL_SLOTS = ["breakfast", "lunch", "dinner"];

interface MealPlanEntry {
  id: string;
  plannedDate: string;
  mealSlot: string;
  recipe: {
    id: string;
    title: string;
    cookTimeMinutes: number;
    mealType: string;
    imageUrl?: string | null;
  };
}

export default function MealPlanPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [addingSlot, setAddingSlot] = useState<{ date: string; slot: string } | null>(null);
  const [recipeSearch, setRecipeSearch] = useState("");

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: entries = [] } = useQuery<MealPlanEntry[]>({
    queryKey: ["meal-plan", weekStart.toISOString()],
    queryFn: () =>
      fetch(`/api/meal-plan?weekStart=${weekStart.toISOString()}`).then((r) => r.json()),
    enabled: !!session,
  });

  const { data: recipes = [] } = useQuery<{ id: string; title: string; mealType: string; cookTimeMinutes: number }[]>({
    queryKey: ["recipes-list"],
    queryFn: () => fetch("/api/recipes").then((r) => r.json()),
    enabled: !!addingSlot,
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => fetch(`/api/meal-plan?id=${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plan"] }),
  });

  const addEntry = useMutation({
    mutationFn: async ({ recipeId, date, slot }: { recipeId: string; date: string; slot: string }) => {
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, plannedDate: date, mealSlot: slot }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan"] });
      setAddingSlot(null);
      setRecipeSearch("");
    },
  });

  const generateGrocery = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      return res.json();
    },
    onSuccess: () => router.push("/grocery"),
  });

  const getEntriesForSlot = (date: Date, slot: string) =>
    entries.filter(
      (e) => isSameDay(new Date(e.plannedDate), date) && e.mealSlot === slot
    );

  const filteredRecipes = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
      r.mealType.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  if (!session) {
    return (
      <div className="text-center py-20">
        <Calendar className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Sign in to plan your meals</h2>
        <Link href="/auth/signin">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-orange-500" />
            Meal Planner
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Week of {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Button
            onClick={() => generateGrocery.mutate()}
            loading={generateGrocery.isPending}
            variant="secondary"
            size="sm"
          >
            <ShoppingCart className="w-4 h-4" />
            Generate Grocery List
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 gap-2 mb-2">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide p-2" />
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`text-center p-2 rounded-lg ${
                  isSameDay(day, new Date()) ? "bg-orange-50" : ""
                }`}
              >
                <div className="text-xs font-medium text-gray-500 uppercase">
                  {format(day, "EEE")}
                </div>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    isSameDay(day, new Date()) ? "text-orange-600" : "text-gray-800"
                  }`}
                >
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>

          {/* Meal rows */}
          {MEAL_SLOTS.map((slot) => (
            <div key={slot} className="grid grid-cols-8 gap-2 mb-3">
              <div className="flex items-center">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide capitalize">
                  {slot}
                </span>
              </div>
              {weekDays.map((day) => {
                const slotEntries = getEntriesForSlot(day, slot);
                return (
                  <div
                    key={day.toISOString()}
                    className="min-h-[80px] bg-white rounded-xl border border-gray-200 p-2 space-y-1.5"
                  >
                    {slotEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="group relative bg-orange-50 border border-orange-200 rounded-lg p-2 cursor-pointer hover:bg-orange-100 transition-colors"
                        onClick={() => router.push(`/recipes/${entry.recipe.id}`)}
                      >
                        <p className="text-xs font-semibold text-orange-800 line-clamp-2 pr-4">
                          {entry.recipe.title}
                        </p>
                        <p className="text-xs text-orange-500 mt-0.5">
                          {formatCookTime(entry.recipe.cookTimeMinutes)}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEntry.mutate(entry.id);
                          }}
                          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        setAddingSlot({ date: day.toISOString(), slot })
                      }
                      className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 border border-dashed border-gray-200 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Add Recipe Modal */}
      {addingSlot && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setAddingSlot(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Recipe</h3>
              <p className="text-xs text-gray-500 mt-1 capitalize">
                {format(new Date(addingSlot.date), "EEEE, MMM d")} · {addingSlot.slot}
              </p>
            </div>
            <div className="p-4">
              <input
                type="text"
                placeholder="Search recipes..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
              />
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {filteredRecipes.slice(0, 20).map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() =>
                      addEntry.mutate({
                        recipeId: recipe.id,
                        date: addingSlot.date,
                        slot: addingSlot.slot,
                      })
                    }
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">{recipe.title}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">
                      {recipe.mealType} · {formatCookTime(recipe.cookTimeMinutes)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
