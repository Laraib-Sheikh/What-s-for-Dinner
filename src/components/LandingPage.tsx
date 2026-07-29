"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const navLinks = [
  { href: "/recipes", label: "Recipes" },
  { href: "/pantry", label: "Pantry" },
  { href: "/meal-plan", label: "Meal Plan" },
  { href: "/shopping", label: "Shopping" },
  { href: "/leftovers", label: "Leftovers" },
  { href: "/favorites", label: "Favorites" },
];

export function LandingPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = search.trim();
    window.location.href = q ? `/recipes?search=${encodeURIComponent(q)}` : "/recipes";
  }

  function handleSubscribe(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
  }

  return (
    <div className="bg-oat-milk font-body-md text-on-surface min-h-screen">
      {/* ── Header ── */}
      <header className="fixed top-0 w-full z-50 bg-oat-milk/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
        <div className="h-20 max-w-[1280px] mx-auto px-6 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <BrandLogo className="h-9 w-9 object-contain" />
            <span className="font-headline-md text-headline-md text-primary tracking-tight hidden sm:inline">
              What&apos;s for Dinner
            </span>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-6 hidden md:block">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                className="w-full bg-surface-container-low border-none rounded-full py-2 pl-12 pr-4 text-body-md focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface"
                placeholder="Search recipes, ingredients..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>

          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-label-md text-on-surface-variant hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 ml-6">
            {session ? (
              <Link
                href="/profile"
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center overflow-hidden"
              >
                {session.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
                )}
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="px-6 py-2 rounded-full border border-outline text-label-md text-on-surface hover:bg-surface-container-high transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signin"
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="w-full pt-20 bg-oat-milk">
        <div className="flex flex-col w-full">

          {/* ── Hero ── */}
          <section className="relative w-full px-6 pt-16 pb-10 overflow-hidden">
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-[400px] h-[400px] bg-terracotta/5 rounded-full blur-3xl" />

            <div className="max-w-[1280px] mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7 flex flex-col items-start gap-10">
                <div className="flex flex-col gap-6">
                  <span className="font-label-md text-label-md text-primary uppercase tracking-[0.2em]">
                    Organic AI Matching
                  </span>
                  <h1 className="font-display-lg text-display-lg text-charcoal max-w-2xl leading-[1.1] tracking-tight max-md:text-[28px] max-md:leading-[36px]">
                    Turn what&apos;s already in your{" "}
                    <span className="text-primary italic">fridge</span> into delicious meals.
                  </h1>
                  <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
                    Add your pantry ingredients and get instant recipe matches. Our intelligent engine
                    minimizes waste and maximizes flavor with what you have on hand.
                  </p>
                </div>

                <div className="flex flex-wrap gap-6">
                  <Link
                    href={session ? "/pantry" : "/auth/signin"}
                    className="px-16 py-4 bg-primary text-on-primary rounded-full font-label-md transition-all hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-primary/10"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    href="/recipes"
                    className="px-16 py-4 bg-surface-container-lowest text-primary rounded-full font-label-md transition-all hover:bg-surface-bright border border-primary/10"
                  >
                    Browse Recipes
                  </Link>
                </div>

                <div className="flex items-center gap-10 pt-6">
                  <div className="flex -space-x-4">
                    <div className="w-12 h-12 rounded-full border-4 border-oat-milk overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="w-full h-full object-cover"
                        alt="Home cook in a sunlit kitchen"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCiFUKKW96kgcUUn2hKPpSCO7lBwwrb-zOX7SJcODDcRmmeYx8QOP7jT4uI7ruCOQ4UxMa_-zroYesAapJ4zBoTdKynqV9HIEi-80f5Mep1TrdyT6auYiyUkNa4KHWOaauF5nk3gYxB90JshWLUU_lYP_1qESqfuu0JrB61WWztXW6CLTvbkfyTSBmHV2AtfgCVDL2M0BVtbZeqM959tpEc1mWbeBUJHFgxqJToRPHeUJaAbDxySTrqdqV-3iPFU0N0aRksVog1Kwg"
                      />
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-oat-milk overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="w-full h-full object-cover"
                        alt="Hands preparing fresh herbs"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDFMRXnAtvN7oPAubz0cO2ZA4GHkEFzgPQaZ5ZBUzc-J9jRZLfMOVmyeDV0w7j5nM5J_mdVDp7A7pjr11QcIfaC-RN7Du0799_VXx77fAfQQ6zpepoB9Z4CmAuXGy1xrw_bCG1c4kItoGUqF4PlAOJPq5bROkIF6JwbseGGutr-FGaRBFx5xDNZQALZ_n8ZYOo8Cr-0fJ79rIhnTE9fQm7psO-5NX-3E1G3RQYY6A2pjdeUfXYBFSEQkSi51yDNLZ38mqQXf0Zgyq0"
                      />
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-oat-milk bg-sage flex items-center justify-center text-on-primary font-label-sm">
                      12k+
                    </div>
                  </div>
                  <p className="text-label-sm text-on-surface-variant max-w-[160px]">
                    Join thousands of sustainable home chefs.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 relative">
                <div className="aspect-square w-full rounded-[2rem] overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover"
                    alt="Seasonal vegetables flatlay"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuClKlQXpGY-C4Jp47ELypTTMHB9tk0zh4tgtAFzJgs_tlFZWwVO5P3Pw6QxQU74kYRdze2F0WUkbsG4VPqB6j_h9QA54PCj8BgU1vxNuAaug1wsQVMDO6wOw8wDmxU7NMIpUquxN7UkEwgo8Bt2x54iYo8f4ygiWdLZhmm1tObdX0OuzSa3jRaFigPlMsA9DUIcFTLtUYzBFJ-uGe9VTlwd_aRuFaQgbSe4VSAS3QGSr_Asn8ngscbdsfRGf3jLGtS02u0hExgByqc"
                  />
                </div>
                <div className="absolute -left-8 top-1/4 p-6 bg-surface/90 backdrop-blur-md rounded-2xl shadow-xl flex items-center gap-3 animate-bounce-slow max-md:left-0">
                  <span className="material-symbols-outlined text-terracotta">check_circle</span>
                  <span className="font-label-md text-on-surface">3 Matches Found</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Daily Inspiration bento grid ── */}
          <section className="w-full px-6 py-16 bg-surface-bright">
            <div className="max-w-[1280px] mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                <div className="flex flex-col gap-1">
                  <h2 className="font-headline-lg text-headline-lg text-charcoal">Daily Inspiration</h2>
                  <p className="font-body-md text-on-surface-variant">
                    Hand-picked for your current pantry inventory.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/recipes"
                    className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-on-primary transition-all"
                    aria-label="Browse recipes"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </Link>
                  <Link
                    href="/recipes"
                    className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-on-primary transition-all"
                    aria-label="Browse more recipes"
                  >
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-6 h-auto lg:h-[700px]">
                {/* Feature card – large */}
                <Link
                  href="/recipes"
                  className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm hover:shadow-xl transition-all duration-500 min-h-[320px]"
                >
                  <div className="absolute inset-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      alt="Roasted harvest bowl"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCseAoCJxh30jzEA-AGPdOQKpPsi6YHZgoInNbug8j97YAAjxDEf8hcDPsTaNvbI5fBEgfYxfnS35Z3I8sam5QvRfuyftfzaKeMM-0bWGhMFVMCAicuVoBcJy3FWQV9Ffv-BsP32MJ6J98BwErZfVGKQ9C2HYaen-LkQ-YVPRJ5d_D-6_5PBMuSuYyYXzsEXGLUvdhn6ObnZhDdP_xgE2vH7B84n7KLab1Ct2TYXuWhX8-NPCf3O79wL2m8PCrEvw3DYmEMOWsbhKo"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 p-10 w-full">
                    <div className="flex gap-3 mb-6">
                      <span className="px-6 py-1 bg-terracotta text-on-tertiary rounded-full text-label-sm uppercase tracking-wider">
                        Dinner
                      </span>
                      <span className="px-6 py-1 bg-white/20 backdrop-blur-md text-white rounded-full text-label-sm">
                        20 Min
                      </span>
                    </div>
                    <h3 className="font-headline-lg text-white mb-3">Roasted Harvest Bowl</h3>
                    <p className="font-body-md text-white/80 line-clamp-2 max-w-md">
                      The perfect clean-out-the-fridge meal using any root vegetables and greens you have
                      on hand.
                    </p>
                  </div>
                </Link>

                {/* Medium card */}
                <Link
                  href="/recipes"
                  className="md:col-span-2 md:row-span-1 group relative overflow-hidden rounded-2xl bg-oat-milk flex min-h-[200px]"
                >
                  <div className="w-1/2 p-10 flex flex-col justify-between">
                    <div>
                      <span className="px-6 py-1 bg-primary/10 text-primary rounded-full text-label-sm uppercase tracking-wider mb-6 inline-block">
                        Lunch
                      </span>
                      <h3 className="font-title-lg text-charcoal mt-6">Mediterranean Pesto Pasta</h3>
                    </div>
                    <span className="text-primary font-label-md flex items-center gap-1 group-hover:gap-6 transition-all">
                      View Recipe{" "}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </span>
                  </div>
                  <div className="w-1/2 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      alt="Pesto pasta"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqR2r_ueG4I5VeHVS5IknHSjkdAp-J7kVuCm28b7rFZFMi6nudXfaZvnWKiQ101UOIHFAapYWcnncHuxqODBEZrSgHXBhy933rEIdCjdaF9mkb4ruB-YkVrjeQ3Mbmlta3gOB3oqxYVjo5eujSL_ZYpEwT_uVzls5_j_7IA2Ikzk_NsyTTsJn526cspIY1-xS-k_5LcCYHsC3BRz4hLjpP7RiZhQNrherkklsehv62EkzoU_E7V-9AtWxxu1cpJYF2aRul8maSDSU"
                    />
                  </div>
                </Link>

                {/* Small card 1 */}
                <Link
                  href="/recipes"
                  className="md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-2xl bg-surface-container-lowest p-6 flex flex-col gap-6 shadow-sm"
                >
                  <div className="h-32 rounded-xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      alt="Berry overnight oats"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7HHwNUxaY2MltOD-MaU0TZFP8MzO8lEb5593h5dd7etXm5BnkIGP8bxqxkpXDSbrQDxHYgS3RzGlABCeg6D0zMmNFhymA_t905Lv_Xs-q7KTVr6nuBsqbL917ixzR4G8I6d0zDJgFp2jeN07_DMPWUxUl7YEq0jtnqEDB7fGO3N8Qyjy94_rMtR3Vr1oHj3lPnyWng57_5-SvUTd3E07epDo7tJEEy4vGznuhr_LVz3f3sFdP9fg390ancYcUwRBbJIpDcMr-rc8"
                    />
                  </div>
                  <div>
                    <span className="text-label-sm text-terracotta font-bold uppercase tracking-widest">
                      Breakfast
                    </span>
                    <h4 className="font-title-lg text-charcoal mt-1">Berry Overnight Oats</h4>
                  </div>
                </Link>

                {/* Small card 2 – Surprise Me */}
                <div className="md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-2xl bg-surface-container-low p-6 flex flex-col justify-center items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <span className="material-symbols-outlined text-[32px]">auto_awesome</span>
                  </div>
                  <h4 className="font-label-md text-charcoal">Surprise Me</h4>
                  <p className="text-label-sm text-on-surface-variant px-6">
                    Let our AI choose a recipe based on your mood.
                  </p>
                  <Link
                    href="/recipes"
                    className="mt-6 px-6 py-2 border border-outline rounded-full text-label-sm hover:bg-white transition-colors"
                  >
                    Roll Dice
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ── Smart Pantry feature ── */}
          <section className="w-full py-16 bg-oat-milk">
            <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1">
                <div className="relative bg-white p-10 rounded-3xl shadow-xl space-y-6">
                  <div className="flex items-center justify-between border-b border-surface-container pb-6">
                    <h3 className="font-title-lg text-charcoal">Your Pantry</h3>
                    <span className="text-label-sm text-on-surface-variant">12 Items</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {["Garlic", "Spinach", "Pasta"].map((item) => (
                      <div
                        key={item}
                        className="px-6 py-2 bg-sage/10 text-primary rounded-full text-label-md flex items-center gap-1"
                      >
                        {item}{" "}
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </div>
                    ))}
                    <Link
                      href="/pantry"
                      className="px-6 py-2 bg-terracotta/10 text-terracotta rounded-full text-label-md border border-dashed border-terracotta/30"
                    >
                      + Add Ingredient
                    </Link>
                  </div>
                  <div className="bg-surface-container-low p-6 rounded-2xl">
                    <p className="text-label-sm text-on-surface-variant italic mb-3">AI Suggestion:</p>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary">lightbulb</span>
                      <p className="text-body-md text-charcoal">
                        &quot;You have enough for <strong>Garlic Butter Spinach Pasta</strong>. Ready in
                        15 mins!&quot;
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 flex flex-col gap-10">
                <div className="flex flex-col gap-6">
                  <h2 className="font-display-lg text-[32px] leading-tight font-bold text-charcoal">
                    Smart Pantry, <br />
                    Zero Waste.
                  </h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant">
                    Stop throwing away half-used ingredients. Our AI scans your inventory and suggests
                    recipes that specifically use up expiring items.
                  </p>
                </div>
                <ul className="space-y-6">
                  {[
                    { icon: "inventory_2", label: "Digital Inventory Tracking" },
                    { icon: "notification_important", label: "Expiry Notifications" },
                    { icon: "shopping_cart", label: "Smart Shopping List Integration" },
                  ].map((item) => (
                    <li key={item.label} className="flex items-center gap-6">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
                        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      </div>
                      <span className="font-label-md text-on-surface">{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ── Community / social proof ── */}
          <section className="w-full py-16 bg-white">
            <div className="max-w-[1280px] mx-auto px-6 text-center">
              <h2 className="font-headline-lg text-headline-lg text-charcoal mb-16">
                From our Kitchen to Yours
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  {
                    handle: "@eliza_cooks",
                    alt: "Plated salmon dish",
                    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3ORFcZfdA3S3B9WmAFDGoAZVpLPlm2oumAmvxOUfDLcPk22p9cxj_81lh431qfZ5vtHWFjJBbq8WC_7YJUduEIHZA5uBrA7T_yl2W1MRGFwPt7iszD_IfVxe1Mk_sx3aozjMKEBVzZ5Jkmo14hx-3_Ymz028juDwyHxRtFWUfAYqdqEUZHqvn526ZZBWf4zBK1fbTkvaXnsVSE0BFvLPpBUN4TPMcJZNbPfmdzL8MYxnxKxpXifP2E4wxrExhEqtahp8g8MQ6gJw",
                  },
                  {
                    handle: "@marcus_bakes",
                    alt: "Fresh sourdough bread",
                    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAxZgkxE0P9fGvBabZsbgKK43CdGV5RkcfmLsbCKMaC_9unfix2TLs0ds_kb8KopyWB5Q8LPju_B33_VlZjZh6M3HA6SlpAULZpdAwT-sHW04aaAzc7I2kdyA8yCB2A6-hiiK4t0sX83s4aEjuHsqTWYEO-HV5agmXHXuwTAaczn0zFHVa41D0DYbavqdt2spYmYCCr2gqTetqvB-05Oefok7brUR8jK7JTbxIzVs7WX_VMC1mWAZ1Bu9An0-sZJDDN7bJtDClnLxk",
                  },
                  {
                    handle: "@healthy_habits",
                    alt: "Green smoothie bowl",
                    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBNVBlTPfkRw01kh9_fiCIoVLNRuO6LA9RtlmjMkd1CSHgMqtg4zbUnj7hptNHWmvqq-CQe5_shGerhWzb4AWzXuVPRHKtV86wjaObc6sB4sTy5Jthqc0LnyONTbpgOpBFUJgWfO9x5e6LLlOkiSprWGLJMl1Gpu3VZGbCAIEgfXKh2Ptx3vfPdEg0rZEpCpAexYEbA5WYRv8zxSqVZSmWNedk-W22UUGZ6Pxyro0HDN9-74rD9Shzrx8c25_6tZS2l5vYaOeN1O34",
                  },
                  {
                    handle: "@family_dinners",
                    alt: "Family dinner table",
                    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAl2-I51-5d80BJ-H_VOuWL9mddnOtCfdh3_zVtbOh03F6NCy7tSdtWeJhi5FY-eba-e2q-MUA35yTjWim4ZWKKxv0ShY2JxmJmiTSforAVnjRAkH9o_TA8GoITA91hixNJvtoGDkngemDcWDtDckSTelL0LTH-898HTd8EGSs2kISPB2Pdubr_CwaZPzt0i7hrUYdLIAjEV6pp-jWzviayiz00hBd4jIgkeZqlYRNIwDO_gjnLOH5fozRRd69U45EsJ-4nKnnStm4",
                  },
                ].map((item) => (
                  <div key={item.handle} className="aspect-square rounded-2xl overflow-hidden relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                      alt={item.alt}
                      src={item.src}
                    />
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-label-sm">{item.handle}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Newsletter ── */}
          <section className="w-full py-16 px-6">
            <div className="max-w-4xl mx-auto bg-primary rounded-3xl p-16 text-center relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
              <div className="relative z-10 flex flex-col items-center gap-6">
                <span className="material-symbols-outlined text-on-primary text-[48px]">mail</span>
                <h3 className="font-headline-lg text-on-primary">Get the weekly fresh list.</h3>
                <p className="text-on-primary/80 font-body-md max-w-md">
                  Join 50,000+ cooks receiving seasonal recipes and kitchen hacks every Sunday.
                </p>
                {subscribed ? (
                  <p className="text-on-primary font-label-md mt-6">Thanks — you&apos;re on the list!</p>
                ) : (
                  <form
                    onSubmit={handleSubscribe}
                    className="w-full max-w-md flex flex-col md:flex-row gap-3 mt-6"
                  >
                    <input
                      className="flex-1 px-10 py-3 rounded-full bg-white/10 border border-white/20 text-on-primary placeholder:text-on-primary/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                      placeholder="your@email.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <button
                      className="px-16 py-3 bg-white text-primary rounded-full font-label-md hover:bg-oat-milk transition-colors"
                      type="submit"
                    >
                      Subscribe
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full bg-surface-container-low py-16 mt-16">
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
