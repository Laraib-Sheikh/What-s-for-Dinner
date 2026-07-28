"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  suspendedAt: string | null;
  createdAt: string;
  _count: {
    pantryItems: number;
    cookLog: number;
    favorites: number;
    mealPlanEntries: number;
    reviews: number;
  };
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading, isError } = useQuery<AdminUser[]>({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const p = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/users${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    },
  });

  const mutate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full px-3 py-2 border rounded-lg text-sm"
      />

      {isError && (
        <p className="text-sm text-red-500">Admin access required to manage users.</p>
      )}

      {isLoading ? (
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y">
          {users.map((u) => (
            <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">
                  {u.name || "Unnamed"}{" "}
                  {u.suspendedAt && (
                    <span className="text-xs text-red-500 font-normal">· suspended</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{u.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Pantry {u._count.pantryItems} · Cooked {u._count.cookLog} · Favs{" "}
                  {u._count.favorites} · Reviews {u._count.reviews}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={u.role}
                  onChange={(e) =>
                    mutate.mutate({ action: "set-role", id: u.id, role: e.target.value })
                  }
                  className="text-xs border rounded-lg px-2 py-1.5"
                >
                  <option value="user">user</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </select>
                {u.suspendedAt ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => mutate.mutate({ action: "unsuspend", id: u.id })}
                  >
                    Unsuspend
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm("Suspend this user?"))
                        mutate.mutate({ action: "suspend", id: u.id });
                    }}
                  >
                    Suspend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
