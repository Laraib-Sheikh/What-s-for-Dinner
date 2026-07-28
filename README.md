# 🍽️ What's for Dinner

**Fridge-to-recipe meal planner.** Tell us what's in your pantry and we'll show you what you can cook — ranked by how many ingredients you already have.

---

## Features

| Feature | Description |
|---|---|
| **Pantry Management** | Tag-input with autocomplete, quantity notes, expiry dates |
| **Smart Recipe Matching** | Recipes ranked by % of ingredients you own |
| **Almost There** | Highlights recipes missing just 1-2 ingredients |
| **Recipe Detail** | Green ✓ / Red ✗ ingredient highlighting, serving size adjuster |
| **AI Substitutions** | Ask Claude: "I don't have buttermilk, what can I use?" |
| **Meal Planner** | Weekly calendar — click a slot to assign a recipe |
| **Grocery List** | Auto-generate from meal plan, manual add, check off items |
| **Favorites & Cook Log** | Save recipes, rate cooked meals, see history |
| **Auth** | Email-based sign-in (no password for demo), optional Google OAuth |

---

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Data Fetching**: TanStack Query v5
- **Database**: PostgreSQL (via [Neon](https://neon.tech) or [Supabase](https://supabase.com))
- **ORM**: Prisma v7
- **Auth**: NextAuth.js v4
- **AI**: Anthropic Claude API (ingredient substitutions)
- **Deployment**: Vercel

---

## Getting Started

### 1. Set up the database

Get a free PostgreSQL database from:
- [Neon](https://neon.tech) — recommended (serverless, free tier)
- [Supabase](https://supabase.com) — also great, adds auth features

Copy the connection string.

### 2. Configure environment variables

Edit `.env.local`:

```env
DATABASE_URL="postgresql://user:password@host/dbname"
NEXTAUTH_SECRET="generate-a-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="sk-ant-..."  # optional, enables AI substitutions
```

Generate a secret: `openssl rand -base64 32`

### 3. Set up the database schema

```bash
npm run db:push    # Push schema to database (no migration files)
# OR
npm run db:migrate # Create migration files (recommended for production)
```

### 4. Seed with 50 recipes

```bash
npm run db:seed
```

This seeds ~90 ingredients and 50 recipes across all cuisines and meal types.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
  app/
    api/
      auth/[...nextauth]/   # NextAuth route handler
      pantry/               # GET/POST/DELETE pantry items
      recipes/              # GET recipes with match scores
      recipes/[id]/         # GET recipe detail
      favorites/            # GET/POST toggle favorites
      cook-log/             # GET/POST cook history
      meal-plan/            # GET/POST/DELETE meal plan entries
      grocery/              # GET, POST (actions: generate/add/toggle/delete/clear-checked)
      ai/substitutions/     # POST Claude API for substitutions
      user/profile/         # GET/PATCH user profile
    pantry/                 # Pantry management page
    recipes/[id]/           # Recipe detail page
    meal-plan/              # Weekly meal planner
    grocery/                # Grocery list
    favorites/              # Saved recipes
    profile/                # User profile + cook history
    auth/signin/            # Sign-in page
  components/
    Navbar.tsx
    RecipeCard.tsx
    ui/                     # Button, Input, Card, Badge
  lib/
    prisma.ts               # Prisma client singleton
    auth.ts                 # NextAuth config
    utils.ts                # Utility functions
  providers/
    QueryProvider.tsx       # TanStack Query setup
    SessionProvider.tsx     # NextAuth session
prisma/
  schema.prisma             # Database schema
  seed.ts                   # Seed data (50 recipes)
prisma.config.ts            # Prisma v7 config (datasource URL)
```

---

## Database Schema

Core tables and their relationships:

```
users ──┬── pantry_items ──── ingredients ──── recipe_ingredients ──── recipes
        ├── favorites ──────────────────────────────────────────────────┘
        ├── cook_log ──────────────────────────────────────────────────┘
        ├── meal_plan_entries ─────────────────────────────────────────┘
        └── grocery_list_items ──── ingredients
```

**Recipe matching algorithm:**
1. Get all non-optional `recipe_ingredients` for a recipe
2. Compare against user's `pantry_items` by `ingredient_id`
3. `match_score = (owned / total) * 100`
4. Sort recipes by `match_score` descending
5. "Almost there" = `missing_count` is 1 or 2

---

## Adding Google OAuth (Optional)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable "Google+ API"
3. Create OAuth credentials for a web app
4. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
5. Add to `.env.local`:
   ```env
   GOOGLE_CLIENT_ID="your-client-id"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or:
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL      # Set to your production URL
vercel env add ANTHROPIC_API_KEY
```

Make sure to run `npm run db:migrate` (or `db:push`) with your production DATABASE_URL before deploying.
