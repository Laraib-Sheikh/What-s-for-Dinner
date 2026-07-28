"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, Carrot, ChefHat, Star, Clock } from "lucide-react";
import Link from "next/link";

interface Analytics {
  stats: {
    userCount: number;
    recipeCount: number;
    pendingRecipes: number;
    ingredientCount: number;
    cookCount: number;
    reviewCount: number;
  };
  popularRecipes: Array<{
    id: string;
    title: string;
    _count: { favorites: number; cookLog: number; reviews: number };
  }>;
  topPantry: Array<{
    id: string;
    name: string;
    category: string;
    _count: { pantryItems: number };
  }>;
  matchScoreDistribution: { high: number; mid: number; low: number; total: number };
  recentActions: Array<{
    id: string;
    actionType: string;
    createdAt: string;
    admin: { name: string | null; email: string | null };
  }>;
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["admin-analytics"],
    queryFn: () => fetch("/api/admin/analytics").then((r) => r.json()),
  });

  if (isLoading || !data?.stats) {
    return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const { stats, popularRecipes, topPantry, matchScoreDistribution, recentActions } = data;
  const matchTotal = matchScoreDistribution.total || 1;

  const cards = [
    { label: "Users", value: stats.userCount, icon: Users, href: "/admin/users" },
    { label: "Recipes", value: stats.recipeCount, icon: BookOpen, href: "/admin/recipes" },
    { label: "Pending", value: stats.pendingRecipes, icon: Clock, href: "/admin/moderation" },
    { label: "Ingredients", value: stats.ingredientCount, icon: Carrot, href: "/admin/ingredients" },
    { label: "Cooks logged", value: stats.cookCount, icon: ChefHat },
    { label: "Reviews", value: stats.reviewCount, icon: Star },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const inner = (
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-orange-200 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">{c.label}</span>
                <Icon className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            </div>
          );
          return c.href ? (
            <Link key={c.label} href={c.href}>
              {inner}
            </Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Most popular recipes</h2>
          <div className="space-y-2">
            {popularRecipes.map((r) => (
              <Link
                key={r.id}
                href={`/recipes/${r.id}`}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:text-orange-600"
              >
                <span className="text-sm font-medium truncate pr-3">{r.title}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {r._count.favorites}♥ · {r._count.cookLog} cooks · {r._count.reviews}★
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Common pantry items</h2>
          <div className="space-y-2">
            {topPantry.map((i) => (
              <div key={i.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm capitalize font-medium">{i.name}</span>
                <span className="text-xs text-gray-400">
                  {i._count.pantryItems} users · {i.category}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-2">Match-score distribution</h2>
        <p className="text-xs text-gray-400 mb-4">
          Sampled pantry×recipe matches — are users finding cookable meals?
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Ready (≥80%)", value: matchScoreDistribution.high, color: "bg-green-500" },
            { label: "Partial (50–79%)", value: matchScoreDistribution.mid, color: "bg-yellow-500" },
            { label: "Low (<50%)", value: matchScoreDistribution.low, color: "bg-red-400" },
          ].map((b) => (
            <div key={b.label} className="text-center">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full ${b.color}`}
                  style={{ width: `${(b.value / matchTotal) * 100}%` }}
                />
              </div>
              <div className="text-lg font-bold">{b.value}</div>
              <div className="text-xs text-gray-500">{b.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Recent admin actions</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentActions.length === 0 && (
            <p className="text-sm text-gray-400">No actions yet.</p>
          )}
          {recentActions.map((a) => (
            <div key={a.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
              <span>
                <span className="font-medium">{a.actionType}</span>
                <span className="text-gray-400"> · {a.admin.name || a.admin.email}</span>
              </span>
              <span className="text-xs text-gray-400">
                {new Date(a.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
