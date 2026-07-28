"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Clock, Users, ChefHat } from "lucide-react";
import { Badge } from "./ui/Badge";
import { cn, formatCookTime } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

interface Recipe {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  cuisine?: string | null;
  mealType: string;
  cookTimeMinutes: number;
  servings: number;
  dietaryTags: string[];
  matchScore?: number;
  missingCount?: number;
  missingIngredients?: string[];
  isFavorite?: boolean;
}

interface RecipeCardProps {
  recipe: Recipe;
  showMatch?: boolean;
}

export function RecipeCard({ recipe, showMatch = true }: RecipeCardProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [heartPop, setHeartPop] = useState(false);

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: recipe.id }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const score = recipe.matchScore ?? 0;

  return (
    <div className="recipe-card bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group">
      <Link href={`/recipes/${recipe.id}`} className="block">
        <div className="relative h-44 bg-gradient-to-br from-orange-100 to-amber-50 overflow-hidden">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat className="w-16 h-16 text-orange-200" />
            </div>
          )}

          {showMatch && session && (
            <div
              className={cn(
                "absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm",
                score >= 80
                  ? "bg-green-500/90 text-white"
                  : score >= 50
                  ? "bg-yellow-500/90 text-white"
                  : "bg-gray-500/80 text-white"
              )}
            >
              {score}% match
            </div>
          )}

          {recipe.missingCount === 1 && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/90 text-white backdrop-blur-sm">
              Almost there!
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/recipes/${recipe.id}`} className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 line-clamp-1 hover:text-orange-600 transition-colors">
              {recipe.title}
            </h3>
            {recipe.description && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{recipe.description}</p>
            )}
          </Link>

          {session && (
            <button
              onClick={() => {
                setHeartPop(true);
                setTimeout(() => setHeartPop(false), 350);
                toggleFavorite.mutate();
              }}
              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title={recipe.isFavorite ? "Remove from favorites" : "Save to favorites"}
            >
              <Heart
                className={cn(
                  "w-4 h-4 transition-colors",
                  recipe.isFavorite ? "fill-red-500 text-red-500" : "text-gray-400",
                  heartPop && "animate-heart-pop"
                )}
              />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatCookTime(recipe.cookTimeMinutes)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {recipe.servings} servings
          </span>
          {recipe.cuisine && <span className="capitalize">{recipe.cuisine}</span>}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge variant="orange" className="capitalize">{recipe.mealType}</Badge>
          {recipe.dietaryTags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="green" className="capitalize">
              {tag}
            </Badge>
          ))}
        </div>

        {showMatch && session && recipe.missingIngredients && recipe.missingIngredients.length > 0 && (
          <div className="mt-3">
            <div className="match-bar">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-orange-400"
                )}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Missing: {recipe.missingIngredients.slice(0, 3).join(", ")}
              {recipe.missingIngredients.length > 3 && ` +${recipe.missingIngredients.length - 3} more`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
