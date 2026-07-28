"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/** Recipe creation is admin-only — redirect users away from this page */
export default function SubmitRecipePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin =
    session?.user?.role === "admin" || session?.user?.role === "moderator";

  useEffect(() => {
    if (status === "loading") return;
    if (isAdmin) {
      router.replace("/admin/recipes");
    } else {
      router.replace("/");
    }
  }, [status, isAdmin, router]);

  return (
    <div className="text-center py-16 text-gray-500 text-sm">
      <p className="mb-4">Recipe creation is managed by admins.</p>
      {isAdmin ? (
        <Link href="/admin/recipes"><Button size="sm">Go to Admin Recipes</Button></Link>
      ) : (
        <Link href="/"><Button size="sm" variant="secondary">Back home</Button></Link>
      )}
    </div>
  );
}
