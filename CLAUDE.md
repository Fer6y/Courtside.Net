# Courtside — "Catalogue your tennis fandom"

## Project Overview
Community platform where tennis fans rate player skills, review matches, and build a living catalogue of the tennis they watch. Letterboxd for tennis with community-generated skill radar charts.

## Tech Stack
- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Custom SVG (hand-built, no chart library)
- **Auth:** Clerk (Google, Apple, email) → webhook syncs to Supabase profiles
- **Database:** Supabase (managed Postgres, RLS, storage, edge functions)
- **Data Sources:** Jeff Sackmann open-source datasets (historical seed) + paid tennis API (live imports)
- **Hosting:** Vercel
- **Domain:** courtside.net

## Folder Structure
```
/app                    # Next.js App Router pages
  /players/[id]         # Player profile
  /matches/[id]         # Match page
  /h2h/[slug]           # Head-to-head rivalry page
  /compare              # Player comparison tool
  /profile/[username]   # User profile
/components             # Reusable UI components
  /radar                # Skill radar chart (custom SVG)
  /ui                   # shadcn/ui components
/lib                    # Supabase client, utilities, helpers
/types                  # TypeScript type definitions
/docs                   # Architecture and spec docs
```

## Conventions
- Use server components by default; client components only when interactivity required
- All database queries go through /lib/supabase
- Tailwind for all styling, no CSS modules
- Dark theme only (colors defined in tailwind.config)
- IBM Plex Mono for numbers, scores, headings, data, brand
- DM Sans for body text, reviews, comments, UI labels
- Never mix the two fonts in the same context
- Green (#22d68a) = actions, wins. Red (#e74c3c) = losses. Blue (#4a9eff) = comparisons. Amber (#f5c518) = highlights.
- Cards use subtle borders (rgba(255,255,255,0.05)) and low-opacity backgrounds (rgba(255,255,255,0.03)), never solid fills
- Player names are always tappable (dashed underline, quick bubble popup)
- Surface badges (Hard/Clay/Grass) are color-coded consistently everywhere
- Animations: 150-200ms, functional not decorative. Spring physics for popups.
- Mobile-first responsive. Touch targets 44px minimum.
- Never refactor code unless explicitly asked
- Commit after every working feature with a descriptive message

## Key Design Files
- See docs/radar-spec.md for full radar chart specification
- See docs/rating-system.md for the two rating systems
- See docs/data-strategy.md for API and data import approach
- See CHECKLIST.md for current build progress
- See COURTSIDE-DESIGN-DOC.md for complete product vision

## Database
10 tables in Supabase: players, matches, reviews, skill_ratings, profiles, follows, comments, watched_matches, achievements, h2h_cache. All have RLS enabled. See COURTSIDE-DESIGN-DOC.md Section 7 for full schema.

## Two Rating Systems
1. **Match ratings** (reviews table): Three 1.0–10.0 sliders per match — overall + Player 1 + Player 2. This is the primary quick interaction.
2. **Skill ratings** (skill_ratings table): 11-axis radar chart data rated from player profiles. Separate deeper engagement. 4 categories: Movement (3), Technique (3), Skill (4), Mental (1).

## Environment Variables
See .env.local.example for all required variables.

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run linter

## Current Phase
Phase 0 — Environment setup. See CHECKLIST.md for progress.
