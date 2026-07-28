"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, ChevronLeft, ChevronRight, Check, Timer, Play, Pause, RotateCcw, PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Instruction {
  step_number: number;
  text: string;
}

interface CookModeProps {
  title: string;
  instructions: Instruction[];
  cookTimeMinutes: number;
  onClose: () => void;
  onComplete?: () => void;
}

export function CookMode({ title, instructions, cookTimeMinutes, onClose, onComplete }: CookModeProps) {
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [timerSec, setTimerSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [done, setDone] = useState(false);

  const total = instructions.length;
  const current = instructions[step];
  const progress = total > 0 ? ((checked.size) / total) * 100 : 0;

  useEffect(() => {
    if (!timerRunning || timerSec <= 0) {
      if (timerSec <= 0 && timerRunning) setTimerRunning(false);
      return;
    }
    const id = setInterval(() => {
      setTimerSec((s) => {
        if (s <= 1) {
          setTimerRunning(false);
          if (typeof window !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.([200, 100, 200]);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerSec]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, checked]);

  const toggleCheck = useCallback((index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const next = () => {
    if (!checked.has(step)) {
      setChecked((prev) => new Set(prev).add(step));
    }
    if (step < total - 1) {
      setStep(step + 1);
    } else {
      setDone(true);
      onComplete?.();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const startPreset = (mins: number) => {
    setTimerSec(mins * 60);
    setTimerRunning(true);
    setShowTimer(true);
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-[60] bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center p-6 animate-fade-in">
        <div className="text-center text-white max-w-sm animate-scale-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-6 animate-pop">
            <PartyPopper className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Dinner is served!</h2>
          <p className="text-orange-100 mb-8">You finished all {total} steps for {title}.</p>
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-xl bg-white text-orange-600 font-semibold hover:bg-orange-50 transition-colors"
          >
            Back to recipe
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-gray-950 text-white flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="text-center flex-1 px-4 min-w-0">
          <p className="text-xs text-white/50 uppercase tracking-wide">Cook Mode</p>
          <p className="text-sm font-medium truncate">{title}</p>
        </div>
        <button
          onClick={() => setShowTimer(!showTimer)}
          className={cn(
            "p-2 rounded-lg transition-colors",
            showTimer ? "bg-orange-500 text-white" : "hover:bg-white/10"
          )}
        >
          <Timer className="w-5 h-5" />
        </button>
      </div>

      {/* Progress */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-orange-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timer panel */}
      {showTimer && (
        <div className="px-4 py-4 bg-white/5 border-b border-white/10 animate-slide-down">
          <div className="flex items-center justify-center gap-4 mb-3">
            <button
              onClick={() => setTimerRunning(false)}
              className="p-2 rounded-full hover:bg-white/10"
              disabled={timerSec === 0}
            >
              <Pause className="w-4 h-4" />
            </button>
            <span
              className={cn(
                "text-4xl font-mono font-bold tabular-nums",
                timerSec > 0 && timerSec <= 10 && timerRunning && "text-red-400 animate-pulse"
              )}
            >
              {formatTimer(timerSec)}
            </span>
            <button
              onClick={() => timerSec > 0 && setTimerRunning(true)}
              className="p-2 rounded-full hover:bg-white/10"
            >
              <Play className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setTimerRunning(false);
                setTimerSec(0);
              }}
              className="p-2 rounded-full hover:bg-white/10"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            {[1, 3, 5, 10, Math.min(cookTimeMinutes, 30)].filter((v, i, a) => a.indexOf(v) === i && v > 0).map((m) => (
              <button
                key={m}
                onClick={() => startPreset(m)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-orange-500 transition-colors"
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-white/40 font-medium">
              Step {step + 1} of {total}
            </span>
            <button
              onClick={() => toggleCheck(step)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                checked.has(step)
                  ? "bg-green-500 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              )}
            >
              <Check className="w-3.5 h-3.5" />
              {checked.has(step) ? "Done" : "Mark done"}
            </button>
          </div>

          <div
            key={step}
            className="animate-slide-up"
          >
            <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-orange-500/30">
              {current?.step_number || step + 1}
            </div>
            <p className="text-2xl sm:text-3xl font-medium leading-relaxed text-white/95">
              {current?.text}
            </p>
          </div>

          {/* Step dots */}
          <div className="flex flex-wrap gap-2 mt-10 justify-center">
            {instructions.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all",
                  i === step
                    ? "bg-orange-500 scale-125"
                    : checked.has(i)
                    ? "bg-green-500"
                    : "bg-white/20 hover:bg-white/40"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-4 py-4 border-t border-white/10 flex gap-3 safe-bottom">
        <button
          onClick={prev}
          disabled={step === 0}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/10 font-medium disabled:opacity-30 hover:bg-white/15 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={next}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-orange-500 font-semibold hover:bg-orange-600 active:scale-[0.98] transition-all"
        >
          {step === total - 1 ? "Finish" : "Next step"}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
