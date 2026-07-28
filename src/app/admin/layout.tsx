"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, BookOpen, Carrot, Users, Flag, ChevronLeft, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Analytics", icon: LayoutDashboard },
  { href: "/admin/recipes", label: "Recipes", icon: BookOpen },
  { href: "/admin/ingredients", label: "Ingredients", icon: Carrot },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/moderation", label: "Moderation", icon: Flag },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="max-w-7xl mx-auto -mt-2">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-orange-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Admin</h1>
            <p className="text-xs text-gray-500">
              Signed in as {session?.user?.email} · {session?.user?.role}
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-orange-600 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to app
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-52 shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap",
                  active
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
