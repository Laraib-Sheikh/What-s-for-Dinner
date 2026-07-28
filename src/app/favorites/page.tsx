"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface FavoriteRecipe {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  cuisine?: string | null;
  mealType: string;
  cookTimeMinutes: number;
  servings: number;
  dietaryTags: string[];
  matchScore: number;
  isFavorite: boolean;
  savedAt: string;
}

export default function FavoritesPage() {
  const { data: session } = useSession();

  const { data: favorites = [], isLoading } = useQuery<FavoriteRecipe[]>({
    queryKey: ["favorites"],
    queryFn: () => fetch("/api/favorites").then((r) => r.json()),
    enabled: !!session,
  });

  if (!session) {
    return (
      <div className="text-center py-20">
        <Heart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Sign in to see your favorites</h2>
        <Link href="/auth/signin"><Button>Sign in</Button></Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500" />
            Saved Recipes
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{favorites.length} saved recipes</p>
        </div>
        <Link href="/">
          <Button variant="secondary" size="sm">Browse all recipes</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">No saved recipes yet</h3>
          <p className="text-sm text-gray-400 mt-1 mb-6">
            Tap the heart icon on any recipe to save it here
          </p>
          <Link href="/"><Button>Explore Recipes</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {favorites.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
