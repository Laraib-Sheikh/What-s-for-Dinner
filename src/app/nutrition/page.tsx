"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format, subDays, startOfWeek, isSameWeek } from "date-fns";
import { BrandLogo } from "@/components/BrandLogo";

interface CookLogEntry {
  id: string;
  cookedAt: string;
  rating?: number | null;
  recipe: {
    id: string;
    title: string;
    calories?: number | null;
    proteinGrams?: number | null;
    carbsGrams?: number | null;
    fatGrams?: number | null;
    mealType: string;
    dietaryTags: string[];
    cuisine?: string | null;
    cookTimeMinutes: number;
    imageUrl?: string | null;
  };
}

const MACRO_COLORS = {
  protein: "bg-primary",
  carbs: "bg-terracotta",
  fat: "bg-sage",
};

const DAILY_TARGETS = {
  calories: 2000,
  proteinGrams: 50,
  carbsGrams: 250,
  fatGrams: 65,
};

function MacroBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const over = value > max;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-label-sm">
        <span className="text-on-surface-variant">{label}</span>
        <span className={`font-bold ${over ? "text-terracotta" : "text-on-surface"}`}>
          {Math.round(value)}g {over ? "⚠" : `/ ${max}g`}
        </span>
      </div>
      <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${over ? "bg-terracotta" : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const { data: session } = useSession();

  const { data: cookLogs = [], isLoading } = useQuery<CookLogEntry[]>({
    queryKey: ["cook-log"],
    queryFn: () => fetch("/api/cook-log").then((r) => r.json()),
    enabled: !!session,
  });

  const now = new Date();
  const weekStartDate = startOfWeek(now, { weekStartsOn: 1 });

  const weekLogs = useMemo(
    () => cookLogs.filter((l) => isSameWeek(new Date(l.cookedAt), now, { weekStartsOn: 1 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cookLogs]
  );

  const last30 = useMemo(
    () => cookLogs.filter((l) => new Date(l.cookedAt) >= subDays(now, 30)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cookLogs]
  );

  const weekTotals = useMemo(() => {
    const totals = { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 };
    weekLogs.forEach((l) => {
      totals.calories += l.recipe.calories ?? 0;
      totals.proteinGrams += l.recipe.proteinGrams ?? 0;
      totals.carbsGrams += l.recipe.carbsGrams ?? 0;
      totals.fatGrams += l.recipe.fatGrams ?? 0;
    });
    return totals;
  }, [weekLogs]);

  const dailyAverages = useMemo(() => {
    const days = Math.max(1, weekLogs.length);
    return {
      calories: weekTotals.calories / days,
      proteinGrams: weekTotals.proteinGrams / days,
      carbsGrams: weekTotals.carbsGrams / days,
      fatGrams: weekTotals.fatGrams / days,
    };
  }, [weekTotals, weekLogs]);

  const mealTypeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    last30.forEach((l) => {
      map[l.recipe.mealType] = (map[l.recipe.mealType] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [last30]);

  const cuisineDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    last30.forEach((l) => {
      if (l.recipe.cuisine) {
        map[l.recipe.cuisine] = (map[l.recipe.cuisine] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [last30]);

  const dietaryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    last30.forEach((l) => {
      l.recipe.dietaryTags.forEach((tag) => {
        map[tag] = (map[tag] || 0) + 1;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [last30]);

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i);
      const dayLogs = cookLogs.filter(
        (l) => format(new Date(l.cookedAt), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
      );
      const calories = dayLogs.reduce((s, l) => s + (l.recipe.calories ?? 0), 0);
      return { date, calories, count: dayLogs.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookLogs]);

  const maxCalDay = Math.max(...last7Days.map((d) => d.calories), DAILY_TARGETS.calories);

  if (!session) {
    return (
      <div className="relative min-h-[70vh] flex items-center justify-center px-6 py-16">
        <div className="relative text-center max-w-md">
          <BrandLogo className="w-16 h-16 mx-auto mb-6 object-contain" />
          <h2 className="font-headline-lg text-on-surface mb-3">Sign in to track nutrition</h2>
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
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden opacity-20">
        <div className="absolute top-[10%] left-[-5%] w-96 h-96 bg-sage/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <section className="px-6 lg:px-16 py-10">
        <div className="max-w-[1280px] mx-auto">
          <span className="font-label-md text-primary uppercase tracking-widest mb-1 block">
            Health & Wellness
          </span>
          <h1 className="font-display-lg text-[40px] md:text-display-lg text-on-background tracking-tighter leading-tight mb-2">
            Nutrition & Goals
          </h1>
          <p className="font-body-lg text-on-surface-variant max-w-xl">
            Automatic macro tracking pulled from what you actually cook — no manual logging.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="max-w-[1280px] mx-auto px-6 lg:px-16 grid grid-cols-1 md:grid-cols-3 gap-6 pb-16">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-surface-container-low rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : cookLogs.length === 0 ? (
        <div className="max-w-[1280px] mx-auto px-6 lg:px-16 pb-16 text-center py-20">
          <span className="material-symbols-outlined text-[64px] text-on-surface-variant/30 block mb-4">
            monitor_heart
          </span>
          <h3 className="font-headline-md text-on-surface mb-2">No cook logs yet</h3>
          <p className="text-on-surface-variant mb-6">
            Log a cooked recipe to start tracking your nutritional intake automatically.
          </p>
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-full font-label-md"
          >
            <span className="material-symbols-outlined">restaurant</span>
            Find a Recipe to Cook
          </Link>
        </div>
      ) : (
        <div className="max-w-[1280px] mx-auto px-6 lg:px-16 pb-16 space-y-8">
          {/* Week summary stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Meals This Week", value: weekLogs.length.toString(), icon: "restaurant", color: "text-primary" },
              { label: "Avg. Calories / Meal", value: weekLogs.length > 0 ? `${Math.round(dailyAverages.calories)} kcal` : "—", icon: "local_fire_department", color: "text-terracotta" },
              { label: "Total This Month", value: last30.length.toString(), icon: "calendar_month", color: "text-sage" },
              { label: "Variety Score", value: `${Math.min(100, cuisineDistribution.length * 20 + dietaryBreakdown.length * 5)}/100`, icon: "diversity_1", color: "text-primary" },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-container-low rounded-3xl p-6 flex flex-col gap-2">
                <span className={`material-symbols-outlined ${stat.color} text-[28px]`}>{stat.icon}</span>
                <p className="font-headline-md text-on-surface">{stat.value}</p>
                <p className="font-label-sm text-on-surface-variant">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Macros this week */}
            <div className="lg:col-span-5 bg-surface-container-low rounded-3xl p-8">
              <h2 className="font-headline-md text-on-surface mb-2">Macros This Week</h2>
              <p className="text-label-sm text-on-surface-variant mb-6">
                {format(weekStartDate, "MMM d")} – {format(now, "MMM d")} · {weekLogs.length} logged meals
              </p>
              <div className="space-y-5">
                <div className="space-y-1">
                  <div className="flex justify-between text-label-sm">
                    <span className="text-on-surface-variant">Calories</span>
                    <span className={`font-bold ${weekTotals.calories > DAILY_TARGETS.calories * 7 ? "text-terracotta" : "text-on-surface"}`}>
                      {Math.round(weekTotals.calories)} kcal
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all duration-700"
                      style={{ width: `${Math.min(100, (weekTotals.calories / (DAILY_TARGETS.calories * 7)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-label-sm text-on-surface-variant/60">Target: {DAILY_TARGETS.calories * 7} kcal / week</p>
                </div>
                <MacroBar value={weekTotals.proteinGrams} max={DAILY_TARGETS.proteinGrams * 7} color={MACRO_COLORS.protein} label="Protein" />
                <MacroBar value={weekTotals.carbsGrams} max={DAILY_TARGETS.carbsGrams * 7} color={MACRO_COLORS.carbs} label="Carbs" />
                <MacroBar value={weekTotals.fatGrams} max={DAILY_TARGETS.fatGrams * 7} color={MACRO_COLORS.fat} label="Fat" />
              </div>
              <p className="text-label-sm text-on-surface-variant/60 mt-4">
                * Targets based on 2000 kcal/day. Actual values depend on recipe data.
              </p>
            </div>

            {/* 7-day calorie chart */}
            <div className="lg:col-span-7 bg-surface-container-low rounded-3xl p-8">
              <h2 className="font-headline-md text-on-surface mb-2">Last 7 Days</h2>
              <p className="text-label-sm text-on-surface-variant mb-6">Calorie intake from logged meals</p>
              <div className="flex items-end gap-3 h-32">
                {last7Days.map((day, i) => {
                  const pct = maxCalDay > 0 ? (day.calories / maxCalDay) * 100 : 0;
                  const isToday = i === 6;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full relative" style={{ height: "96px" }}>
                        <div
                          className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-700 ${
                            isToday ? "bg-primary" : day.count > 0 ? "bg-primary/40" : "bg-surface-variant"
                          }`}
                          style={{ height: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-on-surface-variant">
                        {format(day.date, "EEE")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {last7Days.filter((d) => d.count > 0).slice(-3).map((day) => (
                  <div key={day.date.toISOString()} className="bg-white/60 rounded-2xl px-3 py-2 text-center">
                    <p className="font-label-md text-on-surface">{format(day.date, "EEE MMM d")}</p>
                    <p className="text-label-sm text-primary font-bold">{Math.round(day.calories)} kcal</p>
                    <p className="text-label-sm text-on-surface-variant">{day.count} meal{day.count !== 1 ? "s" : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cuisine & meal type breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cuisineDistribution.length > 0 && (
              <div className="bg-surface-container-low rounded-3xl p-8">
                <h2 className="font-headline-md text-on-surface mb-6">Top Cuisines (30 days)</h2>
                <div className="space-y-3">
                  {cuisineDistribution.map(([cuisine, count]) => {
                    const pct = Math.round((count / last30.length) * 100);
                    return (
                      <div key={cuisine}>
                        <div className="flex justify-between text-label-sm mb-1">
                          <span className="text-on-surface capitalize">{cuisine}</span>
                          <span className="text-on-surface-variant">{count} meals · {pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-variant rounded-full">
                          <div className="h-full bg-sage rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {mealTypeDistribution.length > 0 && (
              <div className="bg-surface-container-low rounded-3xl p-8">
                <h2 className="font-headline-md text-on-surface mb-6">Meal Type Split (30 days)</h2>
                <div className="space-y-3">
                  {mealTypeDistribution.map(([type, count]) => {
                    const pct = Math.round((count / last30.length) * 100);
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-label-sm mb-1">
                          <span className="text-on-surface capitalize">{type}</span>
                          <span className="text-on-surface-variant">{count} meals · {pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-variant rounded-full">
                          <div className="h-full bg-terracotta/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {dietaryBreakdown.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-title-lg text-on-surface mb-3">Dietary Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {dietaryBreakdown.map(([tag, count]) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-label-sm capitalize"
                        >
                          {tag} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent cook log */}
          <div className="bg-surface-container-low rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline-md text-on-surface">Recent Cook Log</h2>
              <Link href="/favorites" className="text-label-md text-primary hover:text-terracotta transition-colors">
                View Favorites →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cookLogs.slice(0, 6).map((log) => (
                <Link
                  key={log.id}
                  href={`/recipes/${log.recipe.id}`}
                  className="group flex items-center gap-4 bg-white rounded-2xl p-4 hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-variant shrink-0">
                    {log.recipe.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={log.recipe.imageUrl} alt={log.recipe.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary/40">restaurant</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                      {log.recipe.title}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {format(new Date(log.cookedAt), "MMM d")}
                      {log.recipe.calories ? ` · ${log.recipe.calories} kcal` : ""}
                    </p>
                  </div>
                  {log.rating && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <span className="material-symbols-outlined text-terracotta text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-label-sm text-on-surface-variant">{log.rating}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-primary rounded-3xl p-8 md:p-12 text-on-primary flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-headline-lg text-on-primary mb-2">Want better nutrition data?</h3>
              <p className="text-on-primary/80">
                Add calorie and macro info when submitting recipes for more accurate tracking.
              </p>
            </div>
            <Link
              href="/recipes/submit"
              className="shrink-0 bg-on-primary text-primary px-8 py-3 rounded-full font-label-md hover:scale-105 transition-all shadow-md"
            >
              Submit a Recipe
            </Link>
          </div>
        </div>
      )}

      <footer className="w-full bg-surface-container-low py-10 mt-8">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-16 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-6 w-6 object-contain" muted />
            <span className="text-label-md text-on-surface-variant">
              What&apos;s for Dinner © {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex gap-6">
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/meal-plan">Meal Plan</Link>
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/recipes">Recipes</Link>
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/favorites">Favorites</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
