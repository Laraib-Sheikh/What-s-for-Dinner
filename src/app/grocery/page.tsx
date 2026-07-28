"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy /grocery → /shopping */
export default function GroceryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/shopping");
  }, [router]);
  return (
    <div className="text-center py-16 text-gray-400 text-sm">
      Redirecting to Shopping Lists…
    </div>
  );
}
