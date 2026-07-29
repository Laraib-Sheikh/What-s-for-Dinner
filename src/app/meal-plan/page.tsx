"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { formatCookTime } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
type MealSlot = (typeof MEAL_SLOTS)[number];

const SLOT_META: Record<MealSlot, { icon: string; accent: string }> = {
  breakfast: { icon: "wb_twilight", accent: "text-terracotta" },
  lunch: { icon: "wb_sunny", accent: "text-primary" },
  dinner: { icon: "nights_stay", accent: "text-primary" },
};

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

interface RecipeSuggestion {
  id: string;
  title: string;
  mealType: string;
  cookTimeMinutes: number;
  imageUrl?: string | null;
  dietaryTags?: string[];
}

function shouldUseFeaturedLayout(slot: MealSlot, hasImage: boolean): boolean {
  if (slot === "breakfast" || slot === "dinner") return true;
  return hasImage;
}

export default function MealPlanPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [addingSlot, setAddingSlot] = useState<{ date: string; slot: string } | null>(null);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [discoverySeed, setDiscoverySeed] = useState(0);

  // Auto-plan state
  const [autoPlanning, setAutoPlanning] = useState(false);

  // Nutrition check state
  const [nutritionData, setNutritionData] = useState<{
    score: number;
    summary: string;
    flags: string[];
    swapSuggestion: string | null;
  } | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);

  const handleAutoPlan = async () => {
    setAutoPlanning(true);
    try {
      const res = await fetch("/api/ai/auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekStart.toISOString() }),
      });
      const data = await res.json();
      if (data.plan && Array.isArray(data.plan)) {
        await Promise.allSettled(
          data.plan.map((item: { date: string; slot: string; recipeId: string }) =>
            fetch("/api/meal-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipeId: item.recipeId,
                plannedDate: item.date,
                mealSlot: item.slot,
              }),
            })
          )
        );
        queryClient.invalidateQueries({ queryKey: ["meal-plan"] });
      }
    } catch {
      // silent
    } finally {
      setAutoPlanning(false);
    }
  };

  const handleNutritionCheck = async () => {
    setNutritionLoading(true);
    try {
      const res = await fetch("/api/ai/nutrition-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekStart.toISOString() }),
      });
      const data = await res.json();
      setNutritionData(data);
    } catch {
      // silent
    } finally {
      setNutritionLoading(false);
    }
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekEnd = addDays(weekStart, 6);

  const { data: entries = [], isLoading } = useQuery<MealPlanEntry[]>({
    queryKey: ["meal-plan", weekStart.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/meal-plan?weekStart=${weekStart.toISOString()}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session,
  });

  const { data: recipes = [] } = useQuery<RecipeSuggestion[]>({
    queryKey: ["recipes-list"],
    queryFn: async () => {
      const res = await fetch("/api/recipes");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session,
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => fetch(`/api/meal-plan?id=${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plan"] }),
  });

  const addEntry = useMutation({
    mutationFn: async ({
      recipeId,
      date,
      slot,
    }: {
      recipeId: string;
      date: string;
      slot: string;
    }) => {
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
      const res = await fetch("/api/shopping-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      return res.json();
    },
    onSuccess: () => router.push("/shopping"),
  });

  const getEntriesForSlot = (date: Date, slot: string) =>
    entries.filter(
      (e) => isSameDay(new Date(e.plannedDate), date) && e.mealSlot === slot
    );

  const filledSlots = useMemo(() => {
    let count = 0;
    for (const day of weekDays) {
      for (const slot of MEAL_SLOTS) {
        if (getEntriesForSlot(day, slot).length > 0) count += 1;
      }
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, weekDays]);

  const balancePct = Math.min(100, Math.round((filledSlots / 21) * 100));

  const discovery = useMemo(() => {
    if (!recipes.length) return [];
    const start = discoverySeed % recipes.length;
    return [...recipes.slice(start), ...recipes.slice(0, start)].slice(0, 3);
  }, [recipes, discoverySeed]);

  const filteredRecipes = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
      r.mealType.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  const badgeFor = (recipe: RecipeSuggestion, index: number) => {
    if (recipe.dietaryTags?.some((t) => /protein|high.?protein/i.test(t))) {
      return { label: "Trending", cls: "bg-tertiary-fixed text-on-tertiary-fixed" };
    }
    if (recipe.cookTimeMinutes <= 20) {
      return { label: "Quick Fix", cls: "bg-secondary-fixed text-on-secondary-fixed" };
    }
    if (index === 2) {
      return { label: "Family Fav", cls: "bg-primary-fixed text-on-primary-fixed" };
    }
    return { label: recipe.mealType, cls: "bg-surface-variant text-on-surface-variant" };
  };

  const openAdd = (date: Date, slot: MealSlot) =>
    setAddingSlot({ date: date.toISOString(), slot });

  if (!session) {
    return (
      <div className="relative min-h-[70vh] flex items-center justify-center px-6 py-16">
        <div className="absolute -top-24 right-0 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
        <div className="relative text-center max-w-md">
          <BrandLogo className="w-16 h-16 mx-auto mb-6 object-contain" />
          <span className="font-label-md text-terracotta uppercase tracking-widest mb-2 block">
            Your Nourishment Journey
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-3">
            Sign in to plan your meals
          </h2>
          <p className="text-on-surface-variant font-body-md mb-8">
            Build a weekly ritual of breakfast, lunch, and dinner — then generate your shopping list.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex px-10 py-3 bg-primary text-on-primary rounded-full font-label-md hover:scale-[1.02] transition-transform"
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
      <section className="relative px-6 lg:px-16 py-10 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-sage/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-[1280px] mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
            <div className="max-w-2xl">
              <span className="font-label-md text-terracotta uppercase tracking-widest mb-2 block">
                Your Nourishment Journey
              </span>
              <h1 className="font-display-lg text-[40px] md:text-display-lg text-on-background mb-4 leading-tight tracking-tight">
                Weekly Rituals
              </h1>
              <p className="font-body-lg text-on-surface-variant max-w-lg">
                A curated flow of seasonal ingredients and balanced nutrition. Your kitchen,
                synchronized.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-surface-container-high pl-2 pr-6 py-2 rounded-full shadow-sm hover:bg-surface-variant transition-all">
                <button
                  type="button"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center"
                  aria-label="Previous week"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                    chevron_left
                  </span>
                </button>
                <span className="material-symbols-outlined text-primary text-[20px]">
                  calendar_today
                </span>
                <span className="font-label-md text-on-surface whitespace-nowrap">
                  {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center ml-1"
                  aria-label="Next week"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                    chevron_right
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                className="hidden sm:inline-flex font-label-sm text-on-surface-variant hover:text-primary px-3 py-2"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleAutoPlan}
                disabled={autoPlanning}
                className="flex items-center gap-2 bg-surface-container-high text-on-surface px-8 py-3 rounded-full hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-primary">
                  {autoPlanning ? "progress_activity" : "auto_awesome"}
                </span>
                <span className="font-label-md">Auto-Plan Week</span>
              </button>
              <button
                type="button"
                id="generateList"
                onClick={() => generateGrocery.mutate()}
                disabled={generateGrocery.isPending || entries.length === 0}
                className="flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-full hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined">
                  {generateGrocery.isPending ? "progress_activity" : "shopping_basket"}
                </span>
                <span className="font-label-md">Generate List</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-16 w-full grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3 animate-pulse">
                  <div className="h-7 bg-surface-variant rounded-lg" />
                  <div className="h-44 bg-surface-container-low rounded-2xl" />
                  <div className="h-16 bg-surface-container-low rounded-2xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
              {weekDays.map((day, dayIndex) => {
                const isToday = isSameDay(day, new Date());
                const dayHasMeals = MEAL_SLOTS.some(
                  (s) => getEntriesForSlot(day, s).length > 0
                );

                return (
                  <div key={day.toISOString()} className="flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-surface-variant pb-1">
                      <h3
                        className={`font-headline-md ${
                          isToday || dayIndex === 0 ? "text-primary" : "text-on-surface"
                        }`}
                      >
                        {format(day, "EEEE")}
                      </h3>
                      <span className="font-label-sm text-on-surface-variant opacity-60">
                        {format(day, "MMM d")}
                      </span>
                    </div>

                    {!dayHasMeals ? (
                      <button
                        type="button"
                        onClick={() => openAdd(day, "dinner")}
                        className="flex flex-col gap-3 opacity-60 hover:opacity-100 transition-opacity text-left"
                      >
                        <div className="bg-surface-container rounded-2xl p-6 border-l-4 border-sage">
                          <span className="font-label-sm text-on-surface-variant uppercase">
                            All Day
                          </span>
                          <h4 className="font-label-md text-on-surface mt-1">Planned Rest Day</h4>
                          <p className="text-label-sm text-on-surface-variant mt-1">
                            Tap to schedule a meal
                          </p>
                        </div>
                      </button>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {MEAL_SLOTS.map((slot) => {
                          const slotEntries = getEntriesForSlot(day, slot);
                          const meta = SLOT_META[slot];

                          if (slotEntries.length === 0) {
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => openAdd(day, slot)}
                                className="bg-surface-container-low rounded-2xl px-6 py-10 border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white transition-colors"
                              >
                                <span className="material-symbols-outlined text-primary mb-1">
                                  add_circle
                                </span>
                                <span className="font-label-md text-on-surface-variant capitalize">
                                  Add {slot} Slot
                                </span>
                              </button>
                            );
                          }

                          return slotEntries.map((entry) => {
                            const hasImage = !!entry.recipe.imageUrl;
                            const featured = shouldUseFeaturedLayout(slot, hasImage);

                            if (featured) {
                              return (
                                <div
                                  key={entry.id}
                                  className="group relative bg-surface-container-low rounded-2xl overflow-hidden transition-all hover:shadow-md hover:-translate-y-1"
                                >
                                  <button
                                    type="button"
                                    className="w-full text-left"
                                    onClick={() => router.push(`/recipes/${entry.recipe.id}`)}
                                  >
                                    {hasImage && (
                                      <div className="aspect-video w-full overflow-hidden bg-surface-variant">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                          alt={entry.recipe.title}
                                          src={entry.recipe.imageUrl!}
                                        />
                                      </div>
                                    )}
                                    <div className={hasImage ? "p-6" : "p-6 pt-5"}>
                                      <div className="flex items-center gap-1 mb-1">
                                        <span
                                          className={`material-symbols-outlined text-[16px] ${meta.accent}`}
                                        >
                                          {meta.icon}
                                        </span>
                                        <span className="font-label-sm text-on-surface-variant uppercase tracking-tighter">
                                          {slot}
                                        </span>
                                      </div>
                                      <h4 className="font-title-lg text-on-surface mb-1 line-clamp-2">
                                        {entry.recipe.title}
                                      </h4>
                                      <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px] text-primary">
                                          timer
                                        </span>
                                        <span className="font-label-sm text-on-surface-variant">
                                          {formatCookTime(entry.recipe.cookTimeMinutes)}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeEntry.mutate(entry.id)}
                                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:text-error shadow-sm"
                                    aria-label="Remove meal"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      close
                                    </span>
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={entry.id}
                                className="group relative bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-bright flex items-center gap-6"
                              >
                                <button
                                  type="button"
                                  className="flex items-center gap-6 flex-1 text-left min-w-0"
                                  onClick={() => router.push(`/recipes/${entry.recipe.id}`)}
                                >
                                  <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-surface-variant">
                                    {hasImage ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        className="w-full h-full object-cover"
                                        alt={entry.recipe.title}
                                        src={entry.recipe.imageUrl!}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span
                                          className={`material-symbols-outlined ${meta.accent}`}
                                        >
                                          {meta.icon}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-label-sm text-on-surface-variant opacity-60 uppercase">
                                      {slot}
                                    </span>
                                    <h4 className="font-label-md text-on-surface line-clamp-1">
                                      {entry.recipe.title}
                                    </h4>
                                  </div>
                                  <span className="material-symbols-outlined text-on-surface-variant opacity-30 shrink-0">
                                    drag_indicator
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeEntry.mutate(entry.id)}
                                  className="absolute top-2 right-2 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-error-container text-error"
                                  aria-label="Remove meal"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    close
                                  </span>
                                </button>
                              </div>
                            );
                          });
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Discovery sidebar */}
        <aside className="lg:col-span-4">
          <div className="bg-surface-container rounded-3xl p-10 sticky top-24">
            <div className="flex items-center justify-between mb-10">
              <h2 className="font-headline-md text-on-surface">Discovery</h2>
              <button
                type="button"
                onClick={() => setDiscoverySeed((s) => s + 3)}
                className="material-symbols-outlined text-primary cursor-pointer hover:rotate-180 transition-transform duration-500"
                aria-label="Refresh suggestions"
              >
                refresh
              </button>
            </div>

            <div className="space-y-6 discovery-list max-h-[420px] overflow-y-auto pr-1">
              {discovery.length === 0 ? (
                <p className="text-label-md text-on-surface-variant">
                  No recipes yet. Add some to discover ideas for your week.
                </p>
              ) : (
                discovery.map((recipe, index) => {
                  const badge = badgeFor(recipe, index);
                  return (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => router.push(`/recipes/${recipe.id}`)}
                      className="group flex gap-6 items-start p-3 rounded-2xl hover:bg-surface-bright transition-all cursor-pointer w-full text-left"
                    >
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-sm bg-surface-variant">
                        {recipe.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="w-full h-full object-cover"
                            alt={recipe.title}
                            src={recipe.imageUrl}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary/40">
                              restaurant
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`${badge.cls} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase inline-block mb-1`}
                        >
                          {badge.label}
                        </span>
                        <h5 className="font-label-md text-on-surface line-clamp-1">
                          {recipe.title}
                        </h5>
                        <p className="text-label-sm text-on-surface-variant mt-1">
                          {formatCookTime(recipe.cookTimeMinutes)}
                          {recipe.dietaryTags?.[0]
                            ? ` • ${recipe.dietaryTags[0]}`
                            : ` • ${recipe.mealType}`}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-16 pt-10 border-t border-surface-variant/50 space-y-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  <span className="font-label-md text-on-surface">Weekly Balance</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 mb-2">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-700"
                    style={{ width: `${balancePct}%` }}
                  />
                </div>
                <div className="flex justify-between text-label-sm text-on-surface-variant">
                  <span>Meals planned</span>
                  <span className="text-on-surface font-bold">{balancePct}%</span>
                </div>
              </div>

              {/* Nutrition Balance Check */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-terracotta">monitor_heart</span>
                    <span className="font-label-md text-on-surface">Nutrition Check</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleNutritionCheck}
                    disabled={nutritionLoading || entries.length === 0}
                    className="text-label-sm text-primary hover:text-terracotta transition-colors disabled:opacity-40"
                  >
                    {nutritionLoading ? "Analyzing…" : "Analyze"}
                  </button>
                </div>

                {nutritionData ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-surface-container rounded-full h-2">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            nutritionData.score >= 70 ? "bg-sage" : nutritionData.score >= 50 ? "bg-terracotta/60" : "bg-error"
                          }`}
                          style={{ width: `${nutritionData.score}%` }}
                        />
                      </div>
                      <span className="font-label-sm text-on-surface shrink-0">{nutritionData.score}/100</span>
                    </div>
                    <p className="text-label-sm text-on-surface-variant">{nutritionData.summary}</p>
                    {nutritionData.flags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-2 bg-terracotta/5 rounded-xl px-3 py-2">
                        <span className="material-symbols-outlined text-terracotta text-[16px] mt-0.5 shrink-0">warning</span>
                        <p className="text-label-sm text-on-surface">{flag}</p>
                      </div>
                    ))}
                    {nutritionData.swapSuggestion && (
                      <div className="flex items-start gap-2 bg-primary/5 rounded-xl px-3 py-2">
                        <span className="material-symbols-outlined text-primary text-[16px] mt-0.5 shrink-0">lightbulb</span>
                        <p className="text-label-sm text-on-surface">{nutritionData.swapSuggestion}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-label-sm text-on-surface-variant">
                    {entries.length === 0
                      ? "Plan some meals first to check nutritional balance."
                      : "Tap Analyze to get AI-powered nutrition feedback."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="w-full bg-surface-container-low py-10 mt-16">
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
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/pantry">
              Pantry
            </Link>
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/shopping">
              Shopping
            </Link>
          </div>
        </div>
      </footer>

      {addingSlot && (
        <div
          className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setAddingSlot(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-surface-variant">
              <h3 className="font-title-lg text-on-surface">Add Recipe</h3>
              <p className="text-label-sm text-on-surface-variant mt-1 capitalize">
                {format(new Date(addingSlot.date), "EEEE, MMM d")} · {addingSlot.slot}
              </p>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search recipes..."
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 rounded-full bg-surface-container-low border-none text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredRecipes.slice(0, 20).map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    disabled={addEntry.isPending}
                    onClick={() =>
                      addEntry.mutate({
                        recipeId: recipe.id,
                        date: addingSlot.date,
                        slot: addingSlot.slot,
                      })
                    }
                    className="w-full text-left px-4 py-3 rounded-2xl hover:bg-primary/5 transition-colors"
                  >
                    <p className="font-label-md text-on-surface">{recipe.title}</p>
                    <p className="text-label-sm text-on-surface-variant capitalize mt-0.5">
                      {recipe.mealType} · {formatCookTime(recipe.cookTimeMinutes)}
                    </p>
                  </button>
                ))}
                {filteredRecipes.length === 0 && (
                  <p className="text-center text-label-md text-on-surface-variant py-8">
                    No recipes found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
