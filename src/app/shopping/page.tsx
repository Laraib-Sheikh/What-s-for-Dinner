"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

interface ShoppingListMeta {
  id: string;
  name: string;
  shareToken?: string | null;
  _count?: { items: number };
}

interface ShoppingItem {
  id: string;
  quantity?: string | null;
  isChecked: boolean;
  category: string;
  source: string;
  pantryHint?: string | null;
  customItemName?: string | null;
  displayName: string;
  ingredient?: { id: string; name: string; category: string } | null;
}

interface ShoppingListDetail extends ShoppingListMeta {
  items: ShoppingItem[];
}

interface PantryItem {
  id: string;
  quantityNote?: string | null;
  ingredient: { id: string; name: string; category: string };
}

interface MealPlanEntry {
  plannedDate: string;
  mealSlot: string;
  recipe: { title: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  dairy: "Dairy & Chilled",
  protein: "Protein",
  spice: "Spices",
  grains: "Grains",
  condiments: "Condiments",
  legumes: "Legumes",
  household: "Household",
  other: "Pantry",
};

const CATEGORY_ICONS: Record<string, string> = {
  produce: "psychiatry",
  dairy: "kitchen",
  protein: "egg",
  spice: "spa",
  grains: "grain",
  condiments: "water_drop",
  legumes: "eco",
  household: "home",
  other: "inventory_2",
};

const CATEGORY_ORDER = [
  "produce",
  "dairy",
  "protein",
  "grains",
  "spice",
  "condiments",
  "legumes",
  "household",
  "other",
];

const BASKET_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCVV6rg_S3YKpWIHdTJ3DbHSTY4O4uIP-gow3CyiVHIYFRLMVU862HJiQ7PuOTlSbb-PsPN6WDoVDtftGY2oN_DmbZxoInTtgKM03VUxYFtiQwfO5xqiZHeM35Kmlg1XuQHFauaqHWZCHLBos0L9lYKkIArQ_Fjjcmc27DP9m7GSDZhokecX_qhPVCIRIjV6hKMNOcrQx62riEbItn702Q_1xBw6I11BV8J7GDKam6rQ0heugX_jv3dDpXZX3CRBLn_Ge9642NVb-U";

function parseQty(q?: string | null): number {
  if (!q) return 1;
  const n = parseInt(q, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function formatQty(n: number): string {
  return String(Math.max(1, n));
}

export default function ShoppingPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Budget estimate state
  const [budget, setBudget] = useState("");
  const [budgetResult, setBudgetResult] = useState<{
    items: Array<{ name: string; estimatedCost: string; cheaperAlternative: string | null }>;
    totalEstimate: string;
    currency: string;
    overBudget: boolean;
    budgetTip: string | null;
  } | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  const handleBudgetEstimate = async () => {
    if (!list?.items || list.items.length === 0) return;
    setBudgetLoading(true);
    try {
      const res = await fetch("/api/ai/budget-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: list.items.filter((i) => !i.isChecked).map((i) => ({
            displayName: i.displayName,
            quantity: i.quantity,
          })),
          budget: budget ? parseFloat(budget) : undefined,
        }),
      });
      const data = await res.json();
      setBudgetResult(data);
      setShowBudget(true);
    } catch {
      // silent
    } finally {
      setBudgetLoading(false);
    }
  };

  const { data: lists = [] } = useQuery<ShoppingListMeta[]>({
    queryKey: ["shopping-lists"],
    queryFn: () => fetch("/api/shopping-lists").then((r) => r.json()),
    enabled: !!session,
  });

  useEffect(() => {
    if (!activeListId && lists.length > 0) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);

  const { data: list, isLoading } = useQuery<ShoppingListDetail>({
    queryKey: ["shopping-list", activeListId],
    queryFn: () => fetch(`/api/shopping-lists?id=${activeListId}`).then((r) => r.json()),
    enabled: !!session && !!activeListId,
  });

  const { data: pantryItems = [] } = useQuery<PantryItem[]>({
    queryKey: ["pantry"],
    queryFn: async () => {
      const res = await fetch("/api/pantry");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session,
  });

  const { data: mealEntries = [] } = useQuery<MealPlanEntry[]>({
    queryKey: ["meal-plan-shopping-suggestions"],
    queryFn: async () => {
      const weekStart = new Date();
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      const res = await fetch(`/api/meal-plan?weekStart=${weekStart.toISOString()}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session,
  });

  const mutate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/shopping-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Request failed");
        return data;
      }),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
      if (vars.action === "share" && data.url) {
        setShareUrl(`${window.location.origin}${data.url}`);
      }
    },
  });

  const items = list?.items || [];
  const checkedCount = items.filter((i) => i.isChecked).length;
  const totalCount = items.length;
  const completionPct =
    totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const grouped = useMemo(() => {
    const map: Record<string, ShoppingItem[]> = {};
    for (const item of items) {
      const cat = item.category || "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return CATEGORY_ORDER.filter((c) => map[c]?.length).map((c) => [c, map[c]] as const);
  }, [items]);

  const listNames = useMemo(
    () => new Set(items.map((i) => i.displayName.toLowerCase())),
    [items]
  );

  const smartSuggestions = useMemo(() => {
    const suggestions: Array<{
      name: string;
      subtitle: string;
      icon: string;
      iconBg: string;
      iconColor: string;
    }> = [];

    for (const p of pantryItems) {
      if (p.quantityNote !== "running low" && p.quantityNote !== "a little") continue;
      const name = p.ingredient.name;
      if (listNames.has(name.toLowerCase())) continue;
      suggestions.push({
        name,
        subtitle: "Running low in pantry",
        icon: "opacity",
        iconBg: "bg-primary/10",
        iconColor: "text-primary",
      });
      if (suggestions.length >= 3) break;
    }

    if (suggestions.length < 3 && mealEntries.length > 0) {
      const recipeTitle = mealEntries[0]?.recipe?.title;
      const candidates = ["eggs", "milk", "butter", "onion", "garlic", "spinach", "basil"];
      for (const c of candidates) {
        if (listNames.has(c) || suggestions.some((s) => s.name === c)) continue;
        suggestions.push({
          name: c.charAt(0).toUpperCase() + c.slice(1),
          subtitle: recipeTitle ? `Needed for: ${recipeTitle}` : "From your meal plan",
          icon: c === "eggs" ? "egg" : "eco",
          iconBg: "bg-terracotta/10",
          iconColor: "text-terracotta",
        });
        if (suggestions.length >= 3) break;
      }
    }

    return suggestions.slice(0, 3);
  }, [pantryItems, mealEntries, listNames]);

  const addItem = (name?: string) => {
    const value = (name ?? newItem).trim();
    if (!value || !activeListId) return;
    mutate.mutate({ action: "add", listId: activeListId, name: value });
    setNewItem("");
  };

  const updateQuantity = (id: string, delta: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const next = Math.max(1, parseQty(item.quantity) + delta);
    mutate.mutate({ action: "update", id, quantity: formatQty(next) });
  };

  const handlePrint = () => window.print();

  const handleShare = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    if (activeListId) mutate.mutate({ action: "share", id: activeListId });
  };

  if (!session) {
    return (
      <div className="relative min-h-[70vh] flex items-center justify-center px-6 py-16">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative text-center max-w-md">
          <BrandLogo className="w-16 h-16 mx-auto mb-6 object-contain" />
          <span className="font-label-md text-terracotta uppercase tracking-widest mb-2 block">
            Weekly Provisions
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-3">
            Sign in to manage shopping lists
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
    <div className="relative bg-background text-on-background font-body-md print:pb-0">
      {/* Hero */}
      <section className="relative px-6 lg:px-16 py-16 overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-terracotta/5 rounded-full blur-3xl" />
        <div className="max-w-[1280px] mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
            <div className="space-y-2">
              <span className="font-label-md text-terracotta tracking-widest uppercase">
                Weekly Provisions
              </span>
              <h1 className="font-display-lg text-[40px] md:text-display-lg text-on-background max-w-2xl leading-tight">
                Gathering the <span className="text-primary italic">essentials</span> for your
                kitchen.
              </h1>
              {lists.length > 1 && (
                <div className="flex flex-wrap gap-2 pt-4">
                  {lists.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setActiveListId(l.id)}
                      className={`px-4 py-1.5 rounded-full text-label-sm transition-colors ${
                        activeListId === l.id
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1 px-6 py-3 bg-primary text-on-primary rounded-full font-label-md shadow-md hover:scale-[1.02] active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">print</span>
                Print List
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1 px-6 py-3 bg-surface-container text-on-surface-variant rounded-full font-label-md hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">share</span>
                {copied ? "Copied!" : "Share"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-16 pb-16">
        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-10 order-2 lg:order-1 print:hidden">
          <div className="bg-surface-warm rounded-3xl p-10 space-y-6 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <span className="material-symbols-outlined text-[64px] text-primary">auto_awesome</span>
            </div>
            <div className="space-y-1 relative z-10">
              <h2 className="font-headline-md text-headline-md text-on-surface">Smart Add</h2>
              <p className="font-body-md text-on-surface-variant/80">
                Based on your pantry history and upcoming recipes.
              </p>
            </div>
            <div className="space-y-3 relative z-10">
              {smartSuggestions.length === 0 ? (
                <p className="text-label-md text-on-surface-variant">
                  Your list looks complete — or add items from your meal plan.
                </p>
              ) : (
                smartSuggestions.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-md rounded-2xl hover:bg-white transition-all border border-transparent hover:border-primary/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full ${s.iconBg} flex items-center justify-center shrink-0`}
                      >
                        <span className={`material-symbols-outlined ${s.iconColor} text-[20px]`}>
                          {s.icon}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-label-md text-on-surface capitalize truncate">{s.name}</p>
                        <p className="font-label-sm text-on-surface-variant/60 truncate">
                          {s.subtitle}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addItem(s.name)}
                      className="w-8 h-8 rounded-full border border-primary/20 text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all shrink-0"
                      aria-label={`Add ${s.name}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => mutate.mutate({ action: "generate", listId: activeListId })}
              disabled={mutate.isPending}
              className="relative z-10 w-full py-3 rounded-full border border-primary/20 text-primary font-label-md hover:bg-primary/5 transition-colors"
            >
              Refresh from meal plan
            </button>
          </div>

          <div className="space-y-3">
            <label className="font-label-md text-on-surface-variant px-2">Quick Add Item</label>
            <div className="relative flex items-center">
              <input
                className="w-full bg-surface-container-low rounded-full px-6 py-4 text-body-md outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/40"
                placeholder="e.g. Maldon Sea Salt..."
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
              />
              <button
                type="button"
                onClick={() => addItem()}
                disabled={!newItem.trim()}
                className="absolute right-2 w-10 h-10 bg-charcoal text-on-primary rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
              >
                <span className="material-symbols-outlined">subdirectory_arrow_right</span>
              </button>
            </div>
          </div>

          {/* Budget Estimator */}
          <div className="bg-surface-container-low rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">savings</span>
              <h3 className="font-title-lg text-on-surface">Budget Estimator</h3>
            </div>
            <p className="text-label-sm text-on-surface-variant">
              AI estimates costs and flags cheaper alternatives.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                <input
                  type="number"
                  placeholder="Budget (optional)"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 rounded-full bg-white border border-outline-variant/30 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="button"
                onClick={handleBudgetEstimate}
                disabled={budgetLoading || !list?.items?.length}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-full font-label-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-sm"
              >
                {budgetLoading ? "…" : "Estimate"}
              </button>
            </div>

            {showBudget && budgetResult && (
              <div className="space-y-2">
                <div className={`flex items-center justify-between py-2 px-4 rounded-xl ${
                  budgetResult.overBudget ? "bg-error/10" : "bg-sage/10"
                }`}>
                  <span className="font-label-md text-on-surface">Est. Total</span>
                  <span className={`font-headline-md ${budgetResult.overBudget ? "text-error" : "text-primary"}`}>
                    ${budgetResult.totalEstimate}
                    {budgetResult.overBudget && " ⚠️"}
                  </span>
                </div>
                {budgetResult.budgetTip && (
                  <div className="bg-terracotta/5 rounded-xl px-3 py-2 text-label-sm text-on-surface">
                    💡 {budgetResult.budgetTip}
                  </div>
                )}
                {budgetResult.items.some((i) => i.cheaperAlternative) && (
                  <div className="space-y-1">
                    <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Cheaper options:</p>
                    {budgetResult.items
                      .filter((i) => i.cheaperAlternative)
                      .map((item, idx) => (
                        <div key={idx} className="text-label-sm text-on-surface bg-white rounded-xl px-3 py-2">
                          <span className="capitalize font-medium">{item.name}</span>
                          <span className="text-on-surface-variant"> → </span>
                          <span className="text-primary">{item.cheaperAlternative}</span>
                        </div>
                      ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowBudget(false)}
                  className="w-full text-label-sm text-on-surface-variant hover:text-on-surface"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <div className="bg-primary p-10 rounded-3xl text-on-primary relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-center">
                <span className="font-label-md uppercase tracking-wider opacity-80">
                  List Completion
                </span>
                <span className="font-headline-md">{completionPct}%</span>
              </div>
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-1000 ease-out"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <p className="font-body-md opacity-90 italic">
                &quot;A organized kitchen is a happy heart.&quot;
              </p>
            </div>
            <svg
              className="absolute bottom-0 right-0 w-32 h-32 opacity-10 -mb-8 -mr-8"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="10 5"
              />
            </svg>
          </div>
        </aside>

        {/* List */}
        <div className="lg:col-span-8 space-y-16 order-1 lg:order-2">
          {isLoading ? (
            <div className="space-y-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-4 animate-pulse">
                  <div className="h-6 bg-surface-variant rounded-lg w-1/3 mx-auto" />
                  <div className="h-20 bg-surface-container-low rounded-2xl" />
                  <div className="h-20 bg-surface-container-low rounded-2xl" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 bg-surface-container-low rounded-3xl">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant opacity-40 mb-4 block">
                shopping_cart
              </span>
              <p className="font-body-lg text-on-surface-variant mb-2">This list is empty.</p>
              <p className="text-label-md text-on-surface-variant">
                <Link href="/meal-plan" className="text-primary hover:underline">
                  Generate from meal plan
                </Link>{" "}
                or use Quick Add.
              </p>
            </div>
          ) : (
            grouped.map(([category, categoryItems]) => (
              <div key={category} className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="h-px flex-1 bg-surface-container-highest" />
                  <h3 className="font-headline-md text-primary flex items-center gap-3 whitespace-nowrap">
                    <span className="material-symbols-outlined">
                      {CATEGORY_ICONS[category] || "inventory_2"}
                    </span>
                    {CATEGORY_LABELS[category] || category}
                  </h3>
                  <div className="h-px flex-1 bg-surface-container-highest" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {categoryItems.map((item) => (
                    <ShoppingListRow
                      key={item.id}
                      item={item}
                      onToggle={() => mutate.mutate({ action: "toggle", id: item.id })}
                      onDelete={() => mutate.mutate({ action: "delete", id: item.id })}
                      onQtyChange={(delta) => updateQuantity(item.id, delta)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating basket */}
      {totalCount > 0 && (
        <div className="fixed bottom-8 right-8 hidden xl:block z-20 group print:hidden">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-24 h-24 object-contain relative z-10 drop-shadow-xl group-hover:-translate-y-2 transition-transform duration-500"
              alt="Shopping basket"
              src={BASKET_IMG}
            />
            <div className="absolute -top-2 -right-2 bg-terracotta text-on-primary w-8 h-8 rounded-full flex items-center justify-center text-label-sm font-bold shadow-lg">
              {totalCount - checkedCount}
            </div>
          </div>
        </div>
      )}

      <footer className="w-full bg-surface-container-low py-10 mt-8 print:hidden">
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

function ShoppingListRow({
  item,
  onToggle,
  onDelete,
  onQtyChange,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  onQtyChange: (delta: number) => void;
}) {
  const qty = parseQty(item.quantity);
  const subtitle =
    item.pantryHint === "have_some"
      ? "You have some — might need more"
      : item.pantryHint === "in_pantry"
      ? "Already in pantry"
      : item.source === "meal_plan"
      ? "From meal plan"
      : item.quantity && !/^\d+$/.test(item.quantity)
      ? item.quantity
      : null;

  return (
    <div
      className={`group flex items-center justify-between p-6 rounded-3xl transition-all ${
        item.isChecked
          ? "bg-surface-container-low/50 shadow-none"
          : "bg-white shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <label className="relative flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={item.isChecked}
            onChange={onToggle}
          />
          <div className="w-6 h-6 rounded-md border-2 border-primary/20 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
            <span
              className={`material-symbols-outlined text-white text-[18px] ${
                item.isChecked ? "opacity-100" : "opacity-0"
              }`}
            >
              check
            </span>
          </div>
        </label>
        <div className={`flex flex-col min-w-0 ${item.isChecked ? "opacity-40" : ""}`}>
          <span
            className={`font-body-lg text-on-surface capitalize ${
              item.isChecked ? "line-through" : ""
            }`}
          >
            {item.displayName}
          </span>
          {subtitle && (
            <span className="font-label-sm text-on-surface-variant/60">{subtitle}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-6 shrink-0">
        <div
          className={`flex items-center bg-surface-container-low rounded-full p-1 ${
            item.isChecked ? "opacity-40" : ""
          }`}
        >
          {!item.isChecked && (
            <button
              type="button"
              onClick={() => onQtyChange(-1)}
              disabled={qty <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-colors text-on-surface-variant disabled:opacity-30"
            >
              -
            </button>
          )}
          <span className="px-3 font-label-md text-on-surface min-w-[2ch] text-center">{qty}</span>
          {!item.isChecked && (
            <button
              type="button"
              onClick={() => onQtyChange(1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-colors text-on-surface-variant"
            >
              +
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-on-surface-variant/30 hover:text-error transition-colors print:hidden"
          aria-label="Delete item"
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>
    </div>
  );
}
