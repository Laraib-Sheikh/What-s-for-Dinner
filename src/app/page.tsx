"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Search, Filter, ChefHat, Sparkles, SlidersHorizontal } from "lucide-react";
import { RecipeCard } from "@/components/RecipeCard";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

const CUISINES = ["", "italian", "asian", "mexican", "indian", "american", "mediterranean", "french"];
const MEAL_TYPES = ["", "breakfast", "lunch", "dinner", "snack"];
const DIETARY_TAGS = ["", "vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "paleo"];
const MAX_TIMES = [
  { label: "Any time", value: "" },
  { label: "Under 15 min", value: "15" },
  { label: "Under 30 min", value: "30" },
  { label: "Under 45 min", value: "45" },
  { label: "Under 1 hour", value: "60" },
];

interface RecipeWithMatch {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  cuisine?: string | null;
  mealType: string;
  cookTimeMinutes: number;
  servings: number;
  dietaryTags: string[];
  matchScore: number;
  missingCount: number;
  missingIngredients: string[];
  isFavorite: boolean;
}

export default function HomePage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [mealType, setMealType] = useState("");
  const [dietaryTag, setDietaryTag] = useState("");
  const [maxTime, setMaxTime] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "almost">("all");

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (cuisine) params.set("cuisine", cuisine);
  if (mealType) params.set("mealType", mealType);
  if (dietaryTag) params.set("dietaryTag", dietaryTag);
  if (maxTime) params.set("maxTime", maxTime);

  const { data: recipes = [], isLoading } = useQuery<RecipeWithMatch[]>({
    queryKey: ["recipes", search, cuisine, mealType, dietaryTag, maxTime],
    queryFn: () => fetch(`/api/recipes?${params}`).then((r) => r.json()),
  });

  const almostRecipes = recipes.filter((r) => r.missingCount === 1 || r.missingCount === 2);
  const displayed = activeTab === "almost" ? almostRecipes : recipes;

  return (
    <div>
      {/* Hero */}
      {!session && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white p-8 mb-8">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-8 h-8" />
              <Sparkles className="w-5 h-5 opacity-80" />
            </div>
            <h1 className="text-3xl font-bold mb-2">What&apos;s for Dinner?</h1>
            <p className="text-orange-100 text-lg mb-6 max-w-xl">
              Turn what&apos;s already in your fridge into delicious meals. Add your pantry ingredients and get instant recipe matches.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/auth/signin"
                className="px-6 py-3 bg-white text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                href="/pantry"
                className="px-6 py-3 bg-orange-600/30 text-white font-semibold rounded-xl hover:bg-orange-600/40 transition-colors"
              >
                Browse Recipes
              </Link>
            </div>
          </div>
          <div className="absolute -right-8 -top-8 w-64 h-64 bg-orange-400/30 rounded-full blur-3xl" />
          <div className="absolute -right-4 -bottom-12 w-48 h-48 bg-amber-400/30 rounded-full blur-2xl" />
        </div>
      )}

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              showFilters || cuisine || mealType || dietaryTag || maxTime
                ? "bg-orange-50 border-orange-300 text-orange-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {(cuisine || mealType || dietaryTag || maxTime) && (
              <span className="bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {[cuisine, mealType, dietaryTag, maxTime].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-white rounded-xl border border-gray-200">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Cuisine</label>
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white capitalize"
              >
                {CUISINES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c || "All cuisines"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Meal Type</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white capitalize"
              >
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m || "All meals"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Diet</label>
              <select
                value={dietaryTag}
                onChange={(e) => setDietaryTag(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white capitalize"
              >
                {DIETARY_TAGS.map((d) => (
                  <option key={d} value={d} className="capitalize">
                    {d || "All diets"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Cook Time</label>
              <select
                value={maxTime}
                onChange={(e) => setMaxTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                {MAX_TIMES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {session && almostRecipes.length > 0 && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "bg-orange-500 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            All Recipes ({recipes.length})
          </button>
          <button
            onClick={() => setActiveTab("almost")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === "almost"
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Almost There ({almostRecipes.length})
          </button>
        </div>
      )}

      {/* Stats bar for logged-in users */}
      {session && recipes.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">
              {recipes.filter((r) => r.matchScore >= 80).length}
            </div>
            <div className="text-xs text-green-600">Ready to Cook</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{almostRecipes.length}</div>
            <div className="text-xs text-blue-600">Almost There</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-orange-700">{recipes.length}</div>
            <div className="text-xs text-orange-600">Total Recipes</div>
          </div>
        </div>
      )}

      {/* Recipe Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="h-44 bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16">
          <ChefHat className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">No recipes found</h3>
          <p className="text-sm text-gray-400 mt-1">
            {search || cuisine || mealType || dietaryTag || maxTime
              ? "Try adjusting your filters"
              : "Recipes will appear here once you add them"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayed.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
