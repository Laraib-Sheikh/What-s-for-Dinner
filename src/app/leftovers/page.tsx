"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { BrandLogo } from "@/components/BrandLogo";

interface LeftoverContainer {
  id: string;
  name: string;
  imageUrl?: string | null;
  storedAt: string;
  expiresAt?: string | null;
  servings?: number | null;
  tags: string[];
  aiSuggestion?: string | null;
  recipe?: { id: string; title: string; imageUrl?: string | null } | null;
}

interface LeftoverStats {
  activeCount: number;
  wasteAvoidedKg: number;
}

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

interface SuggestResponse {
  suggestion: {
    recipeId: string;
    title: string;
    description: string;
  } | null;
  recipes: LeftoverRecipe[];
}

const HERO_BG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB5_RV_ixEBpXXQiVOT-LV6ZP6dAUT7k5G-A1pA5TYDTZTk8VLf034hK8z1F-a0SHaVAp1SS1MrXDAFpLQhg-4t4HxFXZNqBiyakMU4wNawlhEO64r8Y2pCLNzrffuf_PqtrQE7DrxaKvuJnPJ5BxXEXYJiySJnMH8ecHu46WwxDQt8x2A23_5FyNPhJS20WfF8bNPiJz0gWl24zEoBj0LrJVI3vtvGPJ8B20Y1W1melhVyICM9exEauom2oOzeiVZse2pyM0kYcD4";

const PLACEHOLDER_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAgEF86jalZEe-9tZx9kF-F9KhJiyYaNDDxYVREwCvjScEsQmiWfYJZ7QsacJw_PSEhrICgXISRvoOfdbrxAc19caQHWRxniEkFoy9HYqEbry4KjJ-CgEFxevsXE95BHArOYpmPRr-Vf5W_w2cDuhCWP0vrmGaoOFtIbinTtKkTZOjD3qK2GidFid3ogy8EvHV0PIa6ksyutXc3SZcivOixmFIXVDMHbgqmRLBxIn1TpEbI8EDlHCk6LhRosHfgKKt0vUh6976ym3c",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBFRaoCVqMuM9Nw3wSlbZV1ujH-Dg5_wtcHm3f7uAhVlCuCiUQ-n-XYTExioAl_55DwdFhIsnQe1I2hgGwMsUcH1pj3G0GWoomm1P68BEfePLeAJCi2-_H5ZMDdzoeyUkFxfP-E7pJnbM-dYTpBFqOt6NCE3pDccQltQvJs3cLRmbj2FLR5Ow-RtQ-dYynhrx9J__nf4QH-70ztRlohsu7mVz0TEaRKvvEd6mNwbdFY9bPhHxkSeSv_AOb_7oUPvzpjOpJ1fjLwqWc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBH1QxQSJZtKoc4GxgcargRdqeEdQQFnBBo6Mil4kal-BaFUidfWQsz3HGGFDPIkAZN1PQetxY6mLokkfuRa6xhKxZ_nfX0eZf14XyH_g0ZlQoHT0XZvpK1S7CvTfB2EG0G0AgewYCbxDIxf9_GneYip8CRUDD75kGr2E3hLvfaa_0kcWUKKjCWIS8pWTwilT9kzL3ar-eRnO1BnGQ8qIH9Iy5nuxd1AN376z3cI-Y_f9H0hKcouggefK8aQJ6cL2LTvtWR1ZCMXy8",
];

function daysLeft(expiresAt?: string | null) {
  if (!expiresAt) return null;
  return differenceInCalendarDays(new Date(expiresAt), new Date());
}

function freshness(expiresAt?: string | null) {
  const days = daysLeft(expiresAt);
  if (days === null) return { label: "Fresh", tone: "fresh" as const };
  if (days < 0) return { label: "Expired", tone: "urgent" as const };
  if (days === 0) return { label: "Eat Soon", tone: "urgent" as const };
  if (days <= 2) return { label: "Eat Soon", tone: "urgent" as const };
  return { label: "Fresh", tone: "fresh" as const };
}

function expiryLabel(expiresAt?: string | null) {
  const days = daysLeft(expiresAt);
  if (days === null) return "No date set";
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  return `${format(new Date(expiresAt!), "MMM d")} (${days} day${days === 1 ? "" : "s"} left)`;
}

function shelfLifePercent(storedAt: string, expiresAt?: string | null) {
  if (!expiresAt) return 75;
  const total = differenceInCalendarDays(new Date(expiresAt), new Date(storedAt));
  const left = daysLeft(expiresAt) ?? 0;
  if (total <= 0) return left > 0 ? 50 : 0;
  return Math.max(0, Math.min(100, Math.round((left / total) * 100)));
}

export default function LeftoversPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerData, setDrawerData] = useState<SuggestResponse["suggestion"] | null>(null);
  const [drawerSource, setDrawerSource] = useState<string>("");
  const [recipeResults, setRecipeResults] = useState<LeftoverRecipe[]>([]);
  const [form, setForm] = useState({ name: "", servings: "2", shelfLifeDays: "4", tags: "" });

  const { data, isLoading } = useQuery<{ containers: LeftoverContainer[]; stats: LeftoverStats }>({
    queryKey: ["leftover-containers"],
    queryFn: () => fetch("/api/leftovers").then((r) => r.json()),
    enabled: !!session,
  });

  interface UseItOrLoseItItem {
    type: "pantry" | "leftover";
    id: string;
    name: string;
    daysLeft: number | null;
    urgency: "expired" | "today" | "soon" | "this_week";
    recipeId?: string | null;
    recipeTitle?: string | null;
    servings?: number | null;
  }

  const { data: priorityData } = useQuery<{ items: UseItOrLoseItItem[] }>({
    queryKey: ["use-it-or-lose-it"],
    queryFn: () => fetch("/api/ai/use-it-or-lose-it").then((r) => r.json()),
    enabled: !!session,
  });

  const containers = data?.containers ?? [];
  const stats = data?.stats ?? { activeCount: 0, wasteAvoidedKg: 0 };

  const featured = useMemo(() => {
    if (containers.length === 0) return null;
    return [...containers].sort((a, b) => {
      const da = daysLeft(a.expiresAt) ?? 99;
      const db = daysLeft(b.expiresAt) ?? 99;
      return da - db;
    })[0];
  }, [containers]);

  const heroSuggestion = useMutation({
    mutationFn: async (containerId: string) => {
      const res = await fetch("/api/leftovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", id: containerId }),
      });
      return res.json() as Promise<SuggestResponse>;
    },
    onSuccess: (result) => {
      setRecipeResults(result.recipes || []);
      queryClient.invalidateQueries({ queryKey: ["leftover-containers"] });
    },
  });

  const mutate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/leftovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Request failed");
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leftover-containers"] });
    },
  });

  useEffect(() => {
    if (!featured?.id) return;
    heroSuggestion.mutate(featured.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured?.id]);

  useEffect(() => {
    const top = heroSuggestion.data?.suggestion;
    if (!top) return;
    const timer = setTimeout(() => {
      setDrawerData(top);
      setDrawerSource(featured?.name || "");
      setShowDrawer(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [heroSuggestion.data?.suggestion, featured?.name]);

  const handleSuggest = (container: LeftoverContainer) => {
    heroSuggestion.mutate(container.id, {
      onSuccess: (result) => {
        if (result.suggestion) {
          setDrawerData(result.suggestion);
          setDrawerSource(container.name);
          setShowDrawer(true);
        }
      },
    });
  };

  const handleCreate = () => {
    const name = form.name.trim();
    if (!name) return;
    mutate.mutate(
      {
        action: "create",
        name,
        servings: Number(form.servings) || 2,
        shelfLifeDays: Number(form.shelfLifeDays) || 4,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          setShowAddModal(false);
          setForm({ name: "", servings: "2", shelfLifeDays: "4", tags: "" });
        },
      }
    );
  };

  const topRecipe = recipeResults[0];
  const heroTitle = featured
    ? `Turn yesterday's ${featured.name.split(" ").slice(0, 2).join(" ")} into tonight's ${topRecipe?.title.split(" ").slice(-1)[0] || "feast"}.`
    : "Turn yesterday's roast into tonight's tacos.";

  const heroBody = heroSuggestion.data?.suggestion?.description ||
    (featured
      ? `Our AI analyzed your ${formatDistanceToNow(new Date(featured.storedAt), { addSuffix: true })} ${featured.name}. Add containers to get personalized repurpose ideas.`
      : "Track what's in your fridge and get AI-powered ideas to waste less and cook more.");

  if (!session) {
    return (
      <div className="relative min-h-[70vh] flex items-center justify-center px-6 py-16">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
        <div className="relative text-center max-w-md">
          <BrandLogo className="w-16 h-16 mx-auto mb-6 object-contain" />
          <span className="font-label-md text-primary uppercase tracking-widest mb-2 block">
            Sustainability First
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-3">
            Sign in to open the Fridge Archive
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
      <section className="relative px-6 lg:px-16 py-10 flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
        <div className="z-10">
          <span className="font-label-md text-primary uppercase tracking-widest mb-1 block">
            Sustainability First
          </span>
          <h1 className="font-display-lg text-[40px] md:text-display-lg text-on-background max-w-2xl leading-tight">
            The Fridge <span className="text-sage italic">Archive</span>
          </h1>
          <p className="font-body-lg text-on-surface-variant mt-3 max-w-lg">
            Track, transform, and eliminate waste. Your digital window into what&apos;s currently
            chilling in the kitchen.
          </p>
        </div>
        <div className="flex gap-10 z-10">
          <div className="flex flex-col">
            <span className="font-label-sm text-on-surface-variant/60 uppercase">
              Active Containers
            </span>
            <div className="flex items-center gap-3">
              <span className="font-headline-lg text-headline-lg text-primary">
                {String(stats.activeCount).padStart(2, "0")}
              </span>
              <svg className="w-12 h-6" fill="none" viewBox="0 0 48 24">
                <path
                  className="text-sage/30"
                  d="M0 20C5 20 7 4 12 4C17 4 19 20 24 20C29 20 31 4 36 4C41 4 43 20 48 20"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  className="text-primary"
                  d="M0 20C5 20 7 4 12 4C17 4 19 20 24 20"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-sm text-on-surface-variant/60 uppercase">Waste Avoided</span>
            <span className="font-headline-lg text-headline-lg text-terracotta">
              {stats.wasteAvoidedKg.toFixed(1)}
              <span className="text-label-md ml-1">kg</span>
            </span>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-sage/5 rounded-full blur-3xl -z-0" />
      </section>

      {/* Bento grid */}
      <section className="px-6 lg:px-16 pb-16">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
          {/* Repurpose AI hero */}
          <div className="lg:col-span-8 group relative overflow-hidden rounded-3xl bg-charcoal text-on-primary p-10 md:p-16 flex flex-col justify-between min-h-[400px] shadow-xl">
            <div className="absolute inset-0 opacity-40 mix-blend-overlay">
              <div
                className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url('${HERO_BG}')` }}
              />
            </div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sage/20 backdrop-blur-md rounded-full mb-6">
                <span className="material-symbols-outlined text-[18px] text-sage">auto_awesome</span>
                <span className="font-label-sm text-sage">Repurpose AI</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg mb-3 max-w-xl">{heroTitle}</h2>
              <p className="font-body-md text-surface-variant max-w-md">{heroBody}</p>
            </div>
            <div className="relative z-10 flex flex-wrap gap-3 mt-8">
              {topRecipe ? (
                <Link
                  href={`/recipes/${topRecipe.id}`}
                  className="bg-primary text-on-primary px-10 py-3 rounded-full font-label-md hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                >
                  Generate Recipe
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => featured && handleSuggest(featured)}
                  disabled={!featured || heroSuggestion.isPending}
                  className="bg-primary text-on-primary px-10 py-3 rounded-full font-label-md hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  Generate Recipe
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => featured && handleSuggest(featured)}
                className="bg-surface/10 backdrop-blur-md text-on-primary px-10 py-3 rounded-full font-label-md hover:bg-surface/20 transition-all"
              >
                View Other Suggestions
              </button>
            </div>
          </div>

          {/* Container cards + add slot */}
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`lg:col-span-4 bg-surface-container-low rounded-3xl p-6 min-h-[320px] animate-pulse ${
                  i === 1 ? "lg:-mt-12" : ""
                }`}
              />
            ))
          ) : (
            <>
              {containers.map((container, index) => (
                <LeftoverCard
                  key={container.id}
                  container={container}
                  imageUrl={
                    container.imageUrl ||
                    PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length]
                  }
                  offset={index === 1}
                  onLogMeal={() => mutate.mutate({ action: "consume", id: container.id })}
                  onSuggest={() => handleSuggest(container)}
                  onDelete={() => mutate.mutate({ action: "delete", id: container.id })}
                />
              ))}

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="lg:col-span-4 bg-surface-container-low border-2 border-dashed border-outline-variant/30 rounded-3xl p-6 flex flex-col items-center justify-center text-center min-h-[300px] hover:bg-surface-container transition-colors group"
              >
                <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-primary text-[32px]">add_box</span>
                </div>
                <h3 className="font-title-lg text-on-background">New Container</h3>
                <p className="text-label-md text-on-surface-variant mt-1">
                  Add leftovers manually from last night&apos;s dinner
                </p>
              </button>
            </>
          )}
        </div>

        {/* Use it or Lose it Priority List */}
        {priorityData?.items && priorityData.items.length > 0 && (
          <div className="max-w-[1280px] mx-auto mt-16">
            <div className="bg-gradient-to-r from-terracotta/10 to-primary/5 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-terracotta/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-terracotta">timer</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-on-surface">Use it or Lose it</h3>
                  <p className="text-label-sm text-on-surface-variant">
                    Combined priority list — cook these first today
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {priorityData.items.slice(0, 9).map((item) => {
                  const urgencyStyle = {
                    expired: "border-error/30 bg-error/5",
                    today: "border-terracotta/40 bg-terracotta/5",
                    soon: "border-terracotta/20 bg-terracotta/3",
                    this_week: "border-outline-variant/30 bg-white/60",
                  }[item.urgency];
                  const urgencyLabel = {
                    expired: "Expired",
                    today: "Eat today",
                    soon: `${item.daysLeft}d left`,
                    this_week: item.daysLeft !== null ? `${item.daysLeft}d left` : "Soon",
                  }[item.urgency];
                  const urgencyTextStyle = {
                    expired: "text-error",
                    today: "text-terracotta font-bold",
                    soon: "text-terracotta",
                    this_week: "text-on-surface-variant",
                  }[item.urgency];

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`flex items-center gap-3 p-4 rounded-2xl border ${urgencyStyle} transition-all`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        item.type === "leftover" ? "bg-primary/10" : "bg-sage/10"
                      }`}>
                        <span className={`material-symbols-outlined text-[18px] ${
                          item.type === "leftover" ? "text-primary" : "text-sage"
                        }`}>
                          {item.type === "leftover" ? "lunch_dining" : "kitchen"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-label-md text-on-surface capitalize truncate">{item.name}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-label-sm ${urgencyTextStyle}`}>{urgencyLabel}</span>
                          <span className="text-label-sm text-on-surface-variant/40">·</span>
                          <span className="text-label-sm text-on-surface-variant capitalize">{item.type}</span>
                        </div>
                      </div>
                      {item.recipeId && (
                        <Link
                          href={`/recipes/${item.recipeId}`}
                          className="shrink-0 text-primary hover:text-terracotta transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-4 text-label-sm text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-primary/20" />
                  <span>Leftover containers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-sage/30" />
                  <span>Expiring pantry items</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recipe suggestions */}
        {recipeResults.length > 0 && (
          <div className="max-w-[1280px] mx-auto mt-16 space-y-6">
            <div className="flex items-center gap-6">
              <div className="h-px flex-1 bg-surface-container-highest" />
              <h3 className="font-headline-md text-primary whitespace-nowrap">Repurpose Ideas</h3>
              <div className="h-px flex-1 bg-surface-container-highest" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recipeResults.map((r) => (
                <Link
                  key={r.id}
                  href={`/recipes/${r.id}`}
                  className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group"
                >
                  <h4 className="font-title-lg text-on-surface group-hover:text-primary transition-colors">
                    {r.title}
                  </h4>
                  <p className="text-label-sm text-on-surface-variant mt-2">
                    {r.matchScore}% match · {r.servings} servings
                  </p>
                  <p className="text-label-sm text-primary mt-2 capitalize">
                    Using: {r.using.join(", ")}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* AI drawer */}
      <div
        className={`fixed bottom-8 right-8 z-50 transition-all duration-500 ${
          showDrawer && drawerData
            ? "translate-y-0 opacity-100"
            : "translate-y-32 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-surface rounded-3xl shadow-2xl p-6 max-w-sm border border-outline-variant/20">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary">auto_awesome</span>
            </div>
            <div>
              <h4 className="font-label-md text-on-background">Repurpose Suggestion</h4>
              <p className="text-label-sm text-on-surface-variant">Based on: {drawerSource}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="ml-auto text-on-surface-variant hover:text-on-surface"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <p className="text-body-md text-on-surface mb-6">{drawerData?.description}</p>
          {drawerData && (
            <Link
              href={`/recipes/${drawerData.recipeId}`}
              className="block w-full text-center bg-charcoal text-on-primary py-3 rounded-full font-label-md hover:opacity-90 transition-opacity"
            >
              Save Recipe
            </Link>
          )}
        </div>
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-on-surface">New Container</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="font-label-sm text-on-surface-variant block mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Thai Red Curry"
                  className="w-full px-4 py-3 rounded-2xl bg-surface-container-low outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-label-sm text-on-surface-variant block mb-1">Servings</label>
                  <input
                    type="number"
                    min={1}
                    value={form.servings}
                    onChange={(e) => setForm({ ...form, servings: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-container-low outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="font-label-sm text-on-surface-variant block mb-1">
                    Shelf life (days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.shelfLifeDays}
                    onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-container-low outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="font-label-sm text-on-surface-variant block mb-1">
                  Tags (comma separated)
                </label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="Vegan, 2 Servings"
                  className="w-full px-4 py-3 rounded-2xl bg-surface-container-low outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!form.name.trim() || mutate.isPending}
              className="w-full py-3 bg-primary text-on-primary rounded-full font-label-md disabled:opacity-50"
            >
              Add to Fridge
            </button>
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
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/pantry">
              Pantry
            </Link>
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/meal-plan">
              Meal Plan
            </Link>
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/shopping">
              Shopping
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LeftoverCard({
  container,
  imageUrl,
  offset,
  onLogMeal,
  onSuggest,
  onDelete,
}: {
  container: LeftoverContainer;
  imageUrl: string;
  offset: boolean;
  onLogMeal: () => void;
  onSuggest: () => void;
  onDelete: () => void;
}) {
  const fresh = freshness(container.expiresAt);
  const percent = shelfLifePercent(container.storedAt, container.expiresAt);
  const showProgress = container.aiSuggestion || percent < 100;

  return (
    <div
      className={`lg:col-span-4 group bg-surface-container-low rounded-3xl p-6 flex flex-col shadow-sm hover:shadow-md transition-all duration-300 ${
        offset ? "lg:-mt-12" : ""
      }`}
    >
      <div className="relative h-48 w-full rounded-2xl overflow-hidden mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="w-full h-full object-cover" alt={container.name} src={imageUrl} />
        <div
          className={`absolute top-3 right-3 backdrop-blur-sm px-3 py-1 rounded-full ${
            fresh.tone === "urgent" ? "bg-error-container/90" : "bg-success-soft/90"
          }`}
        >
          <span
            className={`font-label-sm ${
              fresh.tone === "urgent" ? "text-error uppercase" : "text-primary"
            }`}
          >
            {fresh.label}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-start mb-1">
        <h3 className="font-title-lg text-title-lg text-on-background capitalize">{container.name}</h3>
        <button
          type="button"
          onClick={onDelete}
          className="text-on-surface-variant hover:text-error transition-colors"
          aria-label="Remove container"
        >
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>

      <div className="flex flex-col gap-1 mb-6">
        <div className="flex justify-between text-label-sm">
          <span className="text-on-surface-variant/60">Stored:</span>
          <span className="text-on-surface-variant">
            {format(new Date(container.storedAt), "MMM d, h:mm a")}
          </span>
        </div>
        <div className="flex justify-between text-label-sm">
          <span className="text-on-surface-variant/60">Best Before:</span>
          <span
            className={`font-bold ${
              fresh.tone === "urgent" ? "text-error" : "text-terracotta"
            }`}
          >
            {expiryLabel(container.expiresAt)}
          </span>
        </div>
      </div>

      {container.tags.length > 0 || container.servings ? (
        <div className="mt-auto pt-3 flex flex-wrap gap-2 mb-4">
          {container.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-surface-variant rounded-full text-label-sm text-on-surface-variant capitalize"
            >
              {tag}
            </span>
          ))}
          {container.servings && !container.tags.some((t) => t.includes("serving")) && (
            <span className="px-3 py-1 bg-surface-variant rounded-full text-label-sm text-on-surface-variant">
              {container.servings} Servings
            </span>
          )}
        </div>
      ) : null}

      {showProgress ? (
        <div className="mt-auto">
          <div className="w-full bg-surface-variant rounded-full h-1.5 mb-3">
            <div className="bg-sage h-1.5 rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-label-sm text-on-surface-variant/60 italic">
              {container.aiSuggestion
                ? `AI Suggested: ${container.aiSuggestion}`
                : "Tap for repurpose ideas"}
            </span>
            <button
              type="button"
              onClick={onSuggest}
              className="text-primary hover:text-terracotta transition-colors group/bolt"
            >
              <span className="material-symbols-outlined text-[20px] group-hover/bolt:drop-shadow-[0_0_8px_rgba(226,114,91,0.4)]">
                bolt
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-auto pt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onLogMeal}
            className="text-primary font-label-md flex items-center gap-1 hover:gap-2 transition-all"
          >
            Log Meal
            <span className="material-symbols-outlined text-[18px]">restaurant</span>
          </button>
        </div>
      )}
    </div>
  );
}
