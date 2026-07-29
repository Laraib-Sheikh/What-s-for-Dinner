"use client";

import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { formatCookTime } from "@/lib/utils";

const HERO_BG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCVepkyuTQJYaiQbKsOxbq52rI1DYsavLcDRNItzTs9x0cUizxBOAtR6WQeaFlv7blqviUuFnRPYYcJPCubwGNfjKysKzAUXDnhBuNj5P7rx3bmX4a8LmVOzXrFsQghdTeNqnlHGkngphWTDXAwci2G6xLWtAjj4HrHh74rFb8MwqkQfClhXAUtoN6p61zTszHIUTEGnEVi40lFW6-MAT0jkEiudEsK2iE-PBqPGXfgVkpE3s2kMN1K0zLzRc6FR8ouJIazn-FhHH4";

const PLACEHOLDER_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDyQpGCsgIUhehDmFZRNQdAqLyZ7f7COXVLgDbpO_PFrmRWOJnmCjQ0bPHHpgeFzlJ1bLI4sIxI4uj8VCh7qAkgm6Z6lRnIeCu4OYUP7n1tXHC2g6G1bTDxrueWMmodNaVl1mi6Sjf1QcyTCyaXKK87KXRTVvayAGJ-5NjG5-u0BWfoMUTTssZLK3_URC1ZA34ami8dlfHbsXYjaVdhrRc-e1OCX_QqqCY58WV2UooQkq5LsYfOwc0RM3HXuAJmOsa27na8vpxdHD0",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCximCHgDZ1fU1DzkvsUL0AdiQORtCQ0y8bYBZsybKwmBWPhw8nzJ5kzOzHSVVAFAP3MMlgi6smfDfYdRlQDPGGjzzXsSPJjp7ajZCCuVOIuHm53HSpor9jLiXyGyOYgSx7Ak5kZhxSDWjHxch4Z2RaUGbMLIU2zUqPOrYHWKZpVjV2acKrw00xwyjcwSNhC1faFtxcGLMWDxyNKKEAss5ovMuyqRGhen9bFRgWtXcK85lBbsb7Zhuc6Uyu9NVc3FWT1mODmUp2wy4",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBzLH9CBQods_ev9gl-4371EQzrsKOM-4IdDT7nopRAhXmAg3wneSdtt0-xiw1N58yOwLWfAMtIs2IwJo7mreEi7PPZitlIftVhNDXO2SLPLoF_L2jR-exNRYSlfnZX-U6FiXmJeE9qpjx3jJC_YBU7ZF55WlQ-fCM2_BY6Rkj7IXOVRDfAXPsu9PLOeCYwQfqqw199tr43gdASFl7onFoO0JXNqW38cgosOKTWRVn90REUIYbc4Jxz8q29VWj-hF6_bBd_daVXdr4",
];

type CategoryKey =
  | "all"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "vegan"
  | "quick";

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "all", label: "All Recipes" },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
  { key: "vegan", label: "Vegan" },
  { key: "quick", label: "Quick Meals" },
];

interface RecipeWithMatch {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  cuisine?: string | null;
  mealType: string;
  cookTimeMinutes: number;
  servings: number;
  dietaryTags: string[];
  calories?: number | null;
  matchScore: number;
  missingCount: number;
  missingIngredients: string[];
  isFavorite: boolean;
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function recipeImage(recipe: RecipeWithMatch, index: number) {
  return recipe.imageUrl || PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
}

function difficultyLabel(minutes: number) {
  if (minutes <= 20) return "Easy";
  if (minutes <= 45) return "Medium";
  return "Expert";
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<RecipesPageSkeleton />}>
      <RecipesPageContent />
    </Suspense>
  );
}

function RecipesPageSkeleton() {
  return (
    <div className="bg-oat-milk min-h-screen animate-pulse">
      <div className="h-[520px] bg-surface-variant" />
      <div className="max-w-[1280px] mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-6 h-[600px]" />
    </div>
  );
}

function RecipesPageContent() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const seasonalRef = useRef<HTMLDivElement>(null);
  const allRecipesRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [heroSearch, setHeroSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const [category, setCategory] = useState<CategoryKey>("all");
  const [email, setEmail] = useState("");

  // Craving search state
  const [cravingInput, setCravingInput] = useState("");
  const [cravingResults, setCravingResults] = useState<RecipeWithMatch[] | null>(null);
  const [cravingLoading, setCravingLoading] = useState(false);
  const [showCravingResults, setShowCravingResults] = useState(false);

  const handleCravingSearch = async () => {
    if (!cravingInput.trim()) return;
    setCravingLoading(true);
    setShowCravingResults(true);
    try {
      const res = await fetch("/api/ai/craving-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ craving: cravingInput }),
      });
      const data = await res.json();
      setCravingResults(data.recipes || []);
    } catch {
      setCravingResults([]);
    } finally {
      setCravingLoading(false);
    }
  };

  const mealType =
    category === "breakfast" || category === "lunch" || category === "dinner" || category === "snack"
      ? category
      : "";
  const dietaryTag = category === "vegan" ? "vegan" : "";
  const maxTime = category === "quick" ? "30" : "";

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (mealType) params.set("mealType", mealType);
  if (dietaryTag) params.set("dietaryTag", dietaryTag);
  if (maxTime) params.set("maxTime", maxTime);

  const { data: recipes = [], isLoading, isError } = useQuery<RecipeWithMatch[]>({
    queryKey: ["recipes", debouncedSearch, mealType, dietaryTag, maxTime],
    queryFn: async () => {
      const res = await fetch(`/api/recipes?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Failed to load recipes");
      return Array.isArray(data) ? data : [];
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: (recipeId: string) =>
      fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const bentoRecipes = useMemo(() => recipes.slice(0, 4), [recipes]);
  const seasonalRecipes = useMemo(() => recipes.slice(4, 7), [recipes]);
  const gridRecipes = useMemo(() => recipes.slice(7), [recipes]);

  const applyHeroSearch = () => setSearch(heroSearch.trim());

  const scrollSeasonal = (dir: "left" | "right") => {
    if (!seasonalRef.current) return;
    seasonalRef.current.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  return (
    <div className="bg-oat-milk text-on-surface font-body-md">
      {/* Hero */}
      <section className="relative w-full min-h-[520px] md:h-[614px] flex items-center justify-center overflow-hidden -mt-16 pt-16">
        <div className="absolute inset-0 bg-charcoal/20 z-10" />
        <div
          className="absolute inset-0 bg-cover bg-center animate-subtle-zoom"
          style={{ backgroundImage: `url('${HERO_BG}')` }}
        />
        <div className="relative z-20 w-full max-w-4xl px-6 text-center space-y-10">
          <div className="space-y-3">
            <span className="inline-block px-4 py-1 rounded-full bg-sage/20 backdrop-blur-md text-white font-label-md uppercase tracking-[0.2em]">
              Curated for you
            </span>
            <h1 className="font-display-lg text-[36px] md:text-display-lg text-white drop-shadow-sm">
              Find your next kitchen masterpiece
            </h1>
          </div>
          <div className="relative group max-w-2xl mx-auto">
            <input
              className="w-full bg-surface/90 backdrop-blur-xl border-none rounded-full py-5 md:py-6 pl-14 md:pl-16 pr-32 md:pr-40 text-body-md md:text-body-lg focus:ring-4 focus:ring-sage/30 transition-all outline-none text-charcoal shadow-xl"
              placeholder="Search ingredients, cuisines, or chefs..."
              type="text"
              value={heroSearch}
              onChange={(e) => setHeroSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyHeroSearch()}
            />
            <span className="material-symbols-outlined absolute left-5 md:left-6 top-1/2 -translate-y-1/2 text-sage text-[24px] md:text-[28px]">
              search
            </span>
            <button
              type="button"
              onClick={applyHeroSearch}
              className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 bg-primary text-on-primary px-5 md:px-6 py-2.5 md:py-3 rounded-full font-label-md hover:bg-sage transition-all shadow-lg active:scale-95"
            >
              Explore
            </button>
          </div>
        </div>
      </section>

      {/* Craving Search */}
      <section className="relative z-25 px-6 max-w-[1280px] mx-auto w-full mt-6">
        <div className="bg-surface-container-low rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-terracotta/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-terracotta text-[18px]">psychology</span>
            </div>
            <div>
              <h3 className="font-title-lg text-on-surface">Search by craving</h3>
              <p className="text-label-sm text-on-surface-variant">
                Describe what you&apos;re in the mood for — AI finds the perfect match
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. something spicy and comforting, quick weeknight pasta..."
              value={cravingInput}
              onChange={(e) => setCravingInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCravingSearch()}
              className="flex-1 bg-white px-5 py-3 rounded-full text-body-md outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40"
            />
            <button
              type="button"
              onClick={handleCravingSearch}
              disabled={!cravingInput.trim() || cravingLoading}
              className="bg-terracotta text-white px-6 py-3 rounded-full font-label-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {cravingLoading
                ? <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                : <span className="material-symbols-outlined text-[20px]">auto_awesome</span>}
              Find
            </button>
          </div>

          {showCravingResults && (
            <div className="mt-4">
              {cravingLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[0,1,2,3].map(i => <div key={i} className="h-16 bg-white/50 rounded-2xl animate-pulse" />)}
                </div>
              ) : cravingResults && cravingResults.length > 0 ? (
                <div>
                  <p className="text-label-sm text-on-surface-variant mb-3">
                    AI found {cravingResults.length} recipes matching &ldquo;{cravingInput}&rdquo;
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {cravingResults.map((recipe) => (
                      <Link
                        key={recipe.id}
                        href={`/recipes/${recipe.id}`}
                        className="bg-white rounded-2xl p-4 hover:shadow-md transition-all group"
                      >
                        <h4 className="font-label-md text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                          {recipe.title}
                        </h4>
                        <p className="text-label-sm text-on-surface-variant capitalize mt-1">
                          {recipe.mealType} · {recipe.cookTimeMinutes}min
                        </p>
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowCravingResults(false); setCravingResults(null); setCravingInput(""); }}
                    className="mt-3 text-label-sm text-on-surface-variant hover:text-on-surface"
                  >
                    Clear results
                  </button>
                </div>
              ) : (
                <p className="text-label-md text-on-surface-variant">
                  No matches found. Try different words or browse below.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Category pills */}
      <section className="relative z-30 mt-6 px-6 max-w-[1280px] mx-auto w-full">
        <div className="bg-surface/80 backdrop-blur-xl rounded-3xl p-4 md:p-6 shadow-sm flex flex-wrap items-center justify-center gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              className={`px-6 md:px-8 py-2.5 md:py-3 rounded-full font-label-md transition-all ${
                category === cat.key
                  ? "bg-primary text-on-primary shadow-md hover:-translate-y-0.5"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Bento discovery */}
      <section className="max-w-[1280px] mx-auto px-6 py-16 w-full">
        <div className="flex items-end justify-between mb-10">
          <div className="space-y-2">
            <span className="text-terracotta font-label-md uppercase tracking-widest">
              Recommended for you
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Daily Discovery</h2>
          </div>
          <button
            type="button"
            onClick={() => allRecipesRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="group flex items-center gap-2 text-primary font-label-md"
          >
            View All
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:h-[800px] animate-pulse">
            <div className="md:col-span-2 md:row-span-2 bg-surface-container rounded-3xl" />
            <div className="md:col-span-1 md:row-span-2 bg-surface-container rounded-3xl" />
            <div className="md:col-span-1 bg-surface-container rounded-3xl min-h-[200px]" />
            <div className="md:col-span-1 bg-surface-container rounded-3xl min-h-[200px]" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 bg-surface rounded-3xl">
            <BrandLogo className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="font-headline-md text-on-surface-variant">Couldn&apos;t load recipes</h3>
          </div>
        ) : bentoRecipes.length === 0 ? (
          <div className="text-center py-20 bg-surface rounded-3xl">
            <h3 className="font-headline-md text-on-surface-variant">No recipes found</h3>
            <p className="text-on-surface-variant mt-2">Try another category or search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-6 md:h-[800px]">
            {bentoRecipes[0] && (
              <BentoFeaturedCard recipe={bentoRecipes[0]} image={recipeImage(bentoRecipes[0], 0)} />
            )}
            {bentoRecipes[1] && (
              <BentoMediumCard recipe={bentoRecipes[1]} image={recipeImage(bentoRecipes[1], 1)} />
            )}
            {bentoRecipes[2] && (
              <BentoSmallCard recipe={bentoRecipes[2]} image={recipeImage(bentoRecipes[2], 2)} />
            )}
            {bentoRecipes[3] && (
              <BentoSmallCard recipe={bentoRecipes[3]} image={recipeImage(bentoRecipes[3], 3)} />
            )}
          </div>
        )}
      </section>

      {/* Seasonal picks */}
      {seasonalRecipes.length > 0 && (
        <section className="bg-surface-container-low py-16 w-full">
          <div className="max-w-[1280px] mx-auto px-6">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-terracotta">eco</span>
                </div>
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">Seasonal Picks</h2>
                  <p className="text-on-surface-variant font-body-md">Sourced from the current harvest</p>
                </div>
              </div>
              <div className="hidden sm:flex gap-2">
                <button
                  type="button"
                  onClick={() => scrollSeasonal("left")}
                  className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"
                  aria-label="Scroll left"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollSeasonal("right")}
                  className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"
                  aria-label="Scroll right"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
            <div
              ref={seasonalRef}
              className="grid grid-cols-1 md:grid-cols-3 gap-10 md:overflow-x-auto md:flex md:gap-10 md:snap-x md:snap-mandatory discovery-list"
            >
              {seasonalRecipes.map((recipe, i) => (
                <SeasonalCard
                  key={recipe.id}
                  recipe={recipe}
                  image={recipeImage(recipe, i + 4)}
                  isNew={i === 0}
                  onToggleFavorite={() => toggleFavorite.mutate(recipe.id)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All recipes grid */}
      {gridRecipes.length > 0 && (
        <section ref={allRecipesRef} className="max-w-[1280px] mx-auto px-6 py-16 w-full">
          <div className="flex items-end justify-between mb-10">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              {session ? "All Recipes" : "Browse Recipes"}
            </h2>
            {session && recipes.length > 0 && (
              <p className="text-label-md text-on-surface-variant">
                {recipes.filter((r) => r.matchScore >= 80).length} ready from your pantry
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {gridRecipes.map((recipe, i) => (
              <CompactRecipeCard
                key={recipe.id}
                recipe={recipe}
                image={recipeImage(recipe, i)}
                onToggleFavorite={() => toggleFavorite.mutate(recipe.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="max-w-[1280px] mx-auto px-6 py-16 w-full">
        <div className="bg-primary rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="space-y-4 relative z-10 max-w-xl">
            <h3 className="font-display-lg text-[32px] md:text-display-lg text-on-primary leading-tight">
              Learn from the pros.
            </h3>
            <p className="font-body-lg text-primary-fixed leading-relaxed">
              Join home chefs and receive weekly organic recipes, pantry organization tips, and
              seasonal ingredient guides.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <input
                className="bg-white/10 border border-white/20 rounded-full px-6 py-4 text-white placeholder:text-white/60 outline-none focus:bg-white/20 transition-all w-full sm:w-80"
                placeholder="Enter your email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="button"
                className="bg-terracotta text-white px-8 py-4 rounded-full font-label-md hover:scale-105 transition-all shadow-lg shrink-0"
              >
                Subscribe
              </button>
            </div>
          </div>
          <div className="relative z-10 w-full md:w-1/3">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 rotate-2 md:rotate-3 md:translate-x-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-surface-container shrink-0" />
                <div>
                  <p className="text-white font-label-md">Chef Elena Vance</p>
                  <p className="text-white/60 text-label-sm">Culinary Director</p>
                </div>
              </div>
              <p className="text-white/90 font-body-md italic">
                &quot;Cooking with intention starts with the right inspiration. Our discovery engine
                is designed to honor both your pantry and your palate.&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full bg-surface-container-low py-16">
        <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="col-span-1 md:col-span-2 text-on-surface-variant text-body-md">
            <div className="flex items-center gap-2 mb-6">
              <BrandLogo className="h-6 w-6 object-contain" muted />
              <span className="font-headline-md text-title-lg text-on-surface-variant">
                What&apos;s for Dinner
              </span>
            </div>
            <p className="max-w-xs">
              Nourishing your kitchen with organic minimalism and intentional cooking.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-label-md text-on-surface uppercase tracking-widest">Explore</span>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/recipes">
              Recipes
            </Link>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/pantry">
              Pantry
            </Link>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/meal-plan">
              Meal Plan
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-label-md text-on-surface uppercase tracking-widest">Support</span>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/auth/signin">
              Sign In
            </Link>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/favorites">
              Favorites
            </Link>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/shopping">
              Shopping
            </Link>
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto px-6 mt-10 pt-6 border-t border-outline-variant/30 text-center text-on-surface-variant text-label-sm">
          © {new Date().getFullYear()} What&apos;s for Dinner. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function BentoFeaturedCard({ recipe, image }: { recipe: RecipeWithMatch; image: string }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-3xl bg-surface-container shadow-sm transition-all hover:shadow-xl min-h-[320px] md:min-h-0"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
        style={{ backgroundImage: `url('${image}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent" />
      {sessionMatchBadge(recipe.matchScore)}
      <div className="absolute bottom-0 left-0 p-8 md:p-10 w-full">
        <div className="flex gap-2 mb-3 flex-wrap">
          <span className="bg-white/20 backdrop-blur-md text-white text-label-sm px-3 py-1 rounded-full uppercase tracking-wider">
            {difficultyLabel(recipe.cookTimeMinutes)}
          </span>
          <span className="bg-white/20 backdrop-blur-md text-white text-label-sm px-3 py-1 rounded-full uppercase tracking-wider">
            {formatCookTime(recipe.cookTimeMinutes)}
          </span>
        </div>
        <h3 className="font-display-lg text-[28px] md:text-[36px] text-white mb-2 leading-tight">
          {recipe.title}
        </h3>
        {recipe.description && (
          <p className="text-white/80 font-body-md line-clamp-2 max-w-md">{recipe.description}</p>
        )}
      </div>
    </Link>
  );
}

function sessionMatchBadge(score: number) {
  if (score <= 0) return null;
  return (
    <div className="absolute top-6 right-6">
      <div className="bg-success-soft/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-primary font-label-md">{score}% Pantry Match</span>
      </div>
    </div>
  );
}

function BentoMediumCard({ recipe, image }: { recipe: RecipeWithMatch; image: string }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="md:col-span-1 md:row-span-2 group relative overflow-hidden rounded-3xl bg-surface-container shadow-sm transition-all hover:shadow-xl min-h-[280px] md:min-h-0"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
        style={{ backgroundImage: `url('${image}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent" />
      {recipe.matchScore > 0 && (
        <div className="absolute top-6 left-6">
          <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-label-md shadow-sm">
            {recipe.matchScore}% Match
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 p-6">
        <span className="text-white/70 font-label-sm uppercase tracking-wider capitalize">
          {recipe.mealType}
        </span>
        <h3 className="font-headline-md text-white">{recipe.title}</h3>
        <div className="flex items-center gap-3 mt-2 text-white/90 text-label-sm">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            {formatCookTime(recipe.cookTimeMinutes)}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">signal_cellular_alt</span>
            {difficultyLabel(recipe.cookTimeMinutes)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function BentoSmallCard({ recipe, image }: { recipe: RecipeWithMatch; image: string }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-3xl bg-surface-container shadow-sm transition-all hover:shadow-xl min-h-[200px]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
        style={{ backgroundImage: `url('${image}')` }}
      />
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
      <div className="absolute bottom-0 left-0 p-6">
        <h3 className="font-title-lg text-white line-clamp-2">{recipe.title}</h3>
        <span className="text-white/80 text-label-sm">
          {recipe.matchScore > 0 ? `${recipe.matchScore}% Match • ` : ""}
          {formatCookTime(recipe.cookTimeMinutes)}
        </span>
      </div>
    </Link>
  );
}

function SeasonalCard({
  recipe,
  image,
  isNew,
  onToggleFavorite,
}: {
  recipe: RecipeWithMatch;
  image: string;
  isNew?: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 group md:min-w-[320px] md:snap-start">
      <Link href={`/recipes/${recipe.id}`} className="relative aspect-[4/5] overflow-hidden rounded-3xl block">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
          style={{ backgroundImage: `url('${image}')` }}
        />
        {isNew && (
          <div className="absolute top-4 left-4 bg-sage text-on-primary px-3 py-1 rounded-full text-label-sm font-label-md uppercase">
            New
          </div>
        )}
      </Link>
      <div className="space-y-2">
        <div className="flex justify-between items-start gap-3">
          <Link
            href={`/recipes/${recipe.id}`}
            className="font-headline-md text-headline-md text-on-surface hover:text-primary transition-colors"
          >
            {recipe.title}
          </Link>
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`material-symbols-outlined shrink-0 transition-colors ${
              recipe.isFavorite ? "text-secondary" : "text-on-surface-variant hover:text-terracotta"
            }`}
            style={recipe.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
            aria-label={recipe.isFavorite ? "Remove favorite" : "Add favorite"}
          >
            favorite
          </button>
        </div>
        {recipe.description && (
          <p className="text-on-surface-variant font-body-md line-clamp-2">{recipe.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          {recipe.matchScore > 0 && (
            <span className="text-label-md font-label-md text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              {recipe.matchScore}% Match
            </span>
          )}
          {recipe.calories != null && recipe.calories > 0 && (
            <span className="text-label-md font-label-md text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">local_fire_department</span>
              {recipe.calories} kcal
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactRecipeCard({
  recipe,
  image,
  onToggleFavorite,
}: {
  recipe: RecipeWithMatch;
  image: string;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="group bg-surface rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      <Link href={`/recipes/${recipe.id}`} className="relative block aspect-[4/3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={recipe.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {recipe.matchScore >= 80 && (
          <div className="absolute top-3 left-3 bg-success-soft/90 backdrop-blur-sm px-3 py-1 rounded-full text-label-sm text-primary font-label-md">
            {recipe.matchScore}% match
          </div>
        )}
      </Link>
      <div className="p-5">
        <div className="flex justify-between items-start gap-2">
          <Link
            href={`/recipes/${recipe.id}`}
            className="font-title-lg text-on-surface group-hover:text-primary transition-colors line-clamp-2"
          >
            {recipe.title}
          </Link>
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`material-symbols-outlined text-[20px] shrink-0 ${
              recipe.isFavorite ? "text-secondary" : "text-on-surface-variant hover:text-terracotta"
            }`}
            style={recipe.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
            aria-label="Toggle favorite"
          >
            favorite
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2 text-label-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            {formatCookTime(recipe.cookTimeMinutes)}
          </span>
          <span className="capitalize">{recipe.mealType}</span>
        </div>
      </div>
    </div>
  );
}
