# COURTSIDE — Complete App Design Document
## "Catalogue your tennis fandom"
### Every player + match rated by you and the community

---

## How to Use This Document

This document is the single source of truth for the Courtside app. It captures every design decision, technical spec, and product detail finalized during the initial design phase. Use it to:

- **Continue design work** in a new Claude.ai conversation (upload this file and reference it)
- **Generate the CLAUDE.md** and project files for Claude Code
- **Brief any collaborator** (designer, developer, tennis expert) on the full vision
- **Resolve ambiguity** — if a question comes up during development, the answer should be here

---

## 1. VISION & IDENTITY

### Elevator Pitch

"Letterboxd for tennis — but instead of just logging what you watched, you're building the most detailed community skill database in the sport. Every rating shapes a player's radar chart. Every review adds context machines can't capture. Your taste in tennis becomes visible."

### Core Principles

1. **Data with soul** — Stats are everywhere. Opinions with context aren't. Courtside combines both — community-generated skill analysis that no official stat sheet provides.

2. **Earned credibility** — Achievement decals (small metallic badges) appear beside usernames everywhere. Tiers: common (watched 10 matches), uncommon (full Grand Slam), rare (100+ reviews), grail-level (early adopter, 500+ ratings). Banners, stickers, trophies. Your reputation is visible at a glance.

3. **Visual identity** — The category-weighted radar chart is the signature. Four colored quadrants, curved organic bezier lines, animated axis-by-axis on load. The shape is immediately recognizable as "Courtside" when screenshotted and shared.

4. **Community over content** — Not a news feed. A place where opinions live alongside others, disagreements are interesting, and your tennis taste profile evolves.

### Target Audience

Avid tennis watchers. People who follow both ATP and WTA tours, have opinions on technique, and want a permanent home for those opinions. The app's tone and density assumes familiarity with the sport — no beginner tooltips, no hand-holding. Casuals will find their way in later through the visual appeal of radar charts and shareable content.

### Coverage Scope

- **MVP:** ATP & WTA major tournaments only (Grand Slams + Masters 1000)
- **Post-launch:** Expand to full tour coverage as API setup stabilizes and user base grows
- Both tours from day one — Courtside takes women's tennis as seriously as men's

### Domain

courtside.net (check availability and register)

### Platform

Web-first (responsive, works beautifully on mobile browsers). PWA wrapper added post-MVP for home screen install. Native mobile app (React Native) planned relatively early but not for v1.

---

## 2. TECH STACK

| Layer | Tool | Purpose |
|-------|------|---------|
| Framework | Next.js 15 (App Router, TypeScript) | Pages, routing, SSR for SEO, server components |
| Styling | Tailwind CSS + shadcn/ui | Utility CSS + customizable owned component library |
| Charts | Custom SVG (hand-built) | Radar charts with curved bezier lines, no chart library |
| Auth | Clerk | Google, Apple, email sign-in. Prebuilt UI. Webhook syncs to Supabase |
| Database | Supabase (managed Postgres) | All tables, RLS, storage, edge functions, realtime (post-MVP) |
| Historical Data | Jeff Sackmann open-source datasets | Free seed data for players + matches (ATP + WTA) |
| Live Data | Paid tennis API (api-tennis.com or RapidAPI) | Ongoing match imports during major tournaments |
| Hosting | Vercel | Zero-config deploys from GitHub, preview URLs, analytics |
| Dev Tools | Claude Code (terminal agent) | AI-assisted development with CLAUDE.md project context |
| Version Control | Git + GitHub | Code repository, branch-based workflow |

### Monthly Costs

| Phase | Total |
|-------|-------|
| Development | ~$20 (Claude Pro only) |
| MVP Launch | ~$120–250 (Supabase $25, Clerk $25, Vercel $20, API $30–150, domain ~$1) |
| Growth | ~$120–260+ (scales with usage) |

---

## 3. CORE LOOPS

### Primary Loop: Watch → Rate → Review (The Snappy Match Rating)

This is the core interaction. It must feel instant and satisfying.

**Flow:**
1. User opens a match page
2. Taps sets watched (quick button selection: 1 set, 2 sets... Full Match, Highlights)
3. Three 1.0–10.0 sliders appear:
   - **Match rating** — how good was this match overall?
   - **Player 1 rating** — how well did they play?
   - **Player 2 rating** — how well did they play?
4. All three sliders go from 1.1 to 9.9 in 0.1 increments, with 10.0 as a perfect score
5. Optional written comment/review
6. Post

**Target time:** Under 20 seconds for a quick rating, a couple minutes with a thoughtful review.

**Key data produced:** The average of all Player 1/Player 2 ratings across their matches becomes the **consensus community rating** shown prominently on their profile.

### Secondary Loop: Player Skill Radar (The Deeper Engagement)

This is a separate activity from match ratings. Users rate player skills from the player's profile page at any time, or via an optional prompt after viewing a match.

**Flow:**
1. User navigates to a player's profile
2. Opens the "Rate Skills" panel
3. Rates the player across 11 skill axes grouped into 4 categories (see Section 4)
4. Submit

**Key data produced:** Aggregated community skill ratings build the radar chart displayed on the player's profile.

### Future Loops (Post-MVP)

- **Activity feed** — global + followed-users feed of recent reviews
- **Follow users** — personalized feed, following/followers count
- **Discussion threads** — comment threads on reviews
- **Live match threads** — real-time discussion during Grand Slams
- **Discovery** — leaderboards, top matches, trending players

The priority is building a rich data library of matches, ratings, and reviews first. Community features layer on top of that foundation.

---

## 4. PLAYER SKILL RADAR — FULL SPECIFICATION

### Categories and Axes (11 total, expert-defined)

| Category | Color | Axes |
|----------|-------|------|
| **Movement** | Blue (#4a9eff) | Speed, Court Coverage, Positioning |
| **Technique** | Green (#22d68a) | Serve, Forehand, Backhand |
| **Skill** | Gold (#f5c518) | Net Play, Touch, Reaction Time, Return Play |
| **Mental Strength** | Coral (#d4734e) | Mental Strength (standalone) |

### Chart Layout: Category-Weighted

Each of the 4 categories gets an equal quarter (90°) of the chart, then subdivides by its number of skills. This means Mental Strength — despite having only one axis — gets the same visual weight as Movement (3 axes) or Skill (4 axes). This is deliberate: mental game is arguably the single most important differentiator at the top level.

### Visual Design

- **Polygon lines:** Quadratic bezier curves (not straight lines) connecting data points — gives the shape an organic, athletic feel
- **Category arcs:** Subtle colored background wedges behind each quadrant so the four areas are visually distinct
- **Category dividers:** Slightly thicker lines at the quadrant boundaries
- **Axis lines:** Thin lines in the category's color, low opacity
- **Grid rings:** 5 concentric polygons (1–5 scale) in very low opacity white
- **Data dots:** Small circles at each data point, filled with the player's unique color, dark stroke
- **Player colors:** Each player's polygon uses a unique assigned color (not the category colors). Category colors stay fixed on axes and arcs. This allows clear dual-player overlay comparisons.
- **Labels:** Skill names at axis tips in category color (9.5px, DM Sans, 600 weight). Category names outside the chart in IBM Plex Mono, uppercase.
- **Animation:** On load, the polygon draws axis-by-axis with a staggered reveal
- **Skill breakdown bars:** Below the radar, a detail view showing exact numerical ratings grouped by category, with colored progress bars

### Comparison Mode

When comparing two players, both polygons overlay on the same chart. Each player's polygon is their unique color. The category colors on axes/arcs stay fixed. A legend below identifies which color is which player.

### Rating Scale

Each axis is rated 1.0–5.0 by users. Community aggregate is the average of all user ratings for that player on that axis.

---

## 5. FEATURE INVENTORY

### V1 (Launch) Features

**Player System:**
- **Player Profiles (API-powered)** — Bio, rank, country, age, career stats from tennis data API. Community consensus star rating (1.0–10.0 average from match ratings) displayed prominently. Rotating display of highly-rated comments from their matches. Official stats and community data visually distinct.
- **Skill Radar Chart** — 4 categories, 11 axes, category-weighted layout. Curved organic lines, animated on load. Separate rating activity from match reviews.
- **Player Quick Bubble** — Tap any player name anywhere in the app → popup with rank/seed, recent form (W/L last 10), link to full profile. Snappy spring animation. Dismisses on tap outside.
- **Player Comparison** — Any two players side-by-side with dual radar overlay and differential skill bars.

**Match System:**
- **Match Pages (API-powered)** — Auto-imported from tennis data API. Score, surface, tournament, round, date. Head-to-head radar overlay. Community reviews with per-player ratings.
- **Match Rating (3 sliders)** — Three 1.0–10.0 sliders: match overall + Player 1 performance + Player 2 performance. 0.1 increments, 10.0 as perfect. Sets watched selector. Optional comment.
- **Sets Watched Buttons** — Quick-tap: 1 set, 2 sets... Full Match, Highlights. Badge displayed on reviews for credibility.
- **Head-to-Head Rivalry Pages** — Half-screen split for each player profile. Full timeline of meetings, W/L record, surface breakdown. Clean and fast. URL structure: /h2h/alcaraz-vs-sinner
- **Match Browser** — Browse all matches with filters: surface, tournament, date, player. Sort by community rating, recency.

**Community:**
- **Reviews & Ratings** — Written reviews with three 1.0–10.0 slider ratings (match + both players). Like/upvote.
- **Comment Threads** — Reply to reviews. Threaded conversations. Notifications on replies.
- **User Profiles** — Username, avatar, bio. Review history, watch log, rating stats. Achievement decals. Public profile page.
- **Achievement Decals** — Small 16×16px badges beside usernames. Tiers: common (10 matches watched), uncommon (watched a full Grand Slam), rare (100+ reviews), grail (early adopter, 500+ ratings). Banners, stickers, trophies. Displayed on comments, reviews, and profiles. Subtle metallic/enamel style, never overwhelming.

**Personal:**
- **Watch Log** — Full catalogue in user profile. Every match watched, with the user's rating and comments. Stats by surface, tournament. The permanent record of your tennis fandom.
- **Seamless Auth** — Google, Apple, email via Clerk. Prebuilt UI. Thorough vetting with Claude Code during Phase 1.

### V2 (Post-MVP) Features

- Follow Users & Personalized Feed
- Activity Feed (global + followed)
- Prediction Picks (pure W/L, no gambling — accuracy leaderboard)
- Player Skill Trends (ratings over time — requires active user base)
- Leaderboards (top players, top matches, most active reviewers)
- PWA / Mobile App (PWA first, React Native relatively early post-launch)

### Future Features

- Live Match Threads (real-time during Grand Slams)
- Surface-Specific Ratings (separate radar per surface)
- Embeddable Widgets (radar charts for tennis blogs/newsletters)

---

## 6. DESIGN LANGUAGE

### Vibe

Premium sports analytics meets social community. Dark, atmospheric, confident. Not loud or sporty — more like a high-end data dashboard for tennis. The radar charts are the hero. Think: night-session tennis under floodlights — focused, intense, beautiful.

### Typography

| Font | Usage | Voice |
|------|-------|-------|
| **IBM Plex Mono** | Headings, scores, data, brand mark, ratings, match scores | The technical voice. Authoritative numbers, clean scores. |
| **DM Sans** | Body text, reviews, comments, UI labels, buttons | The human voice. Warm, readable, conversational. |

**Rule: Never mix.** Numbers always in IBM Plex Mono. Prose always in DM Sans.

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Background | #0e1116 | Page background |
| Surface | #1a1e26 | Cards, panels |
| Surface 2 | #22272f | Elevated elements, headers |
| Surface 3 | #2a303a | Borders, dividers |
| Primary (Green) | #22d68a | Actions, wins, brand, CTA buttons |
| Accent Blue | #4a9eff | Comparisons, Movement category |
| Text | #e8eaed | Primary text |
| Text Mid | #9ca3af | Secondary text |
| Text Dim | #6b7280 | Tertiary text, hints |
| Amber | #f5c518 | Warnings, highlights, Skill category |
| Red | #e74c3c | Losses, errors, destructive actions |
| Coral | #d4734e | Mental category |
| Hard Court | #4a90d9 | Surface badge |
| Clay Court | #d4734e | Surface badge |
| Grass Court | #5cb85c | Surface badge |

### Radar Chart Category Colors

| Category | Color | Dim Fill |
|----------|-------|----------|
| Movement | #4a9eff (Blue) | rgba(74,158,255,0.12) |
| Technique | #22d68a (Green) | rgba(34,214,138,0.12) |
| Skill | #f5c518 (Gold) | rgba(245,197,24,0.12) |
| Mental | #d4734e (Coral) | rgba(212,115,78,0.12) |

### Design Rules

1. Radar charts are the visual hero — curved organic lines, category-weighted quarters, animated on load
2. Dark theme only. No light mode at v1.
3. Surface badges (Hard/Clay/Grass) color-coded consistently everywhere
4. Player names always tappable — dashed underline, quick bubble on tap
5. Numbers in IBM Plex Mono. Prose in DM Sans. Never mix.
6. Green = actions & wins. Red = losses. Blue = comparisons. Amber = highlights.
7. Cards: subtle borders (rgba(255,255,255,0.05)), very low-opacity backgrounds (rgba(255,255,255,0.03)). Never solid fills.
8. Animations: fast (150–200ms), functional, not decorative. Spring physics for bubbles.
9. Mobile-first responsive. Touch targets 44px minimum. No horizontal scrolling.
10. Achievement decals: 16×16px, subtle metallic/enamel style. Never overwhelming.

---

## 7. DATABASE SCHEMA

### Tables

**players**
```
id, name, country, age, current_rank, image_url, api_id, career_stats_json, created_at
```

**matches**
```
id, player1_id, player2_id, tournament, round, score, surface, date, winner_id, api_match_id
```

**reviews** (all three ratings required)
```
id, user_id, match_id, match_rating (1.0–10.0), player1_rating (1.0–10.0), player2_rating (1.0–10.0), comment, sets_watched, created_at, updated_at
```

**skill_ratings** (separate from match ratings — 11 axes)
```
id, user_id, player_id, speed, court_coverage, positioning, serve, forehand, backhand, net_play, touch, reaction_time, return_play, mental_strength, created_at
```

**profiles**
```
id, clerk_user_id, username, display_name, avatar_url, bio, created_at
```

**follows**
```
follower_id, following_id, created_at
```

**comments**
```
id, user_id, review_id, parent_comment_id, text, created_at
```

**watched_matches**
```
user_id, match_id, watched_at
```

**achievements**
```
id, user_id, achievement_type, tier (common/uncommon/rare/grail), earned_at
```

**h2h_cache**
```
player1_id, player2_id, total_matches, p1_wins, p2_wins, last_updated
```

### Two Rating Systems

**Match ratings** (reviews table): Three quick 1.0–10.0 sliders — match overall, Player 1, Player 2. This is the primary interaction. The average of all per-player ratings across matches becomes the **consensus community rating** displayed on player profiles.

**Skill ratings** (skill_ratings table): 11-axis radar chart data. Users rate from player profiles as a separate, deeper activity. Aggregated averages across all users build the community radar chart for each player. Grouped into 4 categories with category-weighted chart layout.

### Row-Level Security (RLS)

- **Anyone can READ:** players, matches, reviews, skill_ratings, profiles, comments
- **Authenticated users can INSERT:** reviews, skill_ratings, comments, watched_matches
- **Users can UPDATE/DELETE only their own:** reviews, skill_ratings, comments
- **Admin only:** INSERT/UPDATE players, matches (API sync also writes here)
- **Follow/unfollow:** users can only manage their own follows

---

## 8. DATA STRATEGY

### Layer 1: Free Historical Seed (Jeff Sackmann)

- **Source:** github.com/JeffSackmann/tennis_atp and tennis_wta
- **Content:** Player bios, match results, rankings, match stats back to 1991
- **Format:** CSV files, updated periodically
- **License:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0
- **Cost:** $0
- **Use:** Seed entire historical database — players table and matches table (majors only for MVP)

### Layer 2: Paid API for Live Tournaments

- **Recommended:** api-tennis.com or a RapidAPI tennis endpoint
- **Content:** Live/recent match scores, player profiles, tournament schedules
- **Cost:** ~$30–150/month depending on tier
- **Use:** Ongoing match imports during major tournaments (Grand Slams + Masters)
- **Volume:** Majors-only means ~1,000–2,000 API calls per tournament — well within cheap tiers

### What the API Provides vs What the Community Provides

**From API:** Player bios (name, country, age, ranking, career stats), match results (score, date, surface, tournament, round, winner), tournament schedules.

**From community:** Match star ratings (1.0–10.0), per-player match ratings, written reviews, 11-axis skill radar ratings, watch log data, comments, follows, achievement progress.

### Important: One Source, Not Aggregated

Pick one paid API. Validate against Sackmann data for historical accuracy. Multi-source aggregation adds complexity for marginal data quality improvement.

---

## 9. KEY UI COMPONENTS

### Player Quick Bubble

Appears when tapping any player name anywhere in the app. Fixed position popup with:
- Header: Avatar, name, country flag, rank, age, overall skill average
- Recent form: Color-coded W/L bar (green=win, red=loss) for last 10 matches
- Last 5 results: Opponent name, surface badge, tournament abbreviation — each tappable to go to that match
- "View Full Profile →" button
- Spring animation on open (0.18s ease-out, scale from 0.92)
- Auto-detects screen position and flips upward if near bottom
- Dismisses on tap outside

### Sets Watched Selector

Row of pill buttons on the match review form. Options generated dynamically from the match score (a 5-set match shows "1 Set" through "5 Sets" plus "Full Match" and "Highlights"). Color-coded: green for full match, blue for most of the match, yellow/amber for partial or highlights. Badge appears on published reviews.

### 1.0–10.0 Rating Slider

Custom slider component. Range 1.1 to 9.9 in 0.1 increments, with 10.0 available as a perfect score. Visual design: track with filled portion, current value displayed prominently in IBM Plex Mono. Three instances on each match review (match + player 1 + player 2).

### Rotating Player Comments

On player profiles, a component that cycles through the highest-rated community comments mentioning this player. Smooth crossfade animation. Sourced from reviews of matches this player was in, sorted by likes/upvotes.

### Achievement Decals

16×16px badges rendered beside usernames in all contexts (comments, reviews, profile headers, leaderboards). Metallic/enamel visual style. Examples:
- 🥉 Watched 10 matches (common)
- 🏅 Watched a full Grand Slam (uncommon)
- 🏆 100+ reviews (rare)
- 💎 Early adopter / 500+ ratings (grail)

---

## 10. PAGE STRUCTURE

### /players
List of all players with search and filter. Each card shows: avatar, name, country, rank, community consensus rating (1.0–10.0), total number of ratings.

### /players/[id]
Player profile page. Sections:
- Header: avatar, name, country, rank, age, consensus rating
- Rotating top comments
- Skill radar chart (community-aggregated, category-weighted)
- Skill breakdown bars (toggleable detail view)
- "Rate Skills" button → opens 11-slider form grouped by 4 categories
- Match history (W/L with surface badges, tappable)
- Community reviews mentioning this player

### /matches
Match browser. Filters: surface, tournament, date range, player. Sort by community rating or recency.

### /matches/[id]
Match page. Sections:
- Match header: tournament, round, both players (tappable → quick bubble), score, surface badge
- Head-to-head radar overlay (both players' skill charts)
- "Rate This Match" form: sets watched buttons + three 1.0–10.0 sliders + comment
- Community reviews with per-player ratings and sets-watched badges

### /h2h/[player1]-vs-[player2]
Rivalry page. Half-screen split:
- Left: Player 1 profile summary + stats in this matchup
- Right: Player 2 profile summary + stats in this matchup
- Below: Full timeline of meetings, W/L record, surface breakdown, how ratings evolved across meetings

### /compare
Player comparison tool. Two dropdowns to select players. Dual radar overlay with legend. Differential skill bars showing advantages/disadvantages per axis.

### /profile/[username]
User profile. Username, avatar, bio, achievement decals. Tabs: Watch Log (full catalogue with ratings), Reviews (all reviews written), Stats (surfaces watched, tournaments, rating distribution).

---

## 11. BUILD ROADMAP

### Phase 0: Environment & Foundations (Day 1–2)
GitHub repo, accounts (Supabase, Clerk, Vercel), Next.js scaffold with TypeScript + Tailwind + shadcn, CLAUDE.md + CHECKLIST.md in project root, deploy starter to Vercel, register courtside.net domain.

### Phase 1: Database, Auth & Data Import (Week 1–2)
All Supabase tables + foreign keys + indexes, RLS policies, Clerk auth with Google/email, Clerk → Supabase profile sync webhook, evaluate tennis data APIs, download Sackmann datasets, write import scripts for players and matches (majors only), set up paid API connection.

### Phase 2: Core Pages & Radar Charts (Week 3–4)
Player profiles with API stats + rotating top comments, category-weighted radar chart component, skill breakdown bars, match pages, player comparison with dual radar overlay, H2H rivalry pages (split screen), player quick bubble, match browser, dark theme with CSS variables, surface badges, responsive audit.

### Phase 3: Rating System & User Features (Week 5–7)
1.0–10.0 slider component, sets watched buttons, match review form (3 sliders + comment), connect to Supabase, rating aggregation → consensus profile rating, skill rating form on profiles (11 sliders, 4 categories), skill aggregation → radar chart, edit/delete own reviews, comment threads, user profiles with review history + watch log, watch log catalogue, achievement decal system.

### Phase 4: Polish & Performance (Week 8–9)
Server components for data pages, database indexes for slow queries, image optimization, dynamic OG images for player/match/H2H pages, sitemap.xml + robots.txt, slider and rating animation polish, toast notifications, empty states, accessibility audit, cross-browser testing.

### Phase 5: Testing & Launch (Week 10–12)
Full QA of all user flows, RLS testing, edge case testing, error tracking (Sentry), seed 10–20 quality reviews, inner circle testing (15–30 users), connect courtside.net domain, Supabase Pro upgrade, soft launch in tennis communities (r/tennis, Tennis Twitter, Discord).

### MVP Definition

Players + matches + 3-slider match ratings + skill radar (4 categories, 11 axes) + reviews + watch log + user profiles + achievement decals. Activity feed and follows layer on after the data library is rich enough to browse.

---

## 12. GROWTH STRATEGY (Post-Launch)

### SEO (Long-term, mostly structural)
Every player profile, match page, and H2H rivalry page is a unique indexable URL with community content. Clean URLs (/h2h/alcaraz-vs-sinner), proper meta tags, dynamic OG images showing radar charts, structured data markup. Next.js SSR handles technical SEO automatically. Community reviews provide unique text content for ranking.

### Inner Circle Phase (Month 1–2)
15–30 active users from local tennis networks. Goal: feed looks alive with reviews from last 48 hours. Share personally, not publicly. "I'm building this, would love your honest ratings."

### Organic Seeding (Month 2–4)
Participate in tennis communities naturally (r/tennis, Tennis Twitter, Discord). Share radar chart comparison images with courtside.net watermark — people share interesting visualizations. Don't post "check out my app." Post data that's worth discussing.

### Grand Slam Timing
Tennis attention spikes massively during the four majors. Have app ready with healthy seed community before a Slam starts. Shareable content: radar charts, post-match review roundups, community awards.

### "It's got legs" Signal
When people share Courtside links you didn't prompt them to share. When someone posts a radar chart in a group chat without being asked. Until that happens organically, paid promotion is premature.

---

## 13. DEVELOPMENT WORKFLOW

### Tools
- **Claude.ai (Opus):** Design decisions, planning, feature specs, document generation
- **Claude Code (terminal):** Implementation, coding, debugging, multi-file edits
- **Cursor (optional):** IDE with AI integration for hands-on polish work

### Claude Code Setup
1. Project folder: ~/projects/courtside-app
2. CLAUDE.md in project root — stack, conventions, current phase
3. CHECKLIST.md in project root — trackable build progress
4. Launch Claude Code from project root: `cd ~/projects/courtside-app && claude`
5. Each session: read CHECKLIST.md, pick next unchecked item, /plan, execute, test, commit

### Ground Rules for AI-Assisted Development
1. **One feature at a time.** Don't ask AI to build the whole app. Build one component, one route, one function. Review, test, commit, move on.
2. **Always read before you paste.** Understand what the code does. If you can't explain a line, ask for explanation before shipping it.
3. **Own your database.** Schema, RLS policies, and data model are the most important decisions. Design yourself, AI can draft.
4. **Git commit after every working feature.** Small commits = easy rollback. This is your safety net.
5. **Test with real data early.** Seed with Sackmann data by Phase 2. Fake data hides design problems.

### Project Isolation
Claude Code is scoped to whichever directory you launch from. Different projects in different folders = zero cross-contamination. The CLAUDE.md in each project root reinforces what that project is.

### Credentials
- **In the project (.env.local, gitignored):** API keys, Supabase URL, Clerk keys — Claude Code needs these
- **In a password manager (outside the project):** Dashboard passwords for Supabase, Clerk, Vercel, GitHub, domain registrar — Claude Code never needs these

---

## 14. FILES TO GENERATE FOR PROJECT SETUP

When starting development, generate these files for the project folder:

1. **CLAUDE.md** — Project context for Claude Code (stack, conventions, folder structure, current phase)
2. **CHECKLIST.md** — Markdown checkbox version of the build checklist
3. **docs/architecture.md** — How the pieces connect (Clerk → Supabase sync, API → database, rating aggregation)
4. **docs/data-strategy.md** — Sackmann seed approach + paid API setup
5. **docs/rating-system.md** — The 1.0–10.0 slider behavior and how the two rating systems work
6. **docs/radar-spec.md** — Full radar chart specification (categories, colors, weighted layout, bezier curves)
7. **.env.local.example** — Template showing all required environment variables (no actual keys)

---

## APPENDIX A: Prototype Artifacts Created

During the design phase, the following interactive prototypes were created in Claude.ai:

1. **courtside.jsx** — Full app prototype with feed, player profiles, match pages, radar charts, player quick bubbles, sets watched selector, comparison tool, watch log
2. **courtside-radar-v2.jsx** — Radar chart explorer with category-weighted layout, player comparison, skill breakdown bars, equal vs weighted toggle
3. **courtside-vision.jsx** — Interactive vision and feature spec document
4. **courtside-build-checklist.html** — Downloadable interactive checklist with localStorage progress tracking (7 tabs: Vision, Core Loop, Features, Design, Data & API, Checklist, Roadmap)
5. **courtside-build-guide-dark.docx** — Dark mode Word document version of the build guide
6. **courtside-accounts.xlsx** — Service account tracker spreadsheet (3 tabs: Service Accounts, Env Variables, Monthly Costs)

These can be referenced for visual direction but should not be used as production code.
