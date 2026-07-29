"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { BrandLogo } from "@/components/BrandLogo";

interface QuickSuggestion {
  id: string;
  title: string;
  reason: string;
  cookTimeMinutes: number;
  imageUrl?: string | null;
  mealType: string;
}

interface PhotoScanIngredient {
  name: string;
  selected: boolean;
}

const QUICK_ADD_CHIPS = [
  "eggs", "milk", "butter", "onion", "garlic", "tomato", "potato", "rice",
  "pasta", "chicken", "cheese", "flour", "olive oil", "lemon", "spinach",
  "carrot", "broccoli", "pepper", "salt", "sugar",
];

const FILTER_CATEGORIES = ["all", "produce", "grains", "spice", "dairy", "protein"] as const;

const CATEGORY_ACCENT: Record<string, string> = {
  produce: "from-sage/30 to-primary/10",
  grains: "from-amber-100 to-surface-warm",
  spice: "from-terracotta/20 to-secondary-fixed",
  dairy: "from-sky-100 to-surface-container-low",
  protein: "from-secondary-container/30 to-surface-warm",
  condiments: "from-tertiary-fixed to-surface-container",
  legumes: "from-primary-fixed/40 to-sage/10",
  other: "from-surface-variant to-surface-container-low",
};

const CATEGORY_ICON: Record<string, string> = {
  produce: "nutrition",
  grains: "grain",
  spice: "spa",
  dairy: "water_drop",
  protein: "egg",
  condiments: "kitchen",
  legumes: "eco",
  other: "inventory_2",
};

interface PantryItem {
  id: string;
  quantityNote?: string | null;
  expiresAt?: string | null;
  addedAt: string;
  ingredient: { id: string; name: string; category: string };
}

interface ExpiryAlert {
  pantryItemId: string;
  expiresAt: string;
  ingredient: { id: string; name: string };
  recipes: Array<{ id: string; title: string; cookTimeMinutes: number; imageUrl?: string | null }>;
}

interface ShoppingListSummary {
  id: string;
  name: string;
  _count: { items: number };
}

interface ShoppingListDetail {
  id: string;
  items: Array<{
    id: string;
    checked: boolean;
    quantityNote?: string | null;
    displayName: string;
  }>;
}

function daysUntil(dateStr: string) {
  return differenceInCalendarDays(new Date(dateStr), new Date());
}

function expiryUrgency(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const days = daysUntil(expiresAt);
  if (days < 0) return { label: "Expired", width: 100, tone: "terracotta" as const };
  if (days <= 2) return { label: `${days} Day${days === 1 ? "" : "s"}`, width: 85, tone: "terracotta" as const };
  if (days <= 4) return { label: `${days} Days`, width: 70, tone: "terracotta" as const };
  if (days <= 7) return { label: `${days} Days`, width: 45, tone: "primary" as const };
  return { label: format(new Date(expiresAt), "MMM d"), width: 25, tone: "primary" as const };
}

export default function PantryPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<(typeof FILTER_CATEGORIES)[number]>("all");
  const [showAll, setShowAll] = useState(false);
  const [dismissedInsight, setDismissedInsight] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo scan state
  const [showPhotoScan, setShowPhotoScan] = useState(false);
  const [photoScanIngredients, setPhotoScanIngredients] = useState<PhotoScanIngredient[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Quick suggest state
  const [showQuickSuggest, setShowQuickSuggest] = useState(false);
  const [quickSuggestions, setQuickSuggestions] = useState<QuickSuggestion[]>([]);
  const [quickSuggestLoading, setQuickSuggestLoading] = useState(false);

  const handlePhotoFile = async (file: File) => {
    setScanError(null);
    setScanLoading(true);
    setPhotoScanIngredients([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPhotoPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type || "image/jpeg";

      try {
        const res = await fetch("/api/ai/photo-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType, mode: "pantry" }),
        });
        const data = await res.json();
        if (data.ingredients && Array.isArray(data.ingredients)) {
          setPhotoScanIngredients(data.ingredients.map((name: string) => ({ name, selected: true })));
        } else {
          setScanError("Couldn't identify ingredients. Try a clearer photo.");
        }
      } catch {
        setScanError("Scan failed. Please try again.");
      } finally {
        setScanLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addPhotoScannedItems = useMutation({
    mutationFn: async (names: string[]) => {
      const results = await Promise.allSettled(
        names.map((name) =>
          fetch("/api/pantry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ingredientName: name }),
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setShowPhotoScan(false);
      setPhotoPreview(null);
      setPhotoScanIngredients([]);
    },
  });

  const handleQuickSuggest = async () => {
    setQuickSuggestLoading(true);
    setShowQuickSuggest(true);
    const hour = new Date().getHours();
    const timeOfDay = hour < 11 ? "morning" : hour < 15 ? "afternoon" : "evening";
    try {
      const res = await fetch("/api/ai/quick-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeOfDay }),
      });
      const data = await res.json();
      setQuickSuggestions(data.suggestions || []);
    } catch {
      setQuickSuggestions([]);
    } finally {
      setQuickSuggestLoading(false);
    }
  };

  const { data: pantryItems = [], isLoading } = useQuery<PantryItem[]>({
    queryKey: ["pantry"],
    queryFn: async () => {
      const res = await fetch("/api/pantry");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session,
  });

  const { data: expiryData } = useQuery<{ alerts: ExpiryAlert[] }>({
    queryKey: ["expiry-alerts"],
    queryFn: () => fetch("/api/expiry-alerts").then((r) => r.json()),
    enabled: !!session,
  });

  const { data: shoppingLists = [] } = useQuery<ShoppingListSummary[]>({
    queryKey: ["shopping-lists"],
    queryFn: async () => {
      const res = await fetch("/api/shopping-lists");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session,
  });

  const defaultListId = shoppingLists[0]?.id;
  const { data: shoppingDetail } = useQuery<ShoppingListDetail | null>({
    queryKey: ["shopping-list", defaultListId],
    queryFn: async () => {
      if (!defaultListId) return null;
      return fetch(`/api/shopping-lists?id=${defaultListId}`).then((r) => r.json());
    },
    enabled: !!defaultListId,
  });

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientName: name }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["expiry-alerts"] });
      setInputValue("");
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
      queryClient.invalidateQueries({ queryKey: ["expiry-alerts"] });
    },
  });

  const categories = useMemo(() => {
    const set = new Set(pantryItems.map((p) => p.ingredient.category));
    return set.size;
  }, [pantryItems]);

  const sortedItems = useMemo(() => {
    const list = [...pantryItems].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );
    if (categoryFilter === "all") return list;
    return list.filter((i) => i.ingredient.category === categoryFilter);
  }, [pantryItems, categoryFilter]);

  const visibleItems = showAll ? sortedItems : sortedItems.slice(0, 11);
  const hiddenCount = Math.max(0, sortedItems.length - 11);

  const alerts = expiryData?.alerts ?? [];
  const insight = !dismissedInsight && alerts[0]?.recipes?.[0]
    ? {
        recipe: alerts[0].recipes[0],
        ingredients: alerts.slice(0, 2).map((a) => a.ingredient.name),
        days: daysUntil(alerts[0].expiresAt),
      }
    : !dismissedInsight && pantryItems.length > 0
    ? {
        recipe: null as { id: string; title: string; imageUrl?: string | null } | null,
        ingredients: pantryItems.slice(0, 2).map((p) => p.ingredient.name),
        days: null as number | null,
      }
    : null;

  const shoppingItems = shoppingDetail?.items?.slice(0, 4) ?? [];
  const shoppingCount = shoppingLists[0]?._count?.items ?? shoppingItems.length;

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (value.length > 1) {
      const filtered = QUICK_ADD_CHIPS.filter(
        (chip) =>
          chip.toLowerCase().includes(value.toLowerCase()) &&
          !pantryItems.some((p) => p.ingredient.name.toLowerCase() === chip.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const handleAdd = (name: string) => {
    if (!name.trim() || !session) return;
    addItem.mutate(name.trim());
  };

  if (!session) {
    return (
      <div className="relative min-h-[70vh] flex items-center justify-center px-6 py-16">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-[20%] left-[-5%] w-96 h-96 bg-sage/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-5%] w-[500px] h-[500px] bg-terracotta/5 rounded-full blur-[150px]" />
        </div>
        <div className="relative text-center max-w-md">
          <BrandLogo className="w-16 h-16 mx-auto mb-6 object-contain" />
          <span className="font-label-md text-terracotta uppercase tracking-widest mb-2 block">
            Inventory Management
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-3">
            Sign in to manage your pantry
          </h2>
          <p className="text-on-surface-variant font-body-md mb-8">
            Track what&apos;s in your fridge and get personalized recipe matches.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex px-10 py-3 bg-primary text-on-primary rounded-full font-label-md hover:scale-[1.02] transition-transform"
          >
            Sign in to get started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-background text-on-background font-body-md">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden opacity-30">
        <div className="absolute top-[20%] left-[-5%] w-96 h-96 bg-sage/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[500px] h-[500px] bg-terracotta/5 rounded-full blur-[150px]" />
      </div>

      {/* Header & Quick Add */}
      <section className="px-6 lg:px-16 py-10">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-10">
          <div className="flex-1">
            <span className="font-label-md text-terracotta uppercase tracking-widest mb-1 block">
              Inventory Management
            </span>
            <h1 className="font-display-lg text-[40px] md:text-display-lg text-on-background tracking-tighter leading-tight">
              Your Smart Pantry
            </h1>
            <p className="font-body-lg text-on-surface-variant max-w-xl mt-2 opacity-80">
              Tracking{" "}
              <span className="font-bold text-primary">{pantryItems.length} items</span>
              {categories > 0 && (
                <>
                  {" "}
                  across {categories} categor{categories === 1 ? "y" : "ies"}
                </>
              )}
              . Your ingredients are fresh and ready for creation.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto">
            {/* AI action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowPhotoScan(true); setScanError(null); setPhotoScanIngredients([]); setPhotoPreview(null); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high text-on-surface rounded-full font-label-md hover:bg-surface-variant transition-colors text-sm"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">photo_camera</span>
                Scan Photo
              </button>
              <button
                type="button"
                onClick={handleQuickSuggest}
                className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high text-on-surface rounded-full font-label-md hover:bg-surface-variant transition-colors text-sm"
              >
                <span className="material-symbols-outlined text-[18px] text-terracotta">bolt</span>
                What can I make?
              </button>
            </div>

          <div className="w-full min-w-[280px] md:min-w-[320px] relative">
            <div className="bg-surface-container-low p-2 rounded-full flex items-center shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <div className="flex-1 px-6">
                <span className="text-label-sm text-on-surface-variant block opacity-60">
                  Quick Add
                </span>
                <input
                  ref={inputRef}
                  className="bg-transparent border-none outline-none w-full font-body-md text-on-surface placeholder:text-on-surface-variant/40"
                  placeholder="e.g. garlic, spinach, pasta"
                  type="text"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && inputValue.trim()) handleAdd(inputValue);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleAdd(inputValue)}
                disabled={!inputValue.trim() || addItem.isPending}
                className="bg-primary text-on-primary w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
              >
                <span className="material-symbols-outlined">
                  {addItem.isPending ? "progress_activity" : "add"}
                </span>
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-outline-variant/30 rounded-2xl shadow-lg z-20 overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleAdd(s)}
                    className="w-full text-left px-5 py-2.5 text-sm text-on-surface hover:bg-primary/5 capitalize"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      </section>

      {/* Quick Suggest Panel */}
      {showQuickSuggest && (
        <section className="px-6 lg:px-16 pb-6">
          <div className="max-w-[1280px] mx-auto">
            <div className="bg-gradient-to-br from-terracotta/10 to-primary/5 rounded-3xl p-8 relative overflow-hidden">
              <button
                type="button"
                onClick={() => setShowQuickSuggest(false)}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-terracotta">bolt</span>
                <h3 className="font-headline-md text-on-surface">What can I make right now?</h3>
              </div>
              {quickSuggestLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[0,1,2].map(i => (
                    <div key={i} className="bg-white/50 rounded-2xl h-24 animate-pulse" />
                  ))}
                </div>
              ) : quickSuggestions.length === 0 ? (
                <p className="text-on-surface-variant">No suggestions available. Add more ingredients to your pantry.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {quickSuggestions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/recipes/${s.id}`}
                      className="bg-white rounded-2xl p-5 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-title-lg text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                          {s.title}
                        </h4>
                        <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
                      </div>
                      <p className="text-label-sm text-primary mb-1">{s.reason}</p>
                      <p className="text-label-sm text-on-surface-variant capitalize">
                        {s.mealType} · {s.cookTimeMinutes}min
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Bento grid */}
      <section className="px-6 lg:px-16 pb-16">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* AI Insight */}
          {insight && (
            <div className="md:col-span-8 relative overflow-hidden bg-primary rounded-3xl p-10 flex flex-col md:flex-row gap-10 group">
              <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none">
                <span className="material-symbols-outlined text-[120px] rotate-12">auto_awesome</span>
              </div>
              <div className="relative z-10 flex-1">
                <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-on-primary mb-6">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span className="text-label-sm uppercase">AI Insight</span>
                </div>
                <h2 className="font-headline-lg text-on-primary mb-2">Tonight&apos;s Suggestion</h2>
                <p className="font-body-md text-on-primary/80 mb-10 max-w-md">
                  {insight.recipe ? (
                    <>
                      Based on your{" "}
                      {insight.ingredients.map((name, i) => (
                        <span key={name}>
                          {i > 0 && " and "}
                          <span className="underline decoration-terracotta underline-offset-4 capitalize">
                            {name}
                          </span>
                        </span>
                      ))}
                      {insight.days !== null && insight.days >= 0 && (
                        <> expiring in {insight.days} day{insight.days === 1 ? "" : "s"}</>
                      )}
                      , we recommend{" "}
                      <span className="font-semibold">{insight.recipe.title}</span>.
                    </>
                  ) : (
                    <>
                      You have{" "}
                      {insight.ingredients.map((name, i) => (
                        <span key={name}>
                          {i > 0 && " and "}
                          <span className="underline decoration-terracotta underline-offset-4 capitalize">
                            {name}
                          </span>
                        </span>
                      ))}
                      ready to cook. Browse recipes matched to your pantry.
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-6">
                  <Link
                    href={insight.recipe ? `/recipes/${insight.recipe.id}` : "/recipes"}
                    className="bg-on-primary text-primary px-10 py-3 rounded-full font-label-md hover:shadow-lg transition-all active:scale-95"
                  >
                    {insight.recipe ? "View Recipe" : "Find Recipes"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDismissedInsight(true)}
                    className="text-on-primary border border-white/20 px-10 py-3 rounded-full font-label-md hover:bg-white/10 transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <div className="relative z-10 w-full md:w-64 h-48 md:h-auto min-h-[180px] rounded-2xl overflow-hidden shadow-xl rotate-2 group-hover:rotate-0 transition-transform duration-500 bg-primary-container">
                {insight.recipe?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="w-full h-full object-cover"
                    alt={insight.recipe.title}
                    src={insight.recipe.imageUrl}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-container to-sage">
                    <span className="material-symbols-outlined text-on-primary text-[64px] opacity-80">
                      restaurant
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expiring Soon */}
          <div
            className={`${insight ? "md:col-span-4" : "md:col-span-12"} bg-surface-container-high rounded-3xl p-10 flex flex-col`}
          >
            <div className="flex items-center justify-between mb-10">
              <h3 className="font-title-lg text-on-surface">Expiring Soon</h3>
              {alerts.length > 0 && (
                <span className="bg-terracotta/10 text-terracotta px-3 py-1 rounded-full text-label-sm">
                  {alerts.length} Alert{alerts.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {alerts.length === 0 ? (
              <p className="text-body-md text-on-surface-variant flex-1">
                No expiry alerts right now. Add expiry dates when you stock items to get reminders.
              </p>
            ) : (
              <div className="space-y-6 flex-1">
                {alerts.slice(0, 3).map((alert) => {
                  const urgency = expiryUrgency(alert.expiresAt);
                  return (
                    <div key={alert.pantryItemId} className="flex items-center gap-6 group">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-variant flex-shrink-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          {CATEGORY_ICON[
                            pantryItems.find((p) => p.id === alert.pantryItemId)?.ingredient
                              .category || "other"
                          ] || "nutrition"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-label-md text-on-surface capitalize truncate">
                            {alert.ingredient.name}
                          </p>
                          <p
                            className={`text-label-sm shrink-0 ${
                              urgency?.tone === "terracotta"
                                ? "text-terracotta"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {urgency?.label}
                          </p>
                        </div>
                        <div className="w-full h-1 bg-surface-variant rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              urgency?.tone === "terracotta" ? "bg-terracotta" : "bg-primary/40"
                            }`}
                            style={{ width: `${urgency?.width ?? 40}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Link
              href="/recipes"
              className="mt-16 w-full py-3 border border-outline-variant rounded-full text-label-md text-on-surface-variant hover:bg-surface-variant/50 transition-colors text-center"
            >
              Use before they spoil
            </Link>
          </div>

          {/* Inventory */}
          <div className="md:col-span-12">
            <div className="bg-surface-container-low rounded-3xl p-10 lg:p-16">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16">
                <div>
                  <h2 className="font-headline-md text-on-surface">Pantry Inventory</h2>
                  <div className="flex flex-wrap gap-3 mt-3">
                    {FILTER_CATEGORIES.map((cat) => {
                      const available =
                        cat === "all" ||
                        pantryItems.some((p) => p.ingredient.category === cat);
                      if (!available && cat !== "all") return null;
                      const active = categoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategoryFilter(cat);
                            setShowAll(false);
                          }}
                          className={`px-6 py-1 rounded-full text-label-sm capitalize transition-colors ${
                            active
                              ? "bg-primary text-on-primary"
                              : "bg-surface-variant text-on-surface-variant hover:bg-surface-container-high"
                          }`}
                        >
                          {cat === "spice" ? "Spices" : cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">sort</span>
                  <span className="text-label-md">Sort by: Recently Added</span>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-2xl bg-surface-variant animate-pulse" />
                  ))}
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant opacity-40 mb-3 block">
                    kitchen
                  </span>
                  <p className="text-on-surface-variant">
                    Your pantry is empty. Use Quick Add above to stock ingredients.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {QUICK_ADD_CHIPS.slice(0, 8).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleAdd(chip)}
                        className="px-4 py-1.5 bg-surface-variant text-on-surface rounded-full text-label-sm capitalize hover:bg-primary hover:text-on-primary transition-colors"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {visibleItems.map((item) => {
                      const cat = item.ingredient.category;
                      const low =
                        item.quantityNote === "running low" ||
                        item.quantityNote === "a little";
                      return (
                        <div key={item.id} className="flex flex-col gap-2 group relative">
                          <div
                            className={`relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${
                              CATEGORY_ACCENT[cat] || CATEGORY_ACCENT.other
                            }`}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[40px] text-primary/50 group-hover:scale-110 transition-transform duration-500">
                                {CATEGORY_ICON[cat] || CATEGORY_ICON.other}
                              </span>
                            </div>
                            <div className="absolute top-2 right-2 flex gap-1">
                              <span
                                className={`bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-label-sm shadow-sm ${
                                  low ? "text-terracotta" : "text-primary"
                                }`}
                              >
                                {item.quantityNote || "In stock"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem.mutate(item.id)}
                              className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:text-error"
                              aria-label={`Remove ${item.ingredient.name}`}
                            >
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          </div>
                          <div>
                            <p className="font-label-md text-on-surface capitalize">
                              {item.ingredient.name}
                            </p>
                            <p className="text-label-sm text-on-surface-variant opacity-60 capitalize">
                              {cat}
                              {item.expiresAt
                                ? ` · exp ${format(new Date(item.expiresAt), "MMM d")}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => inputRef.current?.focus()}
                      className="flex flex-col gap-2 group cursor-pointer text-left"
                    >
                      <div className="aspect-square rounded-2xl bg-surface-container-high flex flex-col items-center justify-center border-2 border-dashed border-outline-variant hover:bg-surface-variant/30 transition-colors">
                        <span className="material-symbols-outlined text-[32px] text-on-surface-variant opacity-40 mb-2">
                          add_circle
                        </span>
                        <span className="text-label-sm text-on-surface-variant opacity-60">
                          Add Item
                        </span>
                      </div>
                    </button>
                  </div>

                  {hiddenCount > 0 && !showAll && (
                    <div className="mt-16 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="flex items-center gap-3 text-primary font-label-md hover:gap-6 transition-all"
                      >
                        See {hiddenCount} More Items
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Monthly Waste insight (static brand card) */}
          <div className="md:col-span-4 bg-tertiary-fixed text-on-tertiary-fixed rounded-3xl p-10 flex flex-col justify-between overflow-hidden relative min-h-[240px]">
            <div className="relative z-10">
              <h3 className="font-title-lg mb-2">Kitchen Insight</h3>
              <p className="font-body-md opacity-80 mb-10">
                {alerts.length > 0 ? (
                  <>
                    You have{" "}
                    <span className="font-bold">{alerts.length}</span> item
                    {alerts.length === 1 ? "" : "s"} expiring soon — cook them first to cut waste.
                  </>
                ) : (
                  <>
                    You&apos;re tracking{" "}
                    <span className="font-bold">{pantryItems.length}</span> ingredients. Keep expiry
                    dates updated to reduce waste.
                  </>
                )}
              </p>
              <div className="flex items-end gap-1 h-24">
                {[60, 80, 40, 70, 30].map((h, i) => (
                  <div
                    key={i}
                    className={`w-full rounded-t-sm transition-all duration-1000 ${
                      i === 4 ? "bg-on-tertiary-fixed" : "bg-on-tertiary-fixed/10"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-3 text-label-sm opacity-60">
                <span>WK1</span>
                <span>WK5</span>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 opacity-5 rotate-12 pointer-events-none">
              <span className="material-symbols-outlined text-[160px]">eco</span>
            </div>
          </div>

          {/* Shopping list preview */}
          <div className="md:col-span-8 bg-surface-container rounded-3xl p-10 flex flex-col md:flex-row gap-10">
            <div className="flex-1">
              <h3 className="font-title-lg text-on-surface mb-6">Shopping List Preview</h3>
              <p className="text-body-md text-on-surface-variant mb-10">
                Items from your list — keep the pantry topped up for upcoming meals.
              </p>
              {shoppingItems.length === 0 ? (
                <p className="text-label-md text-on-surface-variant">
                  No shopping items yet. Generate a list from your meal plan or recipes.
                </p>
              ) : (
                <ul className="space-y-2">
                  {shoppingItems.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-6 p-3 bg-white/40 rounded-2xl ${
                        item.checked ? "opacity-60 grayscale" : ""
                      }`}
                    >
                      <span className="material-symbols-outlined text-primary">
                        {item.checked ? "check_box" : "check_box_outline_blank"}
                      </span>
                      <span
                        className={`font-label-md text-on-surface flex-1 capitalize ${
                          item.checked ? "line-through" : ""
                        }`}
                      >
                        {item.displayName}
                      </span>
                      {item.quantityNote && (
                        <span className="text-label-sm text-on-surface-variant">
                          {item.quantityNote}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="md:w-1/3 bg-white/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-on-primary-container text-[28px]">
                  shopping_cart
                </span>
              </div>
              <p className="font-label-md text-on-surface mb-1">
                {shoppingCount} Item{shoppingCount === 1 ? "" : "s"} in List
              </p>
              <Link
                href="/shopping"
                className="text-primary font-label-md underline underline-offset-4 hover:opacity-80"
              >
                Open Shopping List
              </Link>
            </div>
          </div>
        </div>
      </section>

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
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/shopping">
              Shopping
            </Link>
            <Link className="text-label-sm text-on-surface-variant hover:text-primary" href="/meal-plan">
              Meal Plan
            </Link>
          </div>
        </div>
      </footer>

      {/* Hidden file input for photo scan */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoFile(file);
          e.target.value = "";
        }}
      />

      {/* Photo Scan Modal */}
      {showPhotoScan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-surface-variant">
              <div>
                <h3 className="font-headline-md text-on-surface">AI Pantry Scanner</h3>
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  Snap your fridge or pantry — AI identifies ingredients automatically
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowPhotoScan(false); setPhotoPreview(null); setPhotoScanIngredients([]); }}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!photoPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-primary/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[48px] text-primary/50">add_a_photo</span>
                  <span className="font-label-md text-on-surface-variant">Tap to take photo or upload</span>
                </button>
              ) : (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Scanned" className="w-full h-48 object-cover rounded-2xl" />
                  {scanLoading && (
                    <div className="absolute inset-0 bg-charcoal/50 rounded-2xl flex items-center justify-center">
                      <div className="text-center text-on-primary">
                        <span className="material-symbols-outlined text-[40px] animate-spin block mb-2">progress_activity</span>
                        <p className="font-label-md">Identifying ingredients…</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {scanError && (
                <p className="text-label-md text-error text-center">{scanError}</p>
              )}

              {photoScanIngredients.length > 0 && (
                <div className="space-y-3">
                  <p className="font-label-md text-on-surface-variant uppercase tracking-wider text-sm">
                    Found {photoScanIngredients.filter(i => i.selected).length} ingredients — tap to deselect
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {photoScanIngredients.map((item, idx) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          setPhotoScanIngredients(prev =>
                            prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p)
                          );
                        }}
                        className={`px-4 py-2 rounded-full text-label-sm font-label-md capitalize transition-all ${
                          item.selected
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container-high text-on-surface-variant line-through"
                        }`}
                      >
                        {item.selected ? "✓ " : ""}{item.name}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const selected = photoScanIngredients.filter(i => i.selected).map(i => i.name);
                      if (selected.length > 0) addPhotoScannedItems.mutate(selected);
                    }}
                    disabled={addPhotoScannedItems.isPending || photoScanIngredients.filter(i => i.selected).length === 0}
                    className="w-full py-3 bg-primary text-on-primary rounded-full font-label-md disabled:opacity-50"
                  >
                    {addPhotoScannedItems.isPending
                      ? "Adding…"
                      : `Add ${photoScanIngredients.filter(i => i.selected).length} Ingredients to Pantry`}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPhotoPreview(null); setPhotoScanIngredients([]); fileInputRef.current?.click(); }}
                    className="w-full py-2 text-on-surface-variant text-label-sm hover:text-on-surface"
                  >
                    Retake photo
                  </button>
                </div>
              )}

              {!photoPreview && (
                <p className="text-center text-label-sm text-on-surface-variant">
                  Works best with a clear, well-lit photo of your fridge or shelf
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
