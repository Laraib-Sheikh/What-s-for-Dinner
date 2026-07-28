"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChefHat, ShoppingBasket, Calendar, Heart, BookOpen, User, LogOut, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Recipes", icon: BookOpen },
  { href: "/pantry", label: "Pantry", icon: ShoppingBasket },
  { href: "/meal-plan", label: "Meal Plan", icon: Calendar },
  { href: "/grocery", label: "Grocery List", icon: ShoppingBasket },
  { href: "/favorites", label: "Favorites", icon: Heart },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-orange-600">
            <ChefHat className="w-7 h-7" />
            <span className="hidden sm:block">What&apos;s for Dinner</span>
            <span className="sm:hidden">WFD</span>
          </Link>

          <div className="flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-orange-50 text-orange-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:block">{label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
                    pathname === "/profile"
                      ? "bg-orange-50 text-orange-700"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {session.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span className="hidden md:block">{session.user?.name?.split(" ")[0] || "Profile"}</span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:block">Sign out</span>
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
