"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Search, ChefHat, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { RecipeCard } from "@/components/RecipeCard";
import { TonightPick } from "@/components/TonightPick";
import { ExpiryAlerts } from "@/components/ExpiryAlerts";
import Link from "next/link";

const CUISINES = ["italian", "asian", "mexican", "indian", "american", "mediterranean", "french"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const DIETARY_TAGS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "paleo"];
const MAX_TIMES = [
  { label: "≤15 min", value: "15" },
  { label: "≤30 min", value: "30" },
  { label: "≤45 min", value: "45" },
  { label: "≤1 hr", value: "60" },
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

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`filter-chip px-3 py-1.5 rounded-full text-xs font-medium border ${
        active
          ? "bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/30"
          : "bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-700"
      }`}
    >
      {children}
    </button>
  );
}

export default function HomePage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [cuisine, setCuisine] = useState("");
  const [mealType, setMealType] = useState("");
  const [dietaryTag, setDietaryTag] = useState("");
  const [maxTime, setMaxTime] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "almost" | "ready">("all");

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (cuisine) params.set("cuisine", cuisine);
  if (mealType) params.set("mealType", mealType);
  if (dietaryTag) params.set("dietaryTag", dietaryTag);
  if (maxTime) params.set("maxTime", maxTime);

  const { data: recipes = [], isLoading, isError } = useQuery<RecipeWithMatch[]>({
    queryKey: ["recipes", debouncedSearch, cuisine, mealType, dietaryTag, maxTime],
    queryFn: async () => {
      const res = await fetch(`/api/recipes?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Failed to load recipes");
      return Array.isArray(data) ? data : [];
    },
  });

  const almostRecipes = recipes.filter((r) => r.missingCount === 1 || r.missingCount === 2);
  const readyRecipes = recipes.filter((r) => r.matchScore >= 80);
  const activeFilterCount = [cuisine, mealType, dietaryTag, maxTime].filter(Boolean).length;

  const displayed =
    activeTab === "almost"
      ? almostRecipes
      : activeTab === "ready"
      ? readyRecipes
      : recipes;

  const clearFilters = () => {
    setCuisine("");
    setMealType("");
    setDietaryTag("");
    setMaxTime("");
  };

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

      {/* Logged-in welcome + surprise pick */}
      {session && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Hey{session.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {readyRecipes.length > 0
                ? `${readyRecipes.length} recipes ready with what you have`
                : "Add pantry items to unlock better matches"}
            </p>
          </div>
          {recipes.length > 0 && <TonightPick recipes={recipes} />}
        </div>
      )}

      <ExpiryAlerts />

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
              className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-orange-50 border-orange-300 text-orange-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick meal-type chips always visible */}
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((m) => (
            <Chip
              key={m}
              active={mealType === m}
              onClick={() => setMealType(mealType === m ? "" : m)}
            >
              <span className="capitalize">{m}</span>
            </Chip>
          ))}
        </div>

        {showFilters && (
          <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-4 animate-slide-down">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Cuisine</label>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-orange-600 hover:underline">
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((c) => (
                  <Chip key={c} active={cuisine === c} onClick={() => setCuisine(cuisine === c ? "" : c)}>
                    <span className="capitalize">{c}</span>
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Diet</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((d) => (
                  <Chip
                    key={d}
                    active={dietaryTag === d}
                    onClick={() => setDietaryTag(dietaryTag === d ? "" : d)}
                  >
                    <span className="capitalize">{d}</span>
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Cook time</label>
              <div className="flex flex-wrap gap-2">
                {MAX_TIMES.map((t) => (
                  <Chip
                    key={t.value}
                    active={maxTime === t.value}
                    onClick={() => setMaxTime(maxTime === t.value ? "" : t.value)}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {session && recipes.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {(
            [
              { id: "all" as const, label: `All (${recipes.length})`, color: "orange" },
              { id: "ready" as const, label: `Ready (${readyRecipes.length})`, color: "green" },
              { id: "almost" as const, label: `Almost (${almostRecipes.length})`, color: "blue" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? tab.color === "green"
                    ? "bg-green-500 text-white shadow-sm"
                    : tab.color === "blue"
                    ? "bg-blue-500 text-white shadow-sm"
                    : "bg-orange-500 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.id === "almost" && <Sparkles className="w-3.5 h-3.5" />}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats bar for logged-in users */}
      {session && recipes.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setActiveTab("ready")}
            className={`bg-green-50 border rounded-xl p-3 text-center transition-all hover:scale-[1.02] ${
              activeTab === "ready" ? "border-green-400 ring-2 ring-green-200" : "border-green-200"
            }`}
          >
            <div className="text-2xl font-bold text-green-700">{readyRecipes.length}</div>
            <div className="text-xs text-green-600">Ready to Cook</div>
          </button>
          <button
            onClick={() => setActiveTab("almost")}
            className={`bg-blue-50 border rounded-xl p-3 text-center transition-all hover:scale-[1.02] ${
              activeTab === "almost" ? "border-blue-400 ring-2 ring-blue-200" : "border-blue-200"
            }`}
          >
            <div className="text-2xl font-bold text-blue-700">{almostRecipes.length}</div>
            <div className="text-xs text-blue-600">Almost There</div>
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`bg-orange-50 border rounded-xl p-3 text-center transition-all hover:scale-[1.02] ${
              activeTab === "all" ? "border-orange-400 ring-2 ring-orange-200" : "border-orange-200"
            }`}
          >
            <div className="text-2xl font-bold text-orange-700">{recipes.length}</div>
            <div className="text-xs text-orange-600">Total Recipes</div>
          </button>
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
      ) : isError ? (
        <div className="text-center py-16">
          <ChefHat className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">Couldn&apos;t load recipes</h3>
          <p className="text-sm text-gray-400 mt-1">
            Check that DATABASE_URL is set in your Vercel environment variables, then redeploy.
          </p>
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
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="mt-4 text-sm text-orange-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayed.map((recipe, i) => (
            <div
              key={recipe.id}
              className="animate-card-in"
              style={{ animationDelay: `${Math.min(i, 11) * 40}ms` }}
            >
              <RecipeCard recipe={recipe} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
