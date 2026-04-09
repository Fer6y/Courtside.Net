# Courtside Build Checklist

## Phase 0: Environment & Foundations (Day 1–2)

- [x] Create GitHub repo (courtside-app) with README
- [x] Install Node.js (v20+) and VS Code
- [x] Sign up for Supabase — create project (save project URL + anon key)
- [x] Sign up for Clerk — create application (enable Google + email providers)
- [x] Sign up for Vercel — connect GitHub repo
- [x] Run: `npx create-next-app@latest . --typescript --tailwind --app`
- [x] Install deps: shadcn/ui, @supabase/supabase-js, @clerk/nextjs, d3
- [x] Initialize shadcn/ui: `npx shadcn@latest init`
- [x] Set up .env.local with Supabase + Clerk keys (see .env.local.example)
- [x] Create CLAUDE.md and CHECKLIST.md in project root
- [x] Deploy to Vercel — confirm pipeline works
- [ ] Register courtside.net domain — deferred to later

## Phase 1: Database, Auth & Data Import (Week 1–2)

- [x] Create all Supabase tables (see COURTSIDE-DESIGN-DOC.md Section 7)
- [x] Set up foreign key relationships between tables
- [x] Add indexes on user_id, player_id, match_id columns
- [x] Enable RLS on all tables
- [x] Write RLS policies: public READ, authenticated INSERT, own-data UPDATE/DELETE
- [ ] Test RLS policies in Supabase SQL editor — deferred to Phase 3
- [x] Install and configure @clerk/nextjs
- [x] Set up middleware.ts for route protection
- [x] Create sign-in/sign-up pages with Clerk components
- [x] Set up Clerk webhook → Supabase profiles sync
- [x] Test full auth flow: sign up, sign in, verify user appears in Supabase
- [ ] Evaluate tennis data APIs (api-tennis.com, RapidAPI options) — deferred to later
- [x] Download Sackmann ATP + WTA datasets from GitHub
- [x] Write import script: seed players table from Sackmann data
- [x] Write import script: seed matches table (majors only) from Sackmann data
- [ ] Set up paid API connection for ongoing match imports — deferred to later

## Phase 2: Core Pages & Radar Charts (Week 3–4)

- [ ] Build /players page — list all players with search/filter
- [ ] Build /players/[id] — player profile with API stats + community rating
- [ ] Build rotating highly-rated comments display on player profiles
- [ ] Build category-weighted radar chart component (4 colored quadrants, 11 axes, curved bezier lines, animated on load)
- [ ] Build skill breakdown bars component (detail view beneath radar)
- [ ] Build /matches page — browse with filters
- [ ] Build /matches/[id] — match page with player comparison
- [ ] Build player quick bubble component (rank, recent form, link to profile)
- [ ] Build /compare — dual radar overlay comparison
- [ ] Build /h2h/[player1]-vs-[player2] — rivalry pages (split screen)
- [ ] Implement dark theme with CSS variables
- [ ] Surface badges, Avatar component, loading skeletons
- [ ] Responsive audit — all pages work on mobile

## Phase 3: Rating System & User Features (Week 5–7)

- [ ] Build 1.0–10.0 slider rating component (0.1 increments, 10.0 as perfect)
- [ ] Build sets watched quick-select buttons
- [ ] Build match review form: 3 sliders (match + Player 1 + Player 2) + comment
- [ ] Connect review form to Supabase
- [ ] Build aggregation: average player ratings across matches → consensus rating on profile
- [ ] Build skill rating form on player profiles (11 sliders grouped by 4 categories)
- [ ] Build aggregation: community skill ratings → radar chart on profile
- [ ] Add edit/delete for own reviews
- [ ] Build comment threads on reviews
- [ ] Build user profile page with review history + watch log
- [ ] Build watch log — full catalogue of matches watched with ratings and comments
- [ ] Implement achievement decal system (define tiers, trigger conditions, display component)

## Phase 4: Polish & Performance (Week 8–9)

- [ ] Server components for data-heavy pages
- [ ] Database indexes for slow queries
- [ ] Image optimization (player photos, avatars)
- [ ] Dynamic OG images for player/match/H2H pages
- [ ] sitemap.xml and robots.txt
- [ ] Slider and rating component animation polish
- [ ] Toast notifications for user actions
- [ ] Empty states for all pages
- [ ] Accessibility audit
- [ ] Cross-browser testing

## Phase 5: Testing & Launch (Week 10–12)

- [ ] Manual test all user flows: sign up → browse → rate → review
- [ ] Test RLS: verify users can't access/modify others' data
- [ ] Test edge cases: empty reviews, max-length comments, rapid submissions
- [ ] Set up error tracking (Sentry or Vercel built-in)
- [ ] Seed 10–20 quality reviews yourself
- [ ] Invite 15–30 tennis friends for inner circle testing
- [ ] Connect courtside.net domain to Vercel
- [ ] Upgrade Supabase to Pro ($25/month)
- [ ] Soft launch: share with local tennis networks
- [ ] Begin organic seeding in r/tennis, Tennis Twitter, Discord
