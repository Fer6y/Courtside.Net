# Courtside Code Review — July 1, 2026

**Scope:** Full codebase audit (follow-up to the June 12 review) plus a design for
automatically refreshing new matches — see `docs/live-match-refresh-plan.md`.
**Method:** Production build + lint run, all pages/server actions/API routes read,
suspected issues verified against the live site and production database with
read-only probes.

---

## Executive Summary

The June 12 fixes all held up: error boundaries exist, every server action
validates input and derives identity from `auth()`, search input is sanitized,
the sitemap and stat queries page past the 1,000-row cap, the tournament
dropdown is complete, and the home page caches its public queries. The
production build compiles cleanly on Next 16.

This audit found **one confirmed user-facing bug** (verified against the live
site), **two landmines in the import scripts** (verified against the production
database), and the **structural gap** this review was commissioned for: there
is no mechanism to import new matches — Wimbledon 2026 is being played right
now and has **zero rows** in the catalogue.

---

## 🔴 Critical

### C1. Search, player lookup, and bubbles are broken for logged-out visitors — VERIFIED LIVE

**Files:** [proxy.ts](../proxy.ts) (the route allowlist)

`/api/search`, `/api/players/search`, and `/api/players/[id]/bubble` are not in
the middleware's public-route list, so Clerk blocks them for guests. Verified
against production: both search endpoints return **404** with no session.

What silently fails for a logged-out visitor:
- **Global search (⌘K)** — `components/GlobalSearch.tsx` gets a 404, shows nothing
- **Player bubbles** — `PlayerNameWithBubble` popups never load on public match/player pages
- **Player filter on /matches** — the name-search box in `MatchFilterBar` returns no results
- **Compare picker** — `ComparePlayerPicker` cannot find players

These are all read-only public data; nothing sensitive is exposed by opening them.

**Fix (tiny):** add to `isPublicRoute` in proxy.ts:
```ts
"/api/search(.*)",
"/api/players(.*)",
```

### C2. No pipeline for new matches — Wimbledon 2026 has 0 rows — VERIFIED

**Probe result:** latest match in catalogue = Roland Garros 2026 (June 7).
`Wimbledon 2026` rows: **0**. The tournament started June 29.

Users cannot review any match from the Slam being played right now. Every
import so far has been a manually run script. Full design for fixing this
permanently: **`docs/live-match-refresh-plan.md`**.

---

## 🟠 Import-script landmines (will bite the next import)

### L1. `phase2d-process-matches.ts` now silently drops ~400 players — VERIFIED

**File:** [scripts/phase2d-process-matches.ts:137](../scripts/phase2d-process-matches.ts)

The script builds its `api_player_key → UUID` map with an **unbounded select**.
Probe result: **1,408 players** now have `api_player_key` — past Supabase's
silent 1,000-row cap. If phase2d runs today, ~408 players are missing from the
map and every match involving them is **silently skipped** (they just count as
"skipped (missing player keys)").

The newer `reimport-slams.ts` / `reimport-masters.ts` page correctly via their
own `fetchAllPlayers()`; phase2d never got that fix.

### L2. `phase2d` writes bare `api_event_key`s — collides with the Masters convention

**File:** [scripts/phase2d-process-matches.ts:194](../scripts/phase2d-process-matches.ts)

Since the June Masters cleanup, Masters rows use tour-namespaced keys
(`ATP-<id>` / `WTA-<id>`, see reimport-masters.ts:240) because raw ATP and WTA
match ids overlap. phase2d still writes bare ids for everything. Running it on
staged Masters fixtures would re-introduce cross-tour collisions and create
duplicates alongside the namespaced rows.

### L3. `npm run fetch:masters` still points at the date-window discovery method

**Files:** [package.json](../package.json), [scripts/fetch-masters.ts](../scripts/fetch-masters.ts)

Date-window discovery is the method that caused the wrong-seasonId disease.
The verified path is identity-based (`probe-masters-seasonids.ts` →
`tournament/info` name + tier check). fetch-masters.ts has a draw-size guard
(≥45 singles) but no identity check — an Olympics draw (63 matches) would pass
it. The npm script makes the wrong tool the easy one to reach for.

**Recommendation for all three:** retire phase2d and fetch-masters from
package.json (keep the files for reference) once the refresh pipeline exists —
it replaces both. Until then, treat `reimport-*.ts` as the only sanctioned
importers.

---

## 🟡 Moderate

- **M1. Unvalidated `year` param on /matches** — `?year=abcd-efgh` becomes
  `gte("match_date", "abcd-01-01")`, the query errors, and the page shows
  "Failed to load matches." Validate with a `/^\d{4}-\d{4}$/` test before use.
  ([app/matches/page.tsx:194](../app/matches/page.tsx))
- **M2. Set-count filter miscounts retirements** — `scoreSetCount` counts
  space-separated tokens, so "6-3 2-1 RET" counts as 3 sets and "W/O" as 1.
  Count only tokens matching `/^\d+-\d+/`.
  ([app/matches/page.tsx:38](../app/matches/page.tsx))
- **M3. Level filter ignores the `tournament_tier` column** — /matches filters
  slam/masters by name patterns even though every row carries
  `tournament_tier`. Works today; brittle as sponsor names drift. Swap to
  `.eq("tournament_tier", …)` when convenient.
- **M4. Players page queries are unbounded** — the per-tour players select and
  the all-reviews excerpt query have no paging. ATP ≈ 700 rows today (under
  the cap) but live imports add players every event; same trap as L1
  eventually. ([app/players/page.tsx:185](../app/players/page.tsx))
- **M5. `dotenv` is not a declared dependency** — every import script imports
  it, but it only exists as a transitive dependency. A clean install or
  dedupe could break all scripts. `npm i -D dotenv`.
- **M6. Webhook username collisions** — two Clerk users resolving to the same
  username (e.g. same first+last name, no Clerk username) → unique violation →
  500 → Clerk retries forever. Append an id fragment on conflict.
  ([app/api/webhooks/clerk/route.ts:60](../app/api/webhooks/clerk/route.ts))

## 🟢 Minor / hygiene

- **Lint: 43 errors, 14 warnings** — nearly all `any` types in one-off scripts;
  a few app-side warnings (feed, players/[id], profile/[tab], several
  components). Build unaffected.
- **`h2h_cache` is dead** — no app code reads it (the H2H page computes from
  `matches` directly). One less thing for the refresh pipeline to maintain;
  drop the table whenever.
- **CLAUDE.md references `.env.local.example`** — the file doesn't exist.
- **Admin-client copies** — still hand-rolled in many files (deferred P3 from
  June; left alone per "no unasked refactors").

---

## What's verified healthy (June fixes held)

- Error boundaries (`app/error.tsx`, `global-error.tsx`, `not-found.tsx`) in place
- All server actions: `auth()`-derived identity, rating range checks, length
  caps, emoji/skill whitelists, ownership checks on deletes
- Search input sanitized; UUID validation before `.or()` interpolation (matches
  page and bubble route)
- Sitemap, stat-sort matches, minRating reviews, rankings sync: all paged past
  the 1,000-row cap via `fetchAllRows`
- Tournament dropdown derives from a paged distinct list (all 86+ shown)
- Home page public queries cached 5 min via `unstable_cache`; match page
  reviews capped at 200
- Match UI (cards + detail) renders null `score`/`winner_id` gracefully —
  important for the live pipeline
- Production build: clean, all routes compile

## Suggested order of work

| # | Item | Effort |
|---|------|--------|
| 1 | Public API routes fix (C1) | 5 min |
| 2 | One-off Wimbledon 2026 import (C2 stopgap) | 2–3 hrs |
| 3 | Live refresh pipeline (C2, see plan doc) | ~1 day |
| 4 | Retire phase2d + fetch:masters npm scripts (L1–L3) | 15 min |
| 5 | M1/M2 input robustness on /matches | 30 min |
| 6 | dotenv dependency, webhook collision, lint pass | as time allows |

---

*Review performed against commit `261ac29` ("new filters") with a clean working
tree. Database and live-site probes were read-only.*
