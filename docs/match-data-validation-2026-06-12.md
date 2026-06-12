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

## Remediation plan (not yet executed)
1. **Delete** all rows in the polluted groups EXCEPT the two legitimate finals
   (Roland Garros 2023 ATP final, US Open 2024 ATP final — identifiable by
   `api_event_key IS NULL`). ~490 bogus rows.
2. **Re-probe** the correct MatchStat season IDs for the 16 affected slam editions
   (same approach as `scripts/probe-masters-calendar.ts`) — verify by checking the
   returned final matches the known real result before importing.
3. **Re-import** the correct draws via the phase2b → 2d pipeline with corrected IDs.
4. **Guardrail:** add a post-import sanity check — every grand_slam group must have
   ~127 rows and exactly 1 final; flag anything else.

## Audit scripts
`scripts/_audit-finals.ts`, `_audit-finals2.ts`, `_audit-finals3.ts`, `_audit-finals4.ts`
(read-only; safe to re-run anytime).
