"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  ShoppingBasket, Calendar, Heart, BookOpen, User, LogOut, LogIn,
  ShoppingCart, Shield, Leaf, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

const navLinks = [
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/pantry", label: "Pantry", icon: ShoppingBasket },
  { href: "/meal-plan", label: "Meal Plan", icon: Calendar },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
  { href: "/leftovers", label: "Leftovers", icon: Leaf },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/nutrition", label: "Nutrition", icon: Activity },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "moderator";
  const isShared = pathname.startsWith("/shared/");
  const isAdminPage = pathname.startsWith("/admin");

  if (isShared) return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary shrink-0">
            <BrandLogo className="h-8 w-8 object-contain" />
            <span className="hidden sm:block">What&apos;s for Dinner</span>
            <span className="sm:hidden">WFD</span>
          </Link>

          {!isAdminPage && (
            <div className="flex items-center gap-0.5 overflow-x-auto max-w-[50vw] sm:max-w-none">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors shrink-0",
                    pathname === href || (href !== "/" && pathname.startsWith(href))
                      ? "bg-orange-50 text-orange-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:block">{label}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium",
                  isAdminPage
                    ? "bg-orange-50 text-orange-700"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Shield className="w-4 h-4" />
                <span className="hidden md:block">Admin</span>
              </Link>
            )}
            {session ? (
              <div className="flex items-center gap-1">
                <Link
                  href="/profile"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium",
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
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  <LogOut className="w-4 h-4" />
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
