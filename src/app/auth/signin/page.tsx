"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", {
        email,
        name: name || email.split("@")[0],
        redirect: false,
      });
      if (res?.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-2xl mb-4">
              <ChefHat className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-2">
              Sign in to access your pantry, favorites, and meal plan
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Display Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Continue with Email
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              No password needed for demo. Just enter your email to sign in or create an account.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              By signing in, you agree to store your pantry and recipe data securely. No spam.
            </p>
          </div>
        </div>

        <div className="mt-6 bg-orange-50 rounded-xl border border-orange-100 p-4">
          <h3 className="text-sm font-semibold text-orange-800 mb-2">What you&apos;ll get:</h3>
          <ul className="text-sm text-orange-700 space-y-1.5">
            <li>✓ Track pantry ingredients across devices</li>
            <li>✓ Get personalized recipe match scores</li>
            <li>✓ Save favorites &amp; meal planning calendar</li>
            <li>✓ AI-powered ingredient substitution tips</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
