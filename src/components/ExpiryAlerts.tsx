"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface ExpiryAlert {
  pantryItemId: string;
  expiresAt: string;
  ingredient: { id: string; name: string };
  recipes: Array<{ id: string; title: string; cookTimeMinutes: number }>;
}

export function ExpiryAlerts() {
  const { data: session } = useSession();
  const { data } = useQuery<{ alerts: ExpiryAlert[] }>({
    queryKey: ["expiry-alerts"],
    queryFn: () => fetch("/api/expiry-alerts").then((r) => r.json()),
    enabled: !!session,
  });

  if (!session || !data?.alerts?.length) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-amber-900">Expiring soon</h2>
      </div>
      <div className="space-y-3">
        {data.alerts.slice(0, 3).map((alert) => (
          <div key={alert.pantryItemId}>
            <p className="text-sm text-amber-900">
              <span className="font-semibold capitalize">{alert.ingredient.name}</span>
              {" "}expires {format(new Date(alert.expiresAt), "MMM d")}
              {alert.recipes.length > 0 && " — try:"}
            </p>
            {alert.recipes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {alert.recipes.map((r) => (
                  <Link
                    key={r.id}
                    href={`/recipes/${r.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-medium text-amber-900 hover:border-amber-400"
                  >
                    {r.title}
                    <span className="text-amber-500 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {r.cookTimeMinutes}m
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
