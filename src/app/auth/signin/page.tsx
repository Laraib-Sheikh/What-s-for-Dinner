"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBdDRKIgAQMMn4aZ_MnDEz_7iPxTgC1XNQMsFeikrEyef1MAmIgxJsByIqyXJ8bPQ69geWqY67tk5aR4qDTlsgDQDy3v_q3peueucRjA6ihDhR5FoZXTtRn3fqlRbtw9neOgDrYg3Y8r0plcrF0WgILWxp76BtOzi8GrvcIovIqK3NOEAgBtq4kXAjA3jZ05EW_Hmy4XcFZV697epSsN0hPce2Qw-qLAsXO3rgxRUSRrOede6dH8alsNrsT5caNgtzX9mC6rLowgcI";

const navLinks = [
  { href: "/recipes", label: "Recipes", active: true },
  { href: "/pantry", label: "Pantry" },
  { href: "/meal-plan", label: "Meal Plan" },
  { href: "/shopping", label: "Shopping" },
  { href: "/favorites", label: "Favorites" },
];

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
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
        setSuccess(true);
        if (remember) {
          try {
            localStorage.setItem("wfd-remember-email", email);
          } catch {
            /* ignore */
          }
        }
        setTimeout(() => {
          router.push("/recipes");
          router.refresh();
        }, 800);
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await signIn("google", { callbackUrl: "/recipes" });
    } catch {
      setError("Google sign-in is not available.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="bg-oat-milk font-body-md text-on-surface min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-oat-milk/80 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="h-20 max-w-[1280px] mx-auto px-6 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <BrandLogo className="h-9 w-9 object-contain" />
            <span className="font-headline-md text-headline-md text-primary tracking-tight hidden sm:inline">
              What&apos;s for Dinner
            </span>
          </Link>

          <div className="flex-1 max-w-lg mx-6 hidden md:block">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                className="w-full bg-surface-container-low border-none rounded-full py-2 pl-12 pr-4 text-body-md focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                placeholder="Search for recipes..."
                type="text"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = (e.target as HTMLInputElement).value.trim();
                    window.location.href = q
                      ? `/recipes?search=${encodeURIComponent(q)}`
                      : "/recipes";
                  }
                }}
              />
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-label-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
              >
                {link.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-terracotta mr-1" />
                )}
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 ml-6">
            <span className="px-6 py-2 rounded-full border border-outline text-label-md text-on-surface bg-surface-container-high">
              Sign In
            </span>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full pt-20 bg-oat-milk">
        <div className="flex flex-col w-full min-h-[calc(100vh-80px)]">
          <div className="flex flex-1 w-full flex-col lg:flex-row">
            {/* Left — visual */}
            <div className="relative hidden lg:flex lg:w-7/12 overflow-hidden bg-surface-container">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105"
                style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/40 via-transparent to-transparent" />
              <div className="absolute bottom-16 left-16 right-16">
                <div className="flex flex-col gap-3 max-w-md">
                  <span className="text-on-primary font-label-md uppercase tracking-[0.2em] opacity-80">
                    The Art of Dining
                  </span>
                  <h2 className="text-on-primary font-display-lg text-display-lg leading-tight">
                    Cooking is the ultimate act of care.
                  </h2>
                </div>
              </div>
            </div>

            {/* Right — form */}
            <div className="flex flex-1 flex-col justify-center items-center px-6 py-16 bg-oat-milk">
              <div className="w-full max-w-[420px] space-y-10">
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-6">
                  <BrandLogo className="w-20 h-20 object-contain rounded-full shadow-sm bg-white p-2" />
                  <div className="space-y-1">
                    <h1 className="text-on-surface font-headline-lg text-headline-lg">
                      Welcome back.
                    </h1>
                    <p className="text-on-surface-variant font-body-lg text-body-lg">
                      Your kitchen is waiting.
                    </p>
                  </div>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-3">
                    <div className="group relative">
                      <label className="absolute left-6 -top-2.5 bg-oat-milk px-2 text-label-sm text-outline transition-all group-focus-within:text-primary z-10">
                        Email Address
                      </label>
                      <input
                        className="w-full px-6 py-4 bg-transparent border-2 border-outline-variant/30 rounded-full font-body-md text-on-surface outline-none focus:border-primary transition-all"
                        placeholder="name@example.com"
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                    <div className="group relative">
                      <label className="absolute left-6 -top-2.5 bg-oat-milk px-2 text-label-sm text-outline transition-all group-focus-within:text-primary z-10">
                        Display Name
                      </label>
                      <input
                        className="w-full px-6 py-4 bg-transparent border-2 border-outline-variant/30 rounded-full font-body-md text-on-surface outline-none focus:border-primary transition-all"
                        placeholder="Your name (optional)"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative w-5 h-5 border-2 border-outline-variant rounded-md flex items-center justify-center group-hover:border-primary transition-colors">
                        <input
                          className="peer absolute opacity-0 w-full h-full cursor-pointer"
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                        />
                        <span
                          className={`material-symbols-outlined text-[16px] text-primary transition-transform ${
                            remember ? "scale-100" : "scale-0"
                          }`}
                        >
                          check
                        </span>
                      </div>
                      <span className="text-label-md text-on-surface-variant">Remember me</span>
                    </label>
                    <span className="text-label-md text-on-surface-variant/70">No password needed</span>
                  </div>

                  {error && (
                    <p className="text-sm text-error bg-error-container px-4 py-2 rounded-full text-center">
                      {error}
                    </p>
                  )}

                  <button
                    className={`w-full py-4 font-label-md text-label-md rounded-full shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100 ${
                      success
                        ? "bg-success-soft text-primary"
                        : "bg-primary text-on-primary"
                    }`}
                    type="submit"
                    disabled={loading || success}
                  >
                    {loading ? (
                      <svg
                        className="animate-spin h-5 w-5 text-on-primary"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : success ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">check</span>
                        <span>Success</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="relative flex items-center gap-6 py-4">
                  <div className="flex-1 h-px bg-outline-variant/30" />
                  <span className="text-label-sm text-outline uppercase tracking-widest">
                    Or continue with
                  </span>
                  <div className="flex-1 h-px bg-outline-variant/30" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={googleLoading}
                    className="flex items-center justify-center gap-3 py-3 px-4 rounded-full border border-outline-variant/50 hover:bg-surface-container transition-colors disabled:opacity-60"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    <span className="text-label-md text-on-surface">
                      {googleLoading ? "…" : "Google"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Apple sign-in coming soon"
                    className="flex items-center justify-center gap-3 py-3 px-4 rounded-full border border-outline-variant/50 opacity-50 cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.11.8 1.12-.1 2.24-.86 3.67-.74 1.58.13 2.72.71 3.42 1.74-3.23 1.94-2.69 6.14.47 7.42-.58 1.49-1.34 2.97-2.62 3.75zM12.03 7.25c-.13-2.13 1.83-3.95 3.86-4.25.32 2.45-2.21 4.41-3.86 4.25z" />
                    </svg>
                    <span className="text-label-md text-on-surface">Apple</span>
                  </button>
                </div>

                <p className="text-center text-label-md text-on-surface-variant">
                  New here?{" "}
                  <Link className="text-primary font-bold hover:underline" href="/auth/signin">
                    Start your journey
                  </Link>
                  <span className="block mt-2 text-label-sm text-outline">
                    Enter any email to sign in or create an account.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low py-16">
        <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="col-span-1 md:col-span-2 text-on-surface-variant text-body-md">
            <div className="flex items-center gap-3 mb-6">
              <BrandLogo className="h-7 w-7 object-contain" muted />
              <span className="font-headline-md text-title-lg text-on-surface-variant">
                What&apos;s for Dinner
              </span>
            </div>
            <p className="max-w-xs">
              Nourishing your kitchen with organic minimalism and intentional cooking.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-label-md text-label-md text-on-surface mb-1 uppercase tracking-widest">
              Explore
            </span>
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
            <span className="font-label-md text-label-md text-on-surface mb-1 uppercase tracking-widest">
              Support
            </span>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/auth/signin">
              Sign In
            </Link>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/profile">
              Profile
            </Link>
            <Link className="text-label-md text-on-surface-variant hover:text-primary" href="/recipes">
              Help Center
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
