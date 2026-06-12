# Match Dataset Validation — Grand Slam Finals (2026-06-12)

## The complaint
Filtering matches for **Grand Slam + Final** returns too many finals, including
matchups that never happened (e.g. "US Open 2024 ATP final: Etcheverry vs Evans").

## Verdict
Confirmed. Of the 56 rows tagged `tournament_tier = 'grand_slam'` AND `round = 'Final'`,
**22 are not Grand Slam finals at all**. Worse, for 16 slam editions the *entire main
draw is missing* — a completely different tournament's matches were imported under the
slam's name.

## Root cause
`scripts/phase2b-fetch-fixtures.ts` contains a hardcoded `SLAM_SEASONS` table mapping
each slam edition to a MatchStat API `seasonId`. **~18 of those season IDs point to the
wrong event on the API.** The fixture importer then stamped every match from the wrong
event with the slam's tournament name, season, and `grand_slam` tier.

A secondary effect corrupts the round labels: `phase2d-process-matches.ts` maps API
round IDs positionally (4 = "Round of 128", 5 = "Round of 64", …), which is only valid
for a 128-player draw. The wrongly-imported events are mostly 28/32-draw events, so
their first round (also round ID 4) got labeled "Round of 128" and their real final
(a 250-level or Challenger final) got labeled "Final" — which is what floods the
Grand Slam finals filter.

## Polluted groups (verified by row counts, dates, and known results)

| DB group | Rows | What it actually is | Real final present? |
|---|---|---|---|
| Australian Open 2020 ATP | 31 | 32-draw Challenger, Jan 2020 (Bellier d. Robert) | ❌ missing (Djokovic d. Thiem) |
| Australian Open 2020 WTA | 4 | Fed Cup qualifier, Feb 7–8 2020 (Teichmann/Fernandez) | ❌ missing (Kenin d. Muguruza) |
| Roland Garros 2020 ATP | 31 | Challenger, Oct 2020 (Alcaraz d. Dzumhur) | ❌ missing (Nadal d. Djokovic) |
| US Open 2020 ATP | 54 | **Rome Masters 2020** (Djokovic d. Schwartzman) | ❌ missing (Thiem d. Zverev) |
| Australian Open 2021 ATP | 54 | **Murray River Open 2021** (Evans d. Auger-Aliassime) | ❌ missing (Djokovic d. Medvedev) |
| Roland Garros 2021 ATP | 31 | Challenger, Jun 2021 (Coria d. Molcan) | ❌ missing (Djokovic d. Tsitsipas) |
| Wimbledon 2021 ATP | 31 | Challenger, Jun 2021 (Kubler d. Diallo) | ❌ missing (Djokovic d. Berrettini) |
| Australian Open 2022 ATP | 27 | **Argentina Open 2022** (Ruud d. Schwartzman) | ❌ missing (Nadal d. Medvedev) |
| Roland Garros 2023 ATP | 31 | Challenger week of Jun 11–17 2023 + the real final | ✅ real final present (`api_event_key` null — added separately) |
| Roland Garros 2023 WTA | 47 | ITF event(s), Jun 2023 (Kalieva d. Doi) | ❌ missing (Swiatek d. Muchova) |
| Wimbledon 2023 ATP | 31 | ITF event, Jun 2023 (Jong d. Von Der Schulenburg) | ❌ missing (Alcaraz d. Djokovic) |
| Australian Open 2024 ATP | 26 | **Dallas Open 2024** (Paul d. Giron) | ❌ missing (Sinner d. Medvedev) |
| Australian Open 2024 WTA | 30 | **Transylvania Open 2024** (Pliskova d. Bogdan) | ❌ missing (Sabalenka d. Zheng) |
| US Open 2024 ATP | 13 | **Davis Cup Finals group stage 2024** (6 RR + 6 tie "finals") + the real final | ✅ real final present (Sinner d. Fritz, `api_event_key` null) — rest of draw missing |
| Wimbledon 2024 ATP | 31 | Challenger/ITF, Jul 2024 (Debru d. Skatov) | ❌ missing (Alcaraz d. Djokovic) |
| Australian Open 2025 ATP | 31 | Junior/ITF event, Jan 2025 (Gea d. Malige) | ❌ missing (Sinner d. Zverev) |
| Roland Garros 2025 WTA | 30 | ITF/WTA 125, Jun 2025 (Todoni d. Bondar) | ❌ missing (Gauff d. Sabalenka) |
| Australian Open 2026 WTA | 31 | WTA event the week after AO (Feb 1–7; Cirstea d. Raducanu) | ❌ missing |

Also noted:
- **US Open 2021 ATP** — mostly real (real final present) but only 112 of 127 matches,
  and at least one row has a bogus `match_date` of 2026-05-11.
- All other 31 groups look correct: full 125–127-row draws with one final each, and
  every spot-checked final matches the historical result.

## Impact on user data
**Zero.** No `reviews` or `watched_matches` rows reference any match in the 18 polluted
groups, so they can be deleted without losing user content.

## Remediation — EXECUTED 2026-06-12

1. **Probed correct seasonIds** (`scripts/probe-slam-seasonids.ts`): paged through
   each edition's champion via `player/past-matches` (`GameYear:Y;TourRank:1`,
   `pageNo` pagination), anchored on the final the champion won inside the slam
   window, then verified every candidate by fetching its full draw — ≥95 singles
   matches, exactly one final, champion present in it. **18/18 verified**; every
   recovered final matches the historical result. Output:
   `scripts/_verified-slam-seasons.json`.
2. **Deleted** all 564 rows in the 18 polluted groups + the 18 bogus
   `api_raw_staging` fixture rows (`scripts/cleanup-polluted-slams.ts`), after
   re-verifying zero reviews/watched_matches references.
3. **Re-imported** all affected draws (`scripts/reimport-slams.ts` — targeted
   phase2b→2c→2d: stages fixtures, creates missing players with profile fetch,
   upserts matches on `api_event_key`). 121 new players created. Also reprocessed
   US Open 2021 ATP (filled its 15 missing matches, fixed rows whose match_date
   had been wrongly backfilled to May 2026) and Roland Garros 2026 WTA (fresh
   post-tournament fetch; removed 2 stray 2021 matches and 32 stale duplicate
   rows from the original mid-tournament import).
4. **Corrected the 18 seasonIds in `phase2b-fetch-fixtures.ts`** so a re-run can
   never re-import the wrong events.
5. **Guardrail added:** `scripts/validate-slam-draws.ts` — run after ANY match
   import. Enforces per slam group: 100–130 rows, exactly 1 final, no round-robin,
   no null rounds, dates within a 31-day span. Exits 1 on failure.

**Result: all 50 grand_slam groups pass. Exactly 50 finals, one per group, all
matching real history.**

### Bugs found along the way
- **Supabase 1000-row cap:** `players` now has 1500+ rows; a single `select`
  silently returns max 1000 even with `.limit(10000)`. First reimport pass built
  an incomplete player map and skipped 542 fixtures. Fixed with `.range()`
  pagination — any script reading whole tables must paginate.
- **`match_date` backfill produced garbage** on some rows (US Open 2021 matches
  dated May 2026). Re-import overwrote with real API dates.

## NEW: the Masters 1000 data has the same disease (not yet fixed)
Discovered during re-import — two Masters staging rows were actually slam draws:
- "Western & Southern Open 2024 ATP" (seasonId 19405) was **the real US Open 2024
  draw** mislabeled as Cincinnati. Renamed in place via event-key upsert.
  → **Cincinnati 2024 ATP is now a gap** (no data, previously wrong data).
- "Italian Open 2025 WTA" (seasonId 15965) was **the real Roland Garros 2025 WTA
  draw**. Same rename. → **Italian Open 2025 WTA is now a gap.**

`validate-slam-draws.ts` also flags 7 partial Masters groups with 0 finals:
Western & Southern Open 2025 ATP (23 rows), Miami 2025 WTA (9), Indian Wells 2023
ATP (22), Italian Open 2023 WTA (30), Western & Southern Open 2020 WTA (54),
Miami 2021 WTA (3), Italian Open 2022 WTA (24). Plus previously known gaps:
Indian Wells 2025 ATP, Italian Open 2024 ATP. A Masters cleanup pass with the
same probe-verify-reimport technique is the obvious follow-up (needs a
draw-size-aware round mapping — Masters draws are 56/96, not 128).

## Audit scripts
`scripts/_audit-finals.ts` … `_audit-finals4.ts` (read-only, safe to re-run),
`scripts/validate-slam-draws.ts` (the permanent guardrail).
