# Live Match Refresh — Design

**Goal:** a match from any tracked tournament (Grand Slams + Masters/WTA 1000)
is reviewable on Courtside within ~30 minutes of its conclusion, automatically,
with no manual script runs — and with the wrong-seasonId protections built in
from day one.

**Status:** designed July 1, 2026 (during Wimbledon 2026, which has 0 rows —
see stopgap at the bottom). Not yet implemented.

---

## 1. What we already have (all of this is reused)

| Piece | Where | Role in the pipeline |
|---|---|---|
| Throttled API client (50 req/min, 429 retry) | `lib/matchstat.ts` | all API calls |
| Identity check — `tournament/info/{seasonId}` → name + tier | `probe-masters-seasonids.ts` | the *verified* way to know a seasonId is the event we think it is |
| Full draw — `tournament/results/{seasonId}` | `reimport-slams.ts` | one call returns every completed match in a tournament |
| Discovery — ranked players' `past-matches` probing | `probe-masters-seasonids.ts` | how we find a new edition's seasonId |
| Field map + normalisers (roundId, date, winner) | `reimport-slams.ts` | proven against 13k matches |
| Player creation from `player/profile` | `reimport-slams.ts` step 2 | auto-create players we meet in draws |
| Paged player map (`fetchAllPlayers`) | `reimport-slams.ts` | avoids the 1,000-row cap (we're at 1,408 players) |
| Structure guardrail | `validate-slam-draws.ts` | post-import sanity check |
| Rankings refresh | `sync-live-rankings.ts` | run after each event completes |

The pipeline is 90% a re-arrangement of code that already exists and has been
validated in production. The new parts are: a place to run it on a schedule, a
small state table, and a calendar of expected events.

## 2. Architecture

```
 scheduler (every 20–30 min)
      │  GET with Authorization: Bearer CRON_SECRET
      ▼
 app/api/cron/refresh-matches/route.ts        ← new (Node runtime, maxDuration 300)
      │
      ├─ 0. read tracked_tournaments + lib/tournamentCalendar.ts
      │     nothing in window & nothing active → exit (0 API calls)
      │
      ├─ 1. DISCOVER (only when an expected event is in-window & untracked)
      │     probe top-20 ranked players' past-matches (GameYear:Y)
      │     → candidate tournamentIds
      │     → tournament/info each: name must match the event's patterns
      │       AND tier must be "Grand Slam"/"…1000" (identity, never dates)
      │     → tournament/results: plausible draw (slam ≥95, masters ≥45 as it fills)
      │     → insert tracked_tournaments row (status 'active')
      │
      ├─ 2. POLL each active tournament (1 API call each)
      │     tournament/results/{seasonId}
      │     → create missing players first (profile fetch, upsert on
      │       api_player_key, max ~20/run — converges across runs)
      │     → upsert matches that HAVE a winner (completed only)
      │       · api_event_key: slams bare id, masters `${tour}-${id}`  ← MUST match existing convention
      │       · tournament: "<Name> <Year>", tier from calendar, surface from calendar
      │
      ├─ 3. VALIDATE (live mode: structure only — ≤1 Final, no Round Robin,
      │     known roundIds, sane date span; draw-size minimums only at completion)
      │
      ├─ 4. COMPLETE when the Final has a winner:
      │     → mark row 'complete', run full validate for the group
      │     → refresh rankings (sync-live-rankings logic, 2 API calls)
      │     → if slam: update winner's slam_wins honours
      │
      └─ 5. LOG one row to refresh_log (ran_at, tournaments, matches upserted,
            players created, errors) — visible history when something is off
```

### New pieces

**`tracked_tournaments` table** (small — one row per edition per tour):

```sql
create table tracked_tournaments (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,          -- canonical, e.g. "Wimbledon"
  tour text not null,                -- 'ATP' | 'WTA'
  year int not null,
  season_id text,                    -- MatchStat seasonId once discovered
  tier text not null,                -- 'grand_slam' | 'masters_1000'
  surface text,
  status text not null default 'upcoming',  -- upcoming | active | complete | skipped
  matches_imported int default 0,
  last_polled_at timestamptz,
  unique (event_name, tour, year)
);
```

**`lib/tournamentCalendar.ts`** — the 13 tracked events with expected date
windows and name-match patterns. This already exists in two halves:
`EVENTS` in probe-masters-seasonids.ts (patterns, notHeld) and
`MASTERS_WINDOWS` in fetch-masters.ts (windows); merge them and add the four
slams (AO: Jan, RG: May–Jun, Wimbledon: Jun–Jul, USO: Aug–Sep). Windows are
deliberately wide (±1 week); they only gate *when discovery runs*, never which
seasonId is accepted — identity comes from `tournament/info`.

**`refresh_log` table** — append-only run history. When Scott wonders "why
isn't yesterday's final up?", this answers it without log-diving.

### The route (why an API route, not a script)

- Same codebase, same `lib/matchstat.ts`, same env vars already on Vercel —
  no second deployment target, no porting to Deno/edge functions.
- Manually triggerable: `curl -H "Authorization: Bearer $CRON_SECRET" …/api/cron/refresh-matches` (or a bookmark) — useful mid-Wimbledon.
- Time-boxed and idempotent: it does what fits in ~60s and exits; the next
  poll continues. Upserts on `api_event_key` make re-runs harmless.
- Protected by `CRON_SECRET` (reject anything without the Bearer header).
  Add the env var in Vercel; Vercel Cron sends it automatically if used.

### Scheduler options (pick one)

| Option | Cost | Granularity | Notes |
|---|---|---|---|
| **cron-job.org → GET the route** (recommended to start) | free | down to 1 min | works on Vercel Hobby; supports custom Authorization header |
| Vercel Cron | needs Pro ($20/mo) | 1 min | Hobby allows only one **daily** cron — not enough during slams |
| GitHub Actions curl job | free tier minutes | 5 min min | ~1,440 billed min/month at 30-min cadence — eats most of a private repo's free 2,000 |

Every 20–30 min is the right cadence: matches "conclude" in the API when the
result appears in `tournament/results`, and a 20-min poll means a fan finishing
a match on TV finds it reviewable by the time they've made tea. Off-window runs
cost one DB read and zero API calls, so a year-round schedule is fine.

### API budget

During a slam: 2 polls/run (ATP + WTA) × 72 runs/day ≈ 150 calls/day, plus a
burst of player-profile calls in the first days (new qualifiers). Discovery is
a one-time ~20–60 calls per edition. All trivially inside the RapidAPI plan
and the client's own 50 req/min throttle.

## 3. Data-quality rules (lessons already paid for)

1. **Identity before import** — a seasonId is only accepted after
   `tournament/info` confirms name-pattern AND tier. Never date windows alone
   (the wrong-seasonId disease), never draw size alone (the Olympics passes a
   size gate).
2. **Completed matches only** — rows are upserted only when `match_winner` is
   present. Everything visible in the catalogue is reviewable; no phantom
   "upcoming" fixtures. (The UI tolerates null winners, but the product rule
   is: the catalogue is tennis that has been played.)
3. **`api_event_key` conventions are law** — slams: bare id; Masters:
   `${tour}-${id}` (ATP/WTA ids overlap). Wrong prefix = silent duplicates.
   Long-term it's worth migrating slams to prefixed keys too, but not as part
   of this build.
4. **Always page player lookups** — 1,408 players and growing; a bare select
   caps at 1,000 silently (this is live-broken in phase2d today, see
   code-review-2026-07-01.md L1).
5. **Guardrail after completion** — full `validate-slam-draws.ts` bounds run
   when an event closes; during play only structural checks (partial draws are
   expected mid-event).
6. **New players get real profiles** — created via `player/profile` with
   api_player_key, DOB→age, country, photo; same as reimport-slams, so no
   photo-less orphans and no name-based duplicates.

## 4. Freshness of what users see

- **/matches** is fully dynamic and sorted by `match_date` desc → new matches
  appear on the next page load after import. No work needed.
- **Hourly `unstable_cache` entries** (players-page match rows, filter
  options, marquee ids) lag up to 1h. Acceptable; optionally add
  `tags: ["matches"]` to those caches and have the cron call
  `revalidateTag("matches")` after a successful import for instant freshness.
- **Home "This fortnight" final** — 5-min cache; a slam final appears on the
  home page within minutes of import automatically.
- **current_rank** refreshes at event completion (step 4), which matches when
  rankings actually change (the Monday after).

## 5. Failure modes

| Failure | Behaviour |
|---|---|
| API down / 429 storm | run logs the error, exits; next poll retries. Nothing partial is broken — upserts are idempotent |
| Discovery can't find seasonId (sponsor rename) | event stays 'upcoming'; refresh_log shows repeated discovery misses → add the new name pattern to the calendar (one-line fix) |
| Timeout mid-run (player-creation burst) | capped at ~20 players/run; the rest next poll. Matches for missing players skip and import next poll |
| Wrong event somehow passes gates | structure validation fails → row flagged in refresh_log, import for that group halts rather than pollutes |

## 6. Build plan

**Phase 0 — this week (stopgap, ~2–3 hrs):** one-off
`scripts/import-wimbledon-2026.ts` on the reimport-slams pattern: probe →
verify seasonIds via tournament/info → stage → players → upsert → validate.
Re-run it manually each evening of the fortnight. Users can review Wimbledon
immediately, and the discover/verify code written here IS the pipeline's
discovery module.

**Phase 1 — the pipeline (~1 day):** `tracked_tournaments` + `refresh_log`
migrations, `lib/tournamentCalendar.ts`, the cron route (discovery + poll +
complete + log), CRON_SECRET, cron-job.org schedule at 20 min. Point it at the
already-active Wimbledon row and retire the Phase-0 manual runs.

**Phase 2 — post-event automation (~half day):** rankings sync on completion,
slam honours update, optional `revalidateTag`, optional photo backfill for
players created mid-event.

**Phase 3 — optional polish:** "New this week" strip on /matches; retire
phase2d + fetch:masters npm scripts so the pipeline is the only import path.
