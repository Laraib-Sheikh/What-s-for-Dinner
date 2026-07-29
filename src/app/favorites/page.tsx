"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { formatCookTime } from "@/lib/utils";

interface FavoriteRecipe {
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
  isFavorite: boolean;
  savedAt: string;
  averageRating?: number | null;
  reviewCount: number;
  cookCount: number;
}

type FilterKey = "all" | "quick" | "vegetarian" | "family";
type SortKey = "recent" | "cooked" | "alpha";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Saved" },
  { key: "quick", label: "Quick Meals" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "family", label: "Family Favorites" },
];

const PLACEHOLDER_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBgKxVckkuZ4mxCIiWk6jIhZLHSjnIIRLMgMC7EtrgCsjIeneG5AOwWNxsXP5iRHbSoJUIpmVzfUWWQz1glOM0I0E0crC0kw2v49in6n-YpyUQmJGdLiySLfUN9sc2OAUoqzpYIjThi697Nq0Rito37uwVKPKNWzNdmENz1fjGGBr70TUMSvAxMKLqvzYrvovMiB2vvWPcZXG13xVXsFlbK40_1t9JEHhCcUlq9CsjNv7HuOy0zhdOmlbucFXaQnRYQ0-YPmRCL_mk",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAa_DCuDAa-gWc8LvxfABqdP96U9kbGc3lACqFBsQ6w25TPckTdHfWi0lDiLBOEOBtSgB--NdDihHSr70fhhFZFatzaG9929f0_U4XwrEKWB8l0AfyVBdFZ1yXKuq293PferlR1vQ95Ylir-JdHIsvPwqGEbQCpkDMbKyT3J_K11UbKQJqCgX38B5-gsC280WL3yrGOspGAkdJdabIUjVF1fuXDBiM9e8RYnPWoRQwU6jsDgPQq29uZLfOOzKAp1tFJxnp4-C43-1w",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDyDelat0GoKqNnBP0_CTuTjJq4Pj7ooaA-OlTKnlSFmTTzIzBtMTYalophXxr4tZ0TNPBxhU0JojzNekR2WbhXf-1nekH-qv6aky77NeRwRiNUyujZCqNQq2WhE1hUm6wov2DE7Z2yJU1CI16eXc-_j309miFSYCHV-XIIbQn89rE1naquhsfg5OVyVBU1XMi7vAU4YQ8L7WJFaIN1duOp2s3VRhcfyhuGLlNGegRgBc7coJdkTjhT1KdTeUXz54RCeEnvdErHDtc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ30im99PVcDBWW5cC95OaPfhCkFxVxrH6qZVWxokDnIgcieWTBxUDeIzHCXf1gBg8_GKP_0cDiDjO_3ygAWjE9qSXFV7cxD7g6mMr6GeqwaEKuOZFhNZ55wpuPonnXBiIsb0_VtG3NUSs-lesSIAV1ElgB9uMcyZ5AjEuwvHcfmEmc9lx3BBfQtbKpGLTsIDdCghsxmju9EMvFJiA_O3DpEP4BcCIrrF4KoeYaGy424CtQhjxW3fx943_YJ3986cDucDrc4zAOns",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDxjWY1CqaJd8FYhaJscGxtzGZnS1iQNfSRlYWMT2tDSNfiJjp-7-e1Cvn_YtNwa5XJUb8quJ82HabBoHbDTZ7Z7mZzuWW2LiPhTrE9hOqE4gLXZGI6fKoBCRZDqKAYsf1x7R5fNCwkIqCJruZSanViIKOSFDnYodDdwiCSDe7_ucsF8o06b1LWDj59XNeC5PzbGA7oZIVWtkWj0Br0bMJzNgxMfs9JxYRVzBjpd71r0yGyXEp13Ij1BLqDQKPOoNLwlCYhtKWeXMI",
];

function isVegetarian(tags: string[]) {
  const lower = tags.map((t) => t.toLowerCase());
  return lower.some((t) => t.includes("vegetarian") || t.includes("vegan"));
}

function cardBadge(recipe: FavoriteRecipe) {
  if (recipe.servings >= 4) return { label: "Family Favorite", tone: "terracotta" as const };
  if (isVegetarian(recipe.dietaryTags))
    return { label: "Vegetarian", tone: "sage" as const };
  if (recipe.cookTimeMinutes <= 20) return { label: "Quick Meal", tone: "neutral" as const };
  return null;
}

function dietaryInitials(tags: string[]) {
  const initials: string[] = [];
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => t.includes("vegan") || t.includes("vegetarian"))) initials.push("V");
  if (lower.some((t) => t.includes("gluten"))) initials.push("GF");
  return initials;
}

interface CookLogEntry {
  id: string;
  cookedAt: string;
  recipe: { title: string; id: string; dietaryTags: string[]; cuisine?: string | null };
}

export default function FavoritesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const { data: favorites = [], isLoading, refetch, isFetching } = useQuery<FavoriteRecipe[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session,
  });

  const { data: cookLogs = [] } = useQuery<CookLogEntry[]>({
    queryKey: ["cook-log"],
    queryFn: () => fetch("/api/cook-log").then((r) => r.json()),
    enabled: !!session,
  });

  // Compute cook streak
  const cookStreak = useMemo(() => {
    if (cookLogs.length === 0) return { streak: 0, longestStreak: 0, totalCooked: 0, topCuisine: null as string | null };
    const sortedDates = cookLogs
      .map((l) => new Date(l.cookedAt).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((d) => new Date(d).getTime())
      .sort((a, b) => b - a);

    let streak = 1;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const lastCook = new Date(sortedDates[0]).toDateString();
    if (lastCook !== today && lastCook !== yesterday) streak = 0;
    else {
      for (let i = 1; i < sortedDates.length; i++) {
        const diff = sortedDates[i - 1] - sortedDates[i];
        if (diff === 86400000) streak++;
        else break;
      }
    }

    let longestStreak = 0;
    let cur = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      if (sortedDates[i - 1] - sortedDates[i] === 86400000) {
        cur++;
        longestStreak = Math.max(longestStreak, cur);
      } else {
        cur = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);

    const cuisineCounts: Record<string, number> = {};
    cookLogs.forEach((l) => {
      if (l.recipe.cuisine) {
        cuisineCounts[l.recipe.cuisine] = (cuisineCounts[l.recipe.cuisine] || 0) + 1;
      }
    });
    const topCuisine = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return { streak, longestStreak, totalCooked: cookLogs.length, topCuisine };
  }, [cookLogs]);

  const unfavorite = useMutation({
    mutationFn: (recipeId: string) =>
      fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const surprise = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/recipes");
      const recipes = await res.json();
      const savedIds = new Set(favorites.map((f) => f.id));
      const candidates = (recipes as FavoriteRecipe[]).filter((r) => !savedIds.has(r.id));
      if (candidates.length === 0) throw new Error("No suggestions");
      return candidates[Math.floor(Math.random() * candidates.length)];
    },
    onSuccess: (recipe) => router.push(`/recipes/${recipe.id}`),
  });

  const filtered = useMemo(() => {
    let list = [...favorites];
    if (filter === "quick") list = list.filter((r) => r.cookTimeMinutes <= 30);
    if (filter === "vegetarian") list = list.filter((r) => isVegetarian(r.dietaryTags));
    if (filter === "family") list = list.filter((r) => r.servings >= 4);

    if (sort === "recent") {
      list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    } else if (sort === "cooked") {
      list.sort((a, b) => b.cookCount - a.cookCount || a.title.localeCompare(b.title));
    } else {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [favorites, filter, sort]);

  if (!session) {
    return (
      <div className="relative min-h-[70vh] flex items-center justify-center px-6 py-16">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
        <div className="relative text-center max-w-md">
          <BrandLogo className="w-16 h-16 mx-auto mb-6 object-contain" />
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-8 h-px bg-terracotta" />
            <span className="font-label-md text-terracotta uppercase tracking-widest">Your Collection</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-3">
            Sign in to see saved masterpieces
          </h2>
          <Link
            href="/auth/signin"
            className="inline-flex px-10 py-3 bg-primary text-on-primary rounded-full font-label-md"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-background text-on-background font-body-md">
      {/* Header */}
      <section className="relative px-6 lg:px-16 py-16 overflow-hidden">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-10 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="w-12 h-px bg-terracotta" />
              <span className="font-label-md text-terracotta uppercase tracking-widest">
                Your Collection
              </span>
            </div>
            <h1 className="font-display-lg text-[40px] md:text-display-lg text-on-background leading-tight">
              Saved Masterpieces
            </h1>
            <p className="font-body-lg text-on-surface-variant leading-relaxed">
              A curated sanctuary for the flavors you love most. From weekday staples to weekend
              experiments, find your kitchen&apos;s greatest hits here.
            </p>
          </div>
          <div className="flex items-center gap-6 bg-surface-container/40 backdrop-blur-md p-2 pl-6 rounded-full shadow-sm shrink-0">
            <div className="flex flex-col">
              <span className="font-label-sm text-on-surface-variant/60 uppercase">Total Saved</span>
              <span className="font-headline-md text-primary">
                {favorites.length} Recipe{favorites.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="h-10 w-px bg-outline-variant" />
            {cookStreak.streak > 0 && (
              <>
                <div className="flex flex-col">
                  <span className="font-label-sm text-on-surface-variant/60 uppercase">Cook Streak</span>
                  <span className="font-headline-md text-terracotta">
                    🔥 {cookStreak.streak} Day{cookStreak.streak === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="h-10 w-px bg-outline-variant" />
              </>
            )}
            <Link
              href="/recipes"
              className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
              aria-label="Browse recipes"
            >
              <span className="material-symbols-outlined">add</span>
            </Link>
          </div>
        </div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-sage/5 rounded-full blur-3xl -z-0" />
      </section>

      {/* Filter bar */}
      <section className="sticky top-16 z-40 bg-background/80 backdrop-blur-xl py-4 px-6 lg:px-16 border-b border-surface-variant/30">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-6 py-2 rounded-full font-label-md transition-all whitespace-nowrap ${
                  filter === f.key
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-label-sm text-on-surface-variant/60 uppercase">Sort by:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-transparent font-label-md text-on-surface border-none focus:ring-0 cursor-pointer outline-none"
            >
              <option value="recent">Recently Added</option>
              <option value="cooked">Most Cooked</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </div>
        </div>
      </section>

      {/* Mosaic grid */}
      <section className="px-6 lg:px-16 py-10">
        <div className="max-w-[1280px] mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-surface-container-low rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-[64px] text-primary/20 mb-4 block">
                favorite
              </span>
              <h3 className="font-headline-md text-on-surface mb-2">
                {favorites.length === 0 ? "No saved recipes yet" : "No recipes match this filter"}
              </h3>
              <p className="text-on-surface-variant mb-8 max-w-md mx-auto">
                {favorites.length === 0
                  ? "Tap the heart on any recipe to build your collection."
                  : "Try a different filter or browse for more inspiration."}
              </p>
              <Link
                href="/recipes"
                className="inline-flex px-8 py-3 rounded-full bg-primary text-on-primary font-label-md"
              >
                Explore Recipes
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
              {filtered.map((recipe, index) => (
                <FavoriteCard
                  key={recipe.id}
                  recipe={recipe}
                  imageUrl={recipe.imageUrl || PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length]}
                  offsetClass={cardOffsetClass(index)}
                  onUnfavorite={() => unfavorite.mutate(recipe.id)}
                />
              ))}
              <SurpriseCard
                onSurprise={() => surprise.mutate()}
                loading={surprise.isPending}
                offsetClass={filtered.length >= 2 ? "lg:mt-24" : ""}
              />
            </div>
          )}
        </div>
      </section>

      {/* Cook Streak Card */}
      {cookLogs.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-16 pb-0 pt-4">
          <div className="bg-gradient-to-r from-terracotta/10 via-primary/5 to-sage/10 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-terracotta/15 flex items-center justify-center text-[40px]">
                🔥
              </div>
              <div>
                <h3 className="font-headline-md text-on-surface">
                  {cookStreak.streak > 0 ? `${cookStreak.streak}-day cooking streak!` : "Start your streak!"}
                </h3>
                <p className="text-on-surface-variant font-body-md">
                  {cookStreak.streak > 0
                    ? "You've been cooking consistently. Keep it up!"
                    : "Log a cooked meal to start your streak."}
                </p>
              </div>
            </div>

            <div className="flex gap-8 md:ml-auto">
              <div className="text-center">
                <p className="font-headline-lg text-terracotta">{cookStreak.totalCooked}</p>
                <p className="font-label-sm text-on-surface-variant uppercase">Total Cooked</p>
              </div>
              <div className="text-center">
                <p className="font-headline-lg text-primary">{cookStreak.longestStreak}</p>
                <p className="font-label-sm text-on-surface-variant uppercase">Best Streak</p>
              </div>
              {cookStreak.topCuisine && (
                <div className="text-center">
                  <p className="font-headline-lg text-sage capitalize">{cookStreak.topCuisine}</p>
                  <p className="font-label-sm text-on-surface-variant uppercase">Top Cuisine</p>
                </div>
              )}
            </div>

            {cookStreak.topCuisine && (
              <div className="md:ml-4 bg-white/60 backdrop-blur-md rounded-2xl px-5 py-3 text-center">
                <p className="font-label-sm text-on-surface-variant mb-1">Try something new!</p>
                <Link
                  href={`/recipes?search=${cookStreak.topCuisine}`}
                  className="font-label-md text-primary hover:text-terracotta transition-colors"
                >
                  More {cookStreak.topCuisine} recipes →
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Exploration footer */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-16 py-16">
        <div className="w-full bg-surface-container-low rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/3 w-full max-w-xs">
            <div className="relative w-full aspect-square bg-surface rounded-full flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-sage/5 animate-pulse" />
              <span className="material-symbols-outlined text-[80px] text-primary/20">restaurant</span>
            </div>
          </div>
          <div className="md:w-2/3 space-y-6">
            <h2 className="font-headline-lg text-on-surface">Can&apos;t find what you&apos;re looking for?</h2>
            <p className="font-body-lg text-on-surface-variant">
              Your favorites collection syncs across all your devices. If you recently saved a recipe
              on mobile, it should appear here shortly. In the meantime, why not browse our latest
              seasonal picks?
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/recipes"
                className="px-8 py-3 rounded-full border-2 border-primary text-primary font-label-md hover:bg-primary hover:text-on-primary transition-all"
              >
                Browse Seasonal
              </Link>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-8 py-3 rounded-full bg-surface-container text-on-surface-variant font-label-md hover:bg-surface-variant transition-all disabled:opacity-50"
              >
                {isFetching ? "Syncing…" : "Sync Now"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <Link
        href="/recipes"
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-terracotta text-on-primary shadow-xl md:hidden z-50 flex items-center justify-center active:scale-90 transition-transform"
        aria-label="Add recipes"
      >
        <span className="material-symbols-outlined">add</span>
      </Link>

      <footer className="w-full bg-surface-container-low py-10 mt-8">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-16 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-6 w-6 object-contain" muted />
            <span className="text-label-md text-on-surface-variant">
              What&apos;s for Dinner © {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex gap-6">
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/recipes">
              Recipes
            </Link>
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/meal-plan">
              Meal Plan
            </Link>
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/pantry">
              Pantry
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function cardOffsetClass(index: number) {
  if (index === 1) return "lg:mt-12";
  if (index === 3) return "-mt-8 hidden lg:flex";
  return "";
}

function FavoriteCard({
  recipe,
  imageUrl,
  offsetClass,
  onUnfavorite,
}: {
  recipe: FavoriteRecipe;
  imageUrl: string;
  offsetClass: string;
  onUnfavorite: () => void;
}) {
  const badge = cardBadge(recipe);
  const initials = dietaryInitials(recipe.dietaryTags);
  const rating =
    recipe.averageRating && recipe.reviewCount > 0
      ? `${recipe.averageRating.toFixed(1)} (${recipe.reviewCount} review${recipe.reviewCount === 1 ? "" : "s"})`
      : null;

  return (
    <div
      className={`group relative flex flex-col bg-surface rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-1 ${offsetClass}`}
    >
      <Link href={`/recipes/${recipe.id}`} className="relative aspect-[4/5] overflow-hidden block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          alt={recipe.title}
          src={imageUrl}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/40 via-transparent to-transparent opacity-60" />
        {badge && badge.tone !== "neutral" && (
          <div className="absolute bottom-4 left-4 flex gap-2">
            <span
              className={`px-3 py-1 rounded-full backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider ${
                badge.tone === "terracotta" ? "bg-terracotta/90" : "bg-sage/90"
              }`}
            >
              {badge.label}
            </span>
          </div>
        )}
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onUnfavorite();
        }}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface/90 backdrop-blur-md text-secondary flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
        aria-label="Remove from favorites"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          favorite
        </span>
      </button>
      <div className="p-6 space-y-2">
        <div className="flex justify-between items-start gap-3">
          <Link
            href={`/recipes/${recipe.id}`}
            className="font-headline-md text-on-surface group-hover:text-primary transition-colors line-clamp-2"
          >
            {recipe.title}
          </Link>
          <div className="flex items-center gap-1 text-on-surface-variant shrink-0">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span className="font-label-sm">{formatCookTime(recipe.cookTimeMinutes)}</span>
          </div>
        </div>
        {recipe.description && (
          <p className="font-body-md text-on-surface-variant line-clamp-2">{recipe.description}</p>
        )}
        <div className="pt-2 flex flex-wrap items-center gap-4">
          {initials.length > 0 && (
            <div className="flex -space-x-2">
              {initials.map((letter, i) => (
                <div
                  key={letter}
                  className={`w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? "bg-primary/20" : "bg-secondary/20"
                  }`}
                >
                  {letter}
                </div>
              ))}
            </div>
          )}
          {rating && (
            <span className="font-label-sm text-on-surface-variant/60">{rating}</span>
          )}
          {badge?.tone === "neutral" && (
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase">
              {badge.label}
            </span>
          )}
          {recipe.cookCount > 0 && (
            <span className="font-label-sm text-on-surface-variant/60">
              Cooked {recipe.cookCount}×
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SurpriseCard({
  onSurprise,
  loading,
  offsetClass,
}: {
  onSurprise: () => void;
  loading: boolean;
  offsetClass: string;
}) {
  return (
    <div
      className={`group relative flex flex-col bg-primary rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 items-center justify-center p-16 text-center space-y-6 min-h-[360px] ${offsetClass}`}
    >
      <div className="w-20 h-20 rounded-full bg-on-primary/10 flex items-center justify-center">
        <span className="material-symbols-outlined text-[40px] text-on-primary">magic_button</span>
      </div>
      <h3 className="font-headline-md text-on-primary">Ready for something new?</h3>
      <p className="font-body-md text-on-primary/80 max-w-xs">
        Let our chef suggest a new favorite based on your collection.
      </p>
      <button
        type="button"
        onClick={onSurprise}
        disabled={loading}
        className="px-8 py-3 rounded-full bg-on-primary text-primary font-label-md hover:bg-surface transition-colors shadow-lg disabled:opacity-50"
      >
        {loading ? "Finding…" : "Surprise Me"}
      </button>
    </div>
  );
}
