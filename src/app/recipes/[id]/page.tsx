"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock, Users, Heart, ChefHat, CheckCircle, XCircle,
  ArrowLeft, Star, Sparkles, Plus, Minus, BookOpen, Flame
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CookMode } from "@/components/CookMode";
import { RecipeReviews } from "@/components/RecipeReviews";
import { formatCookTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Instruction {
  step_number: number;
  text: string;
}

interface RecipeIngredient {
  id: string;
  ingredientId: string;
  quantity?: string | null;
  isOptional: boolean;
  have: boolean;
  ingredient: { id: string; name: string; category: string };
}

interface RecipeDetail {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  cuisine?: string | null;
  mealType: string;
  cookTimeMinutes: number;
  servings: number;
  dietaryTags: string[];
  instructions: Instruction[];
  calories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  recipeIngredients: RecipeIngredient[];
  matchScore: number;
  isFavorite: boolean;
}

interface Substitution {
  substitute: string;
  ratio: string;
  notes: string;
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [substitutions, setSubstitutions] = useState<Record<string, Substitution[]>>({});
  const [loadingSub, setLoadingSub] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [cooked, setCooked] = useState(false);
  const [cookMode, setCookMode] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const { data: recipe, isLoading } = useQuery<RecipeDetail>({
    queryKey: ["recipe", id],
    queryFn: () => fetch(`/api/recipes/${id}`).then((r) => r.json()),
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: id }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recipe", id] }),
  });

  const logCook = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cook-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: id, rating: rating || null }),
      });
      return res.json();
    },
    onSuccess: () => {
      setCooked(true);
      queryClient.invalidateQueries({ queryKey: ["cook-log"] });
    },
  });

  const addToMealPlan = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId: id,
          plannedDate: new Date().toISOString(),
          mealSlot: recipe?.mealType || "dinner",
        }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plan"] }),
  });

  const getSubstitution = async (ingredientName: string) => {
    if (substitutions[ingredientName]) {
      setExpandedSub(expandedSub === ingredientName ? null : ingredientName);
      return;
    }
    setLoadingSub(ingredientName);
    setExpandedSub(ingredientName);
    try {
      const res = await fetch("/api/ai/substitutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missingIngredient: ingredientName,
          recipeTitle: recipe?.title,
        }),
      });
      const data = await res.json();
      setSubstitutions((prev) => ({ ...prev, [ingredientName]: data.substitutions }));
    } catch {
      setSubstitutions((prev) => ({
        ...prev,
        [ingredientName]: [{ substitute: "Error loading suggestions", ratio: "", notes: "" }],
      }));
    } finally {
      setLoadingSub(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-64 bg-gray-200 rounded-2xl mb-6" />
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Recipe not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-orange-500 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const required = recipe.recipeIngredients.filter((i) => !i.isOptional);
  const optional = recipe.recipeIngredients.filter((i) => i.isOptional);
  const missing = required.filter((i) => !i.have);

  return (
    <div className="max-w-4xl mx-auto">
      {cookMode && recipe.instructions.length > 0 && (
        <CookMode
          title={recipe.title}
          instructions={recipe.instructions}
          cookTimeMinutes={recipe.cookTimeMinutes}
          onClose={() => setCookMode(false)}
          onComplete={() => setCooked(true)}
        />
      )}

      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to recipes
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-orange-100 to-amber-50">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-72 object-cover"
          />
        ) : (
          <div className="w-full h-72 flex items-center justify-center">
            <ChefHat className="w-24 h-24 text-orange-200" />
          </div>
        )}

        {session && (
          <div className="absolute top-4 right-4 flex gap-2">
            <span
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm",
                recipe.matchScore >= 80
                  ? "bg-green-500/90 text-white"
                  : recipe.matchScore >= 50
                  ? "bg-yellow-500/90 text-white"
                  : "bg-gray-500/80 text-white"
              )}
            >
              {recipe.matchScore}% match
            </span>
          </div>
        )}
      </div>

      {/* Title & Actions */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{recipe.title}</h1>
          {recipe.description && (
            <p className="text-gray-500 mt-2 text-base">{recipe.description}</p>
          )}
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {recipe.instructions.length > 0 && (
            <Button onClick={() => setCookMode(true)}>
              <Flame className="w-4 h-4" />
              Cook Mode
            </Button>
          )}
          {session && (
            <>
              <Button
                variant="outline"
                onClick={() => toggleFavorite.mutate()}
                loading={toggleFavorite.isPending}
              >
                <Heart
                  className={cn("w-4 h-4", recipe.isFavorite ? "fill-red-500 text-red-500" : "")}
                />
                {recipe.isFavorite ? "Saved" : "Save"}
              </Button>
              <Button variant="secondary" onClick={() => addToMealPlan.mutate()} loading={addToMealPlan.isPending}>
                <BookOpen className="w-4 h-4" />
                Plan
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <span className="flex items-center gap-1.5 text-gray-600">
          <Clock className="w-4 h-4 text-orange-500" />
          {formatCookTime(recipe.cookTimeMinutes)}
        </span>
        <span className="flex items-center gap-1.5 text-gray-600">
          <Users className="w-4 h-4 text-orange-500" />
          {recipe.servings * servingMultiplier} servings
        </span>
        {recipe.cuisine && (
          <span className="text-gray-600 capitalize">{recipe.cuisine} cuisine</span>
        )}
        <Badge variant="orange" className="capitalize">{recipe.mealType}</Badge>
        {recipe.dietaryTags.map((tag) => (
          <Badge key={tag} variant="green" className="capitalize">{tag}</Badge>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Ingredients */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Ingredients</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setServingMultiplier(Math.max(0.5, servingMultiplier - 0.5))}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-medium w-8 text-center">{servingMultiplier}x</span>
                <button
                  onClick={() => setServingMultiplier(servingMultiplier + 0.5)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {required.map((ri) => (
                <div key={ri.id}>
                  <div
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg",
                      ri.have ? "bg-green-50" : "bg-red-50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {ri.have ? (
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <div>
                        <span className={cn("text-sm font-medium capitalize", ri.have ? "text-green-800" : "text-red-700")}>
                          {ri.ingredient.name}
                        </span>
                        {ri.quantity && (
                          <span className="text-xs ml-1.5 opacity-70">
                            {scaleQuantity(ri.quantity, servingMultiplier)}
                          </span>
                        )}
                      </div>
                    </div>

                    {!ri.have && session && (
                      <button
                        onClick={() => getSubstitution(ri.ingredient.name)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        title="Get AI substitution"
                      >
                        <Sparkles className="w-3 h-3" />
                        Sub?
                      </button>
                    )}
                  </div>

                  {expandedSub === ri.ingredient.name && (
                    <div className="mt-1 ml-9 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      {loadingSub === ri.ingredient.name ? (
                        <p className="text-xs text-blue-500 animate-pulse">Finding substitutes...</p>
                      ) : substitutions[ri.ingredient.name]?.map((sub, i) => (
                        <div key={i} className="text-xs text-blue-800 mb-2 last:mb-0">
                          <span className="font-semibold capitalize">{sub.substitute}</span>
                          {sub.ratio && <span className="text-blue-600"> · {sub.ratio}</span>}
                          {sub.notes && <p className="text-blue-500 mt-0.5">{sub.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {optional.length > 0 && (
                <>
                  <div className="pt-2 pb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Optional</span>
                  </div>
                  {optional.map((ri) => (
                    <div
                      key={ri.id}
                      className={cn(
                        "flex items-center gap-2.5 p-2.5 rounded-lg opacity-70",
                        ri.have ? "bg-green-50" : "bg-gray-50"
                      )}
                    >
                      {ri.have ? (
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                      )}
                      <span className="text-sm text-gray-600 capitalize">{ri.ingredient.name}</span>
                      {ri.quantity && (
                        <span className="text-xs text-gray-400">
                          {scaleQuantity(ri.quantity, servingMultiplier)}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>

            {session && missing.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">
                  Missing {missing.length} ingredient{missing.length > 1 ? "s" : ""}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    for (const mi of missing) {
                      await fetch("/api/shopping-lists", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "add", name: mi.ingredient.name }),
                      });
                    }
                    router.push("/shopping");
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add missing to grocery list
                </Button>
              </div>
            )}

            {session && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-2">Mark as cooked</p>
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="transition-colors"
                    >
                      <Star
                        className={cn(
                          "w-5 h-5",
                          star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
                        )}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <button onClick={() => setRating(0)} className="text-xs text-gray-400 hover:text-gray-600">
                      clear
                    </button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={cooked ? "secondary" : "primary"}
                  className="w-full"
                  onClick={() => logCook.mutate()}
                  loading={logCook.isPending}
                  disabled={cooked}
                >
                  {cooked ? "✓ Logged!" : "I cooked this!"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-lg">Instructions</h2>
            {recipe.instructions.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {checkedSteps.size}/{recipe.instructions.length} done
                </span>
                <button
                  onClick={() => setCookMode(true)}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                >
                  <Flame className="w-3.5 h-3.5" />
                  Start Cook Mode
                </button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {recipe.instructions.length === 0 ? (
              <p className="text-gray-400 text-sm">No instructions provided for this recipe.</p>
            ) : (
              recipe.instructions.map((step, i) => {
                const isChecked = checkedSteps.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setCheckedSteps((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      });
                    }}
                    className={cn(
                      "w-full flex gap-4 text-left p-3 rounded-xl border transition-all",
                      isChecked
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-gray-100 hover:border-orange-200 hover:bg-orange-50/40"
                    )}
                  >
                    <div
                      className={cn(
                        "shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors",
                        isChecked
                          ? "bg-green-500 text-white"
                          : "bg-orange-500 text-white"
                      )}
                    >
                      {isChecked ? <CheckCircle className="w-4 h-4" /> : step.step_number || i + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <p
                        className={cn(
                          "leading-relaxed transition-colors",
                          isChecked ? "text-gray-400 line-through" : "text-gray-700"
                        )}
                      >
                        {step.text}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {(recipe.calories || recipe.proteinGrams || recipe.carbsGrams || recipe.fatGrams) && (
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {recipe.calories != null && (
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700">
              {recipe.calories} kcal
            </span>
          )}
          {recipe.proteinGrams != null && (
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700">
              P {recipe.proteinGrams}g
            </span>
          )}
          {recipe.carbsGrams != null && (
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700">
              C {recipe.carbsGrams}g
            </span>
          )}
          {recipe.fatGrams != null && (
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700">
              F {recipe.fatGrams}g
            </span>
          )}
        </div>
      )}

      <RecipeReviews recipeId={recipe.id} />
    </div>
  );
}

function scaleQuantity(quantity: string, multiplier: number): string {
  if (multiplier === 1) return quantity;
  const match = quantity.match(/^(\d+(?:\.\d+)?\/?\d*)\s*(.*)/);
  if (!match) return quantity;
  const num = eval(match[1]) as number;
  const unit = match[2];
  const scaled = Math.round(num * multiplier * 4) / 4;
  return `${scaled % 1 === 0 ? scaled : scaled.toFixed(2)} ${unit}`.trim();
}
