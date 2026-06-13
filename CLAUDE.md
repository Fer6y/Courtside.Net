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
- Dark theme only. Tokens live in app/globals.css (@theme), NOT tailwind.config

### Design language — "The Programme" (redesign June 2026, see docs/ui-redesign-plan.md)
The app is styled like a tournament programme / fine menu, not a dark dashboard.
- **Three type roles, kept distinct (never blurred):**
  - **Fraunces** (`--font-serif`, `.bill-name`) — player names, match-ups, page titles, marquee headings. Italic carries "v." / "d." and editorial flourishes.
  - **IBM Plex Mono** — scores, ratings, dates, stats, and small-caps **eyebrow labels** (`.eyebrow`: ~10px, 0.2em tracking, uppercase). Mono is NOT used for headings anymore.
  - **DM Sans** — body text, reviews, comments, UI labels.
- **Layout primitives** (in globals.css `@layer components`): `.eyebrow`, `.rule`, `.rule-divider` (—— LABEL ——), `.dot-leader` + `.dot-leader-dots` (menu-style "Label …… value"), `.bill-name`. Prefer these over boxed cards. Hairlines (`var(--hairline)`, `var(--hairline-soft)`) separate content; cards survive only as interactive objects (forms, review cards).
- **Court themes:** the page background is a selectable court via `data-court="grass|clay|hard"` on `<html>` (default grass). Read from the `court` cookie in the root layout (lib/courts.ts). Match pages override to the surface played on via CourtOverride. Picker on the customize page.

### Color
- **Green (#22d68a)** = actions, wins, CTAs (used sparingly). **Gold (#c9a96a)** = honours, slam/luxury accents, ornament, active filter underlines — REPLACED bright amber #f5c518 in programme contexts. **Cream (#ece5d8)** = serif display text. Red (#e74c3c) = losses. Blue (#4a9eff) = comparisons.
- Surface badges/text (Hard #4a90d9 / Clay #d4734e / Grass #5cb85c) are color-coded consistently everywhere.
- Grand Slam pages get tinted cover bands per slam (getCoverBand in lib/tournamentTiers) — content identity, identical on every court theme.
- Slam trophy decals: components/trophies/TrophyDecals.tsx (gold per-slam silhouettes + Masters cup). Honours rows use API-verified slam_wins only.

### Other
- NO emoji as iconography — use lucide line icons (reactions = Flame/Zap/ThumbsDown). The gold `✦` fleuron marks winners; `✓`/`✕` are allowed UI marks.
- Filters/tabs are small-caps eyebrow text links with gold underlines, NOT pills.
- Content rules (see docs): no vanity site-stats; factual career claims need a verified source; scope catalogue-derived stats honestly ("since 2020").
- Player names are always tappable (PlayerNameWithBubble — dashed underline, bubble popup)
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
