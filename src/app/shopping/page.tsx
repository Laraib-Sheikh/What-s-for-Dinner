"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  ShoppingCart, Plus, Trash2, Check, Share2, Copy, RefreshCw,
  ListPlus, Store, X, Link2Off,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

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

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  dairy: "Dairy",
  protein: "Protein",
  spice: "Spices",
  grains: "Grains",
  condiments: "Condiments",
  legumes: "Legumes",
  household: "Household",
  other: "Other",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

export default function ShoppingPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [storeMode, setStoreMode] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    refetchInterval: storeMode ? 4000 : false,
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
        const url = `${window.location.origin}${data.url}`;
        setShareUrl(url);
      }
      if (vars.action === "unshare") setShareUrl(null);
      if (vars.action === "create-list" && data.id) {
        setActiveListId(data.id);
        setShowNewList(false);
        setNewListName("");
      }
    },
  });

  const items = list?.items || [];
  const checkedCount = items.filter((i) => i.isChecked).length;
  const totalCount = items.length;

  const grouped = useMemo(() => {
    const map: Record<string, ShoppingItem[]> = {};
    for (const item of items) {
      const cat = item.category || "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return CATEGORY_ORDER.filter((c) => map[c]?.length).map((c) => [c, map[c]] as const);
  }, [items]);

  const addItem = () => {
    if (!newItem.trim() || !activeListId) return;
    mutate.mutate({
      action: "add",
      listId: activeListId,
      name: newItem.trim(),
      quantity: newQuantity || undefined,
      custom: isCustom,
    });
    setNewItem("");
    setNewQuantity("");
  };

  const copyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!session) {
    return (
      <div className="text-center py-20">
        <ShoppingCart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Sign in to manage shopping lists</h2>
        <Link href="/auth/signin"><Button>Sign in</Button></Link>
      </div>
    );
  }

  return (
    <div className={`mx-auto ${storeMode ? "max-w-xl" : "max-w-3xl"}`}>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-orange-500" />
            Shopping Lists
          </h1>
          {totalCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {checkedCount}/{totalCount} checked · {list?.name}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={storeMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStoreMode(!storeMode)}
          >
            <Store className="w-3.5 h-3.5" />
            {storeMode ? "Exit store mode" : "Store mode"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => mutate.mutate({ action: "generate", listId: activeListId })}
            loading={mutate.isPending && mutate.variables?.action === "generate"}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            From meal plan
          </Button>
        </div>
      </div>

      {/* List switcher */}
      {!storeMode && (
        <div className="flex gap-2 mb-5 flex-wrap items-center">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveListId(l.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeListId === l.id
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
              }`}
            >
              {l.name}
              {l._count && (
                <span className="ml-1.5 opacity-70">({l._count.items})</span>
              )}
            </button>
          ))}
          <button
            onClick={() => setShowNewList(true)}
            className="px-3 py-2 rounded-xl text-sm border border-dashed border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-600 flex items-center gap-1"
          >
            <ListPlus className="w-4 h-4" />
            New list
          </button>
        </div>
      )}

      {showNewList && (
        <div className="flex gap-2 mb-4">
          <input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder='e.g. "Monthly stock-up"'
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            autoFocus
          />
          <Button
            size="sm"
            onClick={() => mutate.mutate({ action: "create-list", name: newListName || "New list" })}
          >
            Create
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowNewList(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Progress */}
      {totalCount > 0 && (
        <div className="mb-5">
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Share + actions */}
      {!storeMode && activeListId && (
        <div className="flex flex-wrap gap-2 mb-5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => mutate.mutate({ action: "share", id: activeListId })}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share list
          </Button>
          {list?.shareToken && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => mutate.mutate({ action: "unshare", id: activeListId })}
            >
              <Link2Off className="w-3.5 h-3.5" />
              Stop sharing
            </Button>
          )}
          {checkedCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => mutate.mutate({ action: "clear-checked", listId: activeListId })}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear checked
            </Button>
          )}
          {lists.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 ml-auto"
              onClick={() => {
                if (confirm("Delete this list?")) {
                  mutate.mutate({ action: "delete-list", id: activeListId });
                  setActiveListId(null);
                }
              }}
            >
              Delete list
            </Button>
          )}
        </div>
      )}

      {shareUrl && (
        <div className="mb-5 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent text-sm text-blue-800 outline-none"
          />
          <Button size="sm" variant="secondary" onClick={copyShare}>
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <button onClick={() => setShareUrl(null)} className="p-1 text-blue-400 hover:text-blue-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add item */}
      {!storeMode && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder={isCustom ? "Paper towels, dish soap…" : "Add ingredient…"}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="text"
              placeholder="Qty"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <Button onClick={addItem} size="sm" disabled={!newItem.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={isCustom}
              onChange={(e) => setIsCustom(e.target.checked)}
              className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            Non-food / household item (not linked to pantry)
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>This list is empty.</p>
          <p className="text-sm mt-1">
            <Link href="/meal-plan" className="text-orange-500 hover:underline">
              Generate from meal plan
            </Link>{" "}
            or add items above.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, categoryItems]) => (
            <div key={category}>
              {!storeMode && (
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {CATEGORY_LABELS[category] || category}{" "}
                  <span className="font-normal text-gray-400">({categoryItems.length})</span>
                </h3>
              )}
              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      mutate.mutate({ action: "toggle", id: item.id })
                    }
                    className={`w-full flex items-center gap-3 rounded-xl border text-left transition-all ${
                      storeMode ? "p-4 min-h-[64px]" : "p-3"
                    } ${
                      item.isChecked
                        ? "bg-gray-50 border-gray-100 opacity-60"
                        : "bg-white border-gray-200 hover:border-orange-200 active:scale-[0.99]"
                    }`}
                  >
                    <span
                      className={`shrink-0 flex items-center justify-center rounded-lg border-2 transition-colors ${
                        storeMode ? "w-8 h-8" : "w-6 h-6"
                      } ${
                        item.isChecked
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300"
                      }`}
                    >
                      {item.isChecked && <Check className={storeMode ? "w-5 h-5" : "w-3.5 h-3.5"} />}
                    </span>

                    <div className="flex-1 min-w-0">
                      <span
                        className={`font-medium capitalize block ${
                          storeMode ? "text-base" : "text-sm"
                        } ${item.isChecked ? "line-through text-gray-400" : "text-gray-800"}`}
                      >
                        {item.displayName}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {item.quantity && (
                          <span className="text-xs text-gray-400">{item.quantity}</span>
                        )}
                        {item.pantryHint === "have_some" && (
                          <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            You have some — might need more
                          </span>
                        )}
                        {item.pantryHint === "in_pantry" && (
                          <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                            In pantry
                          </span>
                        )}
                        {item.source === "meal_plan" && !storeMode && (
                          <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                            meal plan
                          </span>
                        )}
                        {storeMode && (
                          <span className="text-xs text-gray-400 capitalize">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {!storeMode && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          mutate.mutate({ action: "delete", id: item.id });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            mutate.mutate({ action: "delete", id: item.id });
                          }
                        }}
                        className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
