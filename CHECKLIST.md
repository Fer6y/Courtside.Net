# Courtside Build Checklist

## Phase 0: Environment & Foundations ✅
- [x] Create GitHub repo with README
- [x] Install Node.js (v20+) and VS Code
- [x] Sign up for Supabase — create project
- [x] Sign up for Clerk — create application (Google + email)
- [x] Sign up for Vercel — connect GitHub repo
- [x] Bootstrap Next.js 16 app (TypeScript, Tailwind v4, App Router)
- [x] Install deps: shadcn/ui, @supabase/supabase-js, @clerk/nextjs
- [x] Set up .env.local with all keys
- [x] Deploy to Vercel — pipeline confirmed working
- [ ] Register courtside.net domain — deferred to Phase 5

## Phase 1: Database, Auth & Data Import ✅
- [x] Create all 10 Supabase tables with foreign keys + indexes
- [x] Enable RLS on all tables + write all policies
- [ ] Test RLS policies — deferred to Phase 3
- [x] Install and configure @clerk/nextjs
- [x] Set up proxy.ts route protection (Next.js 16 middleware)
- [x] Create sign-in / sign-up pages with Clerk components
- [x] Set up Clerk webhook → Supabase profiles sync (verified working)
- [x] Download Sackmann ATP + WTA datasets
- [x] Write + run player import script (690 players, ATP + WTA, fixed tour-specific master lookup bug)
- [x] Write + run match import script (8,546 matches, Grand Slams + Masters 1000, tour-prefixed api_match_id)
- [x] Write + run data integrity scripts (diagnose, fix-links, merge-duplicates)
- [x] Schema migration: skill_ratings expanded from 11 → 13 axes (focus, clutch, resilience replace mental_strength)
- [x] Schema migration: reviews.is_favorited + watched_matches.collection_name columns added
- [ ] Connect paid tennis API for live imports — deferred to pre-launch

## Phase 2: Core Pages & Radar Charts 🔄
- [x] Homepage — ball hero image + tagline
- [x] /players — list with ATP/WTA tabs, sort by Rank/Name/Age/Country/Matches/Surface Win%/Streak
- [x] /players/[id] — player profile with match history, radar chart, Rate Player button
- [x] /players/[id]/rate — 13-axis skill rating form (4 categories, 1–5 sliders, pre-fills on edit)
- [x] /matches — browse with multi-select filters (surface, tournament, year all stackable)
- [x] /matches/[id] — match detail with player cards, score, Review Match button
- [x] /matches/[id]/review — full review form (3 sliders 1–10, comment, favorite toggle, collection folder)
- [x] Radar chart component — 13 axes, 4 quadrants, bezier curves, glow, staggered animation, legend, breakdown bars
- [x] LoadingAnimation component — bouncing tennis ball with squash/stretch physics
- [x] Loading states — loading.tsx on players, matches, player profile, match detail pages
- [x] Player quick bubble popup (hover/long-press → pill with rank, W/L record, top skill badge)
- [x] /compare — dual radar overlay, color picker per player, top skills, biggest edge, H2H record
- [ ] /h2h/[slug] — head-to-head rivalry pages
- [x] Community reviews display on match pages (reviewer name, ratings, comment, time ago, edit own)
- [x] Community ratings display on player profiles (avg performance + match quality from reviews)
- [ ] Responsive audit — all pages tested on mobile

## Phase 3: Rating System & User Features 🔜
- [x] Match review form — 3 sliders (match + P1 + P2, 1–10), comment, favorite, collection
- [x] Skill rating form — 13 sliders grouped by 4 categories (1–5), edit support
- [x] Review/rating data saved to Supabase (reviews + skill_ratings + watched_matches)
- [x] Display community reviews on match pages (list with usernames, ratings, comments)
- [x] Display community rating averages on match pages (avg match/P1/P2 scores)
- [ ] Edit / delete own reviews
- [ ] Comment threads on reviews
- [ ] User profile page (/profile/[username]) — review history, watch log, collections, favorites
- [ ] Watch log — full catalogue of matches watched, filterable by collection/favorite
- [ ] Achievement decal system (tiers, triggers, display)
- [ ] Follow system (follow users, personalised feed)

## Phase 4: Polish & Performance
- [ ] Dynamic OG images for player/match pages
- [ ] sitemap.xml and robots.txt
- [ ] Toast notifications for user actions (save, delete, error)
- [ ] Empty states for all list pages
- [ ] Accessibility audit
- [ ] Image optimization (player photos when API connected)
- [ ] Cross-browser testing

## Phase 5: Testing & Launch
- [ ] Manual test all user flows: sign up → browse → rate → review
- [ ] Test RLS: verify users can't access/modify others' data
- [ ] Seed 10–20 quality reviews
- [ ] Invite inner circle (15–30 tennis friends) for testing
- [ ] Connect courtside.net domain
- [ ] Upgrade Supabase to Pro
- [ ] Switch Sackmann data → live tennis API
- [ ] Soft launch: r/tennis, Tennis Twitter, Discord
