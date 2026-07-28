"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ShoppingCart } from "lucide-react";

interface SharedItem {
  id: string;
  displayName: string;
  quantity?: string | null;
  isChecked: boolean;
  category: string;
}

interface SharedList {
  id: string;
  name: string;
  ownerName?: string | null;
  items: SharedItem[];
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

export default function SharedListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const queryClient = useQueryClient();

  const { data: list, isLoading, isError } = useQuery<SharedList>({
    queryKey: ["shared-list", token],
    queryFn: async () => {
      const res = await fetch(`/api/shared/${token}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const toggle = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/shared/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shared-list", token] }),
  });

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto py-16 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !list) {
    return (
      <div className="text-center py-20">
        <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">This shared list is unavailable.</p>
      </div>
    );
  }

  const checked = list.items.filter((i) => i.isChecked).length;
  const grouped = list.items.reduce((acc, item) => {
    const c = item.category || "other";
    if (!acc[c]) acc[c] = [];
    acc[c].push(item);
    return acc;
  }, {} as Record<string, SharedItem[]>);

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">
          Shared list
        </p>
        <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
        {list.ownerName && (
          <p className="text-sm text-gray-500 mt-1">From {list.ownerName}</p>
        )}
        <p className="text-sm text-gray-400 mt-2">
          {checked}/{list.items.length} done · live updates
        </p>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{
              width: `${list.items.length ? (checked / list.items.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {CATEGORY_LABELS[category] || category}
            </h3>
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle.mutate(item.id)}
                  className={`w-full flex items-center gap-4 p-4 min-h-[64px] rounded-xl border text-left transition-all active:scale-[0.99] ${
                    item.isChecked
                      ? "bg-gray-50 border-gray-100 opacity-60"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center ${
                      item.isChecked
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300"
                    }`}
                  >
                    {item.isChecked && <Check className="w-5 h-5" />}
                  </span>
                  <div>
                    <span
                      className={`font-medium capitalize ${
                        item.isChecked ? "line-through text-gray-400" : "text-gray-800"
                      }`}
                    >
                      {item.displayName}
                    </span>
                    {item.quantity && (
                      <span className="block text-xs text-gray-400">{item.quantity}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
