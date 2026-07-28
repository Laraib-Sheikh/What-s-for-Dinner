"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Dice5, Sparkles, Clock, ArrowRight, X } from "lucide-react";
import { formatCookTime } from "@/lib/utils";

interface RecipeOption {
  id: string;
  title: string;
  imageUrl?: string | null;
  cookTimeMinutes: number;
  matchScore: number;
  mealType: string;
  cuisine?: string | null;
}

interface TonightPickProps {
  recipes: RecipeOption[];
}

export function TonightPick({ recipes }: TonightPickProps) {
  const [spinning, setSpinning] = useState(false);
  const [picked, setPicked] = useState<RecipeOption | null>(null);
  const [displayTitle, setDisplayTitle] = useState("");
  const [open, setOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pool = recipes
    .filter((r) => r.matchScore >= 40 || recipes.length < 5)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const spin = () => {
    if (pool.length === 0 || spinning) return;
    setOpen(true);
    setSpinning(true);
    setPicked(null);

    let ticks = 0;
    const totalTicks = 18 + Math.floor(Math.random() * 8);

    intervalRef.current = setInterval(() => {
      const random = pool[Math.floor(Math.random() * pool.length)];
      setDisplayTitle(random.title);
      ticks++;

      if (ticks >= totalTicks) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Prefer higher match scores for the final pick
        const weighted = pool.filter((r) => r.matchScore >= 60);
        const finalPool = weighted.length > 0 ? weighted : pool;
        const winner = finalPool[Math.floor(Math.random() * finalPool.length)];
        setPicked(winner);
        setDisplayTitle(winner.title);
        setSpinning(false);
      }
    }, 90);
  };

  if (pool.length === 0) return null;

  return (
    <>
      <button
        onClick={spin}
        className="group relative overflow-hidden w-full sm:w-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 group-hover:rotate-12 transition-transform">
          <Dice5 className="w-5 h-5" />
        </span>
        <span className="text-left">
          <span className="block text-sm font-bold leading-tight">What&apos;s for dinner?</span>
          <span className="block text-xs text-orange-100">Surprise me from your matches</span>
        </span>
        <Sparkles className="w-4 h-4 opacity-70 ml-1" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => !spinning && setOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !spinning && setOpen(false)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
              disabled={spinning}
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            <div className="bg-gradient-to-br from-orange-500 to-amber-500 px-6 pt-8 pb-10 text-white text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-100 mb-3">
                Tonight&apos;s pick
              </p>
              <div className="min-h-[3.5rem] flex items-center justify-center px-4">
                <h2
                  className={`text-2xl font-bold leading-snug ${
                    spinning ? "animate-pulse blur-[0.5px]" : "animate-pop"
                  }`}
                >
                  {displayTitle || "…"}
                </h2>
              </div>
            </div>

            {picked && !spinning && (
              <div className="p-6 -mt-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {picked.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={picked.imageUrl}
                      alt={picked.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-28 bg-gradient-to-br from-orange-50 to-amber-50" />
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatCookTime(picked.cookTimeMinutes)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                        {picked.matchScore}% match
                      </span>
                      {picked.cuisine && (
                        <span className="capitalize text-xs">{picked.cuisine}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/recipes/${picked.id}`}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                      >
                        Cook this
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={spin}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {spinning && (
              <div className="p-8 text-center">
                <div className="inline-flex gap-1.5 mb-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-orange-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-400">Picking from your best matches…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
