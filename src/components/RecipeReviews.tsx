"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Star, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
}

interface ReviewsPayload {
  reviews: Review[];
  averageRating: number;
  count: number;
}

export function RecipeReviews({ recipeId }: { recipeId: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hover, setHover] = useState(0);

  const { data } = useQuery<ReviewsPayload>({
    queryKey: ["reviews", recipeId],
    queryFn: () => fetch(`/api/reviews?recipeId=${recipeId}`).then((r) => r.json()),
  });

  const submit = useMutation({
    mutationFn: () =>
      fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, rating, comment }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", recipeId] });
      setComment("");
    },
  });

  const flag = useMutation({
    mutationFn: (id: string) =>
      fetch("/api/reviews/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }),
  });

  return (
    <div className="mt-10 pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 text-lg">Reviews</h2>
        {data && data.count > 0 && (
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            {data.averageRating} · {data.count} review{data.count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {session && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Your rating</p>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
              >
                <Star
                  className={cn(
                    "w-6 h-6",
                    (hover || rating) >= s
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-200"
                  )}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment…"
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
          />
          <Button
            size="sm"
            disabled={rating === 0}
            loading={submit.isPending}
            onClick={() => submit.mutate()}
          >
            Submit review
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {(data?.reviews || []).length === 0 && (
          <p className="text-sm text-gray-400">No reviews yet. Be the first!</p>
        )}
        {(data?.reviews || []).map((r) => (
          <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.user.name || "Cook"}</span>
                  <span className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-3 h-3",
                          i < r.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-200"
                        )}
                      />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              {session && (
                <button
                  onClick={() => flag.mutate(r.id)}
                  className="p-1.5 text-gray-300 hover:text-red-400"
                  title="Flag review"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
