"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isShared = pathname.startsWith("/shared/");
  const isAuth = pathname.startsWith("/auth/");
  const isPantry = pathname === "/pantry";
  const isMealPlan = pathname === "/meal-plan";
  const isShopping = pathname === "/shopping";
  const isLeftovers = pathname === "/leftovers";
  const isFavorites = pathname === "/favorites";
  const isRecipes = pathname === "/recipes";

  if (isLanding || isShared || isAuth) {
    return <>{children}</>;
  }

  if (isPantry || isMealPlan || isShopping || isLeftovers || isFavorites || isRecipes) {
    return (
      <>
        <Navbar />
        <main className="w-full bg-background flex flex-col">{children}</main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </>
  );
}
