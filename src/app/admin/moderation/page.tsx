"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface ModerationData {
  pendingRecipes: Array<{
    id: string;
    title: string;
    description?: string | null;
    createdAt: string;
    submitter?: { name: string | null; email: string | null } | null;
    recipeIngredients: Array<{ ingredient: { name: string } }>;
  }>;
  flaggedReviews: Array<{
    id: string;
    rating: number;
    comment?: string | null;
    user: { name: string | null; email: string | null };
    recipe: { id: string; title: string };
  }>;
}

export default function AdminModerationPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ModerationData>({
    queryKey: ["admin-moderation"],
    queryFn: () => fetch("/api/admin/moderation").then((r) => r.json()),
  });

  const recipeMutate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/admin/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
  });

  const reviewMutate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-moderation"] }),
  });

  if (isLoading || !data) {
    return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">
          Pending recipes ({data.pendingRecipes.length})
        </h2>
        {data.pendingRecipes.length === 0 ? (
          <p className="text-sm text-gray-400">No submissions waiting.</p>
        ) : (
          <div className="space-y-3">
            {data.pendingRecipes.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{r.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      by {r.submitter?.name || r.submitter?.email || "unknown"} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    {r.description && (
                      <p className="text-sm text-gray-600 mt-2">{r.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2 capitalize">
                      {r.recipeIngredients.map((i) => i.ingredient.name).join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => recipeMutate.mutate({ action: "approve", id: r.id })}
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => recipeMutate.mutate({ action: "reject", id: r.id })}
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-3">
          Flagged reviews ({data.flaggedReviews.length})
        </h2>
        {data.flaggedReviews.length === 0 ? (
          <p className="text-sm text-gray-400">No flagged reviews.</p>
        ) : (
          <div className="space-y-3">
            {data.flaggedReviews.map((rev) => (
              <div key={rev.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm">
                  <span className="font-medium">{rev.rating}/5</span> on{" "}
                  <Link href={`/recipes/${rev.recipe.id}`} className="text-orange-600">
                    {rev.recipe.title}
                  </Link>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {rev.user.name || rev.user.email}
                </p>
                {rev.comment && <p className="text-sm text-gray-700 mt-2">{rev.comment}</p>}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => reviewMutate.mutate({ action: "clear-flag", id: rev.id })}
                  >
                    Keep & clear flag
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => reviewMutate.mutate({ action: "delete-review", id: rev.id })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
