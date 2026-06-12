# Courtside Code Review — June 12, 2026

> **STATUS UPDATE (same day):** All critical and high-priority items below were
> fixed and verified. Match dates were backfilled (8,999/8,999), stat sorting
> and the tournament dropdown work, error boundaries are in place, server-side
> validation was added, and RLS was probe-verified (anon key cannot write).
> One additional bug was found during verification and fixed: the middleware
> was blocking `/sitemap.xml`, `/robots.txt`, and `/guide` behind sign-in.
> Still open (deliberately deferred): rate limiting (S5), admin-client
> consolidation (P3), feed caching (P4), and the pre-existing React-compiler
> lint warnings in a few components.

**Scope:** Full codebase review focused on keeping the app live, plus optimization suggestions.
**Method:** Production build + lint run, every page's data-fetching reviewed, all server actions audited for auth, and suspected bugs **verified against the live database** with read-only probes.

---

## Executive Summary

The app is in good shape where it matters most: the production build compiles cleanly, every server action checks authentication, the Clerk webhook verifies signatures, secrets are kept out of git, and the service-role key never reaches the browser. There is no risk of the site going down from anything obvious.

However, the review found **four confirmed live bugs** (verified against the production database, not just suspected from reading code) and **one structural gap** that turns any future hiccup into a blank error page for users. None of these will take the site offline today, but three of them mean features are silently broken or showing wrong data right now.

**Top 5 priorities, in order:**

1. Add error boundaries (`app/error.tsx` + `app/global-error.tsx`) — currently one thrown error = unstyled crash page
2. Fix missing `match_date` data — 8,997 of 8,999 matches have no date, silently breaking sorting, the year filter, and the feed's "Top-25 Clashes"
3. Fix player stat sorting — confirmed broken (the database rejects the query outright)
4. Fix the tournament filter dropdown — confirmed showing only 4 of 86 tournaments
5. Add server-side input validation — rating ranges and text lengths are only enforced in the browser, which a malicious user can bypass

---

## What's Working Well

Worth saying explicitly, because a lot of this is the hard part:

- **Authentication is solid.** All 8 server action files call `auth()` and reject unauthenticated requests. Deletes and edits verify ownership (`.eq("user_id", profile.id)`) so users can't delete each other's content. Profile edits check `clerk_user_id` matches before writing.
- **The Clerk webhook is properly secured** ([route.ts](app/api/webhooks/clerk/route.ts)) — it verifies the Svix signature before trusting anything, returns proper error codes, and deliberately avoids overwriting user-chosen display names.
- **Secrets are handled correctly.** `.env.local` is gitignored (verified — not in git history), the service-role key is only ever used in server-side code (verified — no `"use client"` file touches it), and clients are created lazily so builds don't fail on missing env vars.
- **Queries are batched smartly.** The match detail page fetches all comments in one query and all reactions in one query instead of one-per-review (the classic "N+1" mistake). Page-level queries run in `Promise.all` blocks.
- **Achievements checking is resilient** — wrapped in `.catch(() => [])` so a failure there can never break a review submission, with an early exit when everything's already earned.
- **Production build passes cleanly** — TypeScript compiles, all 26 routes generate.

---

## 🔴 Critical — Fix First

### C1. No error boundaries — one error = blank crash page

**Files:** none exist — that's the problem. There is no `app/error.tsx` or `app/global-error.tsx` anywhere.

Every page talks to Supabase on every request. If Supabase has a 30-second blip, a query times out, or any unexpected data shape throws — the user sees Next.js's default unstyled error screen with no nav, no branding, no way back. For an app whose goal is "stay live," this is the single highest-value fix: with error boundaries, a database hiccup shows a friendly "something went wrong, try again" card inside your normal layout instead of a dead page.

**Fix (small):** Add `app/error.tsx` (catches page errors, keeps nav alive, offers a retry button) and `app/global-error.tsx` (last-resort catch). Roughly 40 lines total. While there, add a custom `app/not-found.tsx` for polish.

### C2. `match_date` is missing on 8,997 of 8,999 matches — VERIFIED

**Probe result:** `matches with match_date: 2 / total: 8999`

Nearly every match row has a NULL date. The tournament name carries the year ("US Open 2024") so pages still *look* right, but this silently breaks:

- **Match list ordering** ([app/matches/page.tsx:125](app/matches/page.tsx)) — `.order("match_date", ...)` on all-null values means the order is effectively arbitrary
- **Year filter** ([app/matches/page.tsx:63](app/matches/page.tsx)) — derives the year dropdown from `match_date`, so it only finds 2023 and 2024 (from the 2 dated rows), and filtering by year range excludes nearly everything
- **Feed "Top-25 Clashes"** ([app/feed/page.tsx:137](app/feed/page.tsx)) — filters matches to the last 30 days by `match_date`, so this section is almost always empty
- **Match detail page date display** — almost never shows

**Fix (medium):** Backfill `match_date` from the import source (the MatchStat API provides dates; a one-time script in `/scripts/` following the existing phase-script pattern). Until then, sort and filter by `tournament_season` (the column already exists) instead of `match_date`.

### C3. Player stat sorting is broken — VERIFIED

**File:** [app/players/page.tsx:147](app/players/page.tsx)

When a user sorts the players list by a stat (win %, etc.), the code builds one query containing **all 759 ATP player IDs twice** — a ~56,000-character request. The probe confirmed the database rejects it: `ERROR: Bad Request`. So stat sorting currently fails outright. Even if the request succeeded, the query has no limit, so it would be silently capped at 1,000 of ~9,000 matches and compute wrong stats (see C5).

**Fix (medium):** Don't filter by player IDs at all — every match in your DB involves these players anyway. Page through all matches once (or better: pre-compute win/loss stats per player at import time, or in a database view, and read that). This also makes the page much faster.

### C4. Tournament filter dropdown shows 4 of 86 tournaments — VERIFIED

**File:** [app/matches/page.tsx:62](app/matches/page.tsx)

The dropdown is built by fetching the first 500 rows sorted alphabetically by tournament name and de-duplicating. Because "Australian Open 2020–2023" alone fills 500+ rows, the probe confirmed the dropdown contains exactly: *Australian Open 2020, 2021, 2022, 2023* — and nothing else. Users cannot filter by 82 of the 86 tournaments.

**Fix (small):** Tournament names are predictable — derive the list from `lib/tournamentTiers.ts` constants, or create a tiny Postgres view/RPC that returns `SELECT DISTINCT tournament FROM matches` (86 rows, instant).

### C5. The silent 1,000-row cap — a recurring trap

**Probe result:** an unlimited `select` on matches returned exactly **1,000 rows** out of 8,999, with no error.

Supabase caps every query at 1,000 rows by default and *doesn't tell you*. Queries written as "fetch everything" quietly return partial data. Confirmed affected:

- **Sitemap** ([app/sitemap.ts](app/sitemap.ts)) — includes 1,000 of ~9,000 match pages; ~8,000 pages are invisible to Google
- **Stat-sort matches query** (C3 above) — would compute stats from 1/9th of the data
- **Min-rating filter** ([app/matches/page.tsx:93](app/matches/page.tsx)) — fetches *all* reviews to average them. Fine today (5 reviews), silently wrong the day you pass 1,000 reviews, and increasingly expensive before then

**Fix (small each):** Page through results with `.range()` where "all rows" is genuinely needed (sitemap), add explicit limits elsewhere, and move averaging to the database (a view like `match_avg_ratings` computes averages in SQL — one row per match instead of every review row shipped to the server).

---

## 🟠 Security Hardening

Overall posture is good (see "What's Working Well"). These are belt-and-suspenders items, roughly in priority order:

### S1. `getExistingReview` trusts a caller-supplied user ID

**File:** [app/matches/[id]/review/actions.ts:98](app/matches/[id]/review/actions.ts)

Because this file is marked `"use server"`, every exported function is a public endpoint. This one accepts `clerkId` as a parameter — meaning anyone can call it with anyone else's ID. Impact is low (reviews are public content anyway), but the pattern is dangerous: if this function is ever extended to return something private, it becomes a data leak. Server actions should always derive identity from `auth()`, never accept it as an argument.

**Fix (tiny):** Call `auth()` inside the function; drop the parameter.

### S2. No server-side input validation

The browser enforces slider ranges and reasonable text lengths — but server actions trust whatever arrives, and a malicious user can call them directly:

- **Ratings** ([review/actions.ts:29-31](app/matches/[id]/review/actions.ts)) — `parseFloat` with no range check. Someone could submit a rating of 99999 (poisoning every community average on the site) or NaN
- **Comment body** ([comments/actions.ts:21](app/matches/[id]/comments/actions.ts)) — checked for non-empty, but no max length. A 10 MB comment would be stored and rendered
- **Bio / display name** ([edit/actions.ts](app/profile/[username]/edit/actions.ts)) — no length caps
- **Reaction emoji** ([app/actions/reactions.ts:16](app/actions/reactions.ts)) — accepts any string, not just the three valid emojis

**Fix (small):** Clamp ratings to 1.0–10.0 and reject NaN; cap comment/bio/display-name lengths (e.g. 2000/300/50 chars); whitelist emoji values. ~15 lines across 4 files.

### S3. User input interpolated into query filters

**Files:** [app/api/search/route.ts:34](app/api/search/route.ts), [app/matches/page.tsx:152](app/matches/page.tsx)

Search text and the `player` URL parameter are embedded directly into `.or(...)` filter strings. This is *not* SQL injection (Supabase still parameterizes), but special characters (commas, parens) can break the filter syntax — failed searches at minimum, filter manipulation at worst. The same `.or()` pattern with the `player` param should be a UUID — validate it.

**Fix (small):** Strip `,().` from search input before building the pattern; validate `player` against a UUID regex before using it.

### S4. Verify RLS policies in the Supabase dashboard

All writes correctly go through the service-role client. That design only holds if the **anon key has zero write policies** — otherwise someone could write to tables directly with the public key from the browser. This can't be verified from the codebase. **One-time check:** Supabase Dashboard → Authentication → Policies — confirm no INSERT/UPDATE/DELETE policies exist for `anon` on any table.

### S5. No rate limiting (note for later)

Nothing prevents a script from submitting thousands of reviews/comments or hammering `/api/search` (which hits the DB on every call). Not urgent at current scale — Vercel provides basic DDoS protection — but worth adding before any growth push (Vercel WAF rules or a simple Upstash rate limiter on the search route and write actions).

---

## 🟡 Performance & Cost Optimizations

### P1. Home page: caching is configured but not working

**File:** [app/page.tsx:9](app/page.tsx)

`export const revalidate = 300` is meant to cache the page for 5 minutes — but the page also calls `auth()`, which forces fully dynamic rendering. The build output confirms `/` is dynamic, so the revalidate line is dead code. Result: **7 database queries on every single home page visit**, including 4 table-wide count queries, for stats that change slowly.

**Fix (small):** Wrap the 6 public queries (top players, recent reviews, 4 counts) in `unstable_cache(..., { revalidate: 300 })`. Keep the per-user guide-banner query live. Cuts home page DB load by ~85%.

### P2. Duplicate match fetch on the match page

**File:** [app/matches/[id]/page.tsx:19-31](app/matches/[id]/page.tsx)

`generateMetadata` and the page body each fetch the same match — two round trips where one would do. **Fix (tiny):** wrap the fetch in React's `cache()` so both share one query.

### P3. Eight inline copies of the admin client

`createClient(url, SERVICE_ROLE_KEY)` is hand-rolled in 8+ files even though [lib/supabase.ts](lib/supabase.ts) exports `getSupabaseAdmin()` for exactly this. Not a bug — but if the key name or client options ever change, that's 8 places to update (and 8 places to get a security review wrong). **Fix (small):** import `getSupabaseAdmin()` everywhere. *(Flagging per convention — only refactor when you say go.)*

### P4. Feed page weight (fine today, watch it)

[app/feed/page.tsx](app/feed/page.tsx) is force-dynamic and pulls 150 reviews + 150 ratings (all 17 skill columns each) + 200 matches per view. Bounded and acceptable now; if the feed gets traffic, a 60-second cache on the "Everyone" tab would remove most of the load. No action needed yet.

### P5. Unbounded reviews on the match page (future-proofing)

[app/matches/[id]/page.tsx:98](app/matches/[id]/page.tsx) fetches all reviews for the match with no limit. Harmless now; add `.limit(200)` (or pagination) so one viral match can't render 1,000+ review cards on a single page.

---

## 🟢 Minor / Cleanup

- **Lint: 14 errors, 14 warnings** (build is unaffected — Next.js doesn't run ESLint during builds). 3 are auto-fixable with `eslint --fix`. Notables: a `setState`-in-effect warning in [ToastItem.tsx:29](components/toast/ToastItem.tsx) (can cause an extra render flash), a forbidden `require()` in `docs/tailwind.config.ts` (stale file — likely deletable given Tailwind v4 doesn't use it), and unused variables in import scripts.
- **`loading.tsx` exists for 4 routes** (players, matches, and their detail pages) — nice. The feed, profile, and h2h pages would benefit from the same skeleton treatment since they're the slowest queries.
- **Sitemap is build-time static** — it only refreshes when you deploy. Fine for now; combine with the C5 fix so it includes all matches.

---

## Suggested Order of Work

| # | Item | Effort | Why this order |
|---|------|--------|----------------|
| 1 | Error boundaries (C1) | ~30 min | Biggest "stays live" win, zero risk |
| 2 | Input validation (S2) + `getExistingReview` fix (S1) | ~30 min | Protects data integrity before users grow |
| 3 | Tournament dropdown (C4) | ~30 min | User-visible broken feature, cheap fix |
| 4 | `match_date` backfill (C2) | 2–4 hrs | Unblocks ordering, year filter, feed clashes |
| 5 | Stat sorting rewrite (C3) | 2–3 hrs | Currently fully broken |
| 6 | Home page caching (P1) | ~1 hr | Largest DB-load reduction per line of code |
| 7 | 1,000-row cap fixes: sitemap, minRating (C5) | 1–2 hrs | Correctness as data grows |
| 8 | RLS dashboard check (S4) | 10 min | One-time verification |
| 9 | Search input sanitizing (S3), lint cleanup, rest | as time allows | Hardening + hygiene |

Items 1–3 together are about a morning's work and remove the worst risks.

---

*Review performed against commit `1982d74` ("Masters Add") with a clean working tree. Database probes were read-only.*
