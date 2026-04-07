# Courtside — Data Strategy

## Overview

Courtside's data comes from two sources: official tennis data (players, matches, scores) from external APIs, and community-generated data (ratings, reviews, skill assessments) from users. This document covers how external data flows into the app.

## Two-Layer Approach

### Layer 1: Free Historical Seed (Jeff Sackmann)

**Source:** 
- ATP: https://github.com/JeffSackmann/tennis_atp
- WTA: https://github.com/JeffSackmann/tennis_wta

**What it contains:**
- Player bios (name, hand, birth date, country)
- Match results (tournament, round, score, winner, surface, date)
- Rankings history (weekly rankings with points)
- Match stats (aces, double faults, serve percentages — 1991-present for tour level)

**Format:** CSV files, updated periodically by the maintainer.

**License:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International. Attribution is required. Non-commercial use only. If Courtside generates revenue, contact Jeff Sackmann directly to discuss licensing — he is known to be reasonable.

**How to use:**
1. Clone both repos locally
2. Write a Python or Node.js import script that:
   - Reads player CSV files → inserts into `players` table (map Sackmann player_id to our api_id field)
   - Reads match CSV files → inserts into `matches` table (filter to majors only for MVP: Grand Slams + Masters 1000)
   - Maps Sackmann tournament names to our tournament format
3. Run once for initial seed, then periodically to catch historical updates

**MVP scope:** Import only Grand Slam and Masters 1000 matches. This is roughly:
- 4 Grand Slams × ~127 singles matches = ~508 matches/year
- 9 Masters 1000 × ~96 singles matches = ~864 matches/year
- Total: ~1,372 matches/year, going back as many years as desired

**Key fields to map:**

| Sackmann CSV | Courtside Table | Column |
|-------------|----------------|--------|
| player_id | players | api_id |
| name_first + name_last | players | name |
| ioc | players | country |
| tourney_name | matches | tournament |
| round | matches | round |
| score | matches | score |
| surface | matches | surface |
| tourney_date | matches | date |
| winner_id | matches | winner_id |

### Layer 2: Paid API for Live Tournaments

**Recommended options (evaluate during Phase 1):**

| API | Coverage | Approximate Cost | Notes |
|-----|----------|-----------------|-------|
| api-tennis.com | ATP, WTA, Challengers | ~$30–100/month | Tennis-specific, simple REST API, 14-day free trial |
| RapidAPI Tennis Live Data | ATP, WTA | ~$10–50/month (usage-based) | Good for low-volume, easy to start |
| SportDevs Tennis | ATP, WTA, ITF | Custom quote | Free trial (300 req/day), more comprehensive |
| Sportradar | ATP, WTA, 4000+ competitions | Enterprise pricing ($$$$) | Overkill for MVP, not indie-friendly |

**Recommended for MVP:** Start with api-tennis.com or a RapidAPI endpoint. Test during Phase 1's free trial period. Check:
- Does it cover all Grand Slam and Masters 1000 matches?
- Does it provide player profiles (name, country, rank, age)?
- How quickly do match results appear after completion?
- What's the data format and how clean is it?

**How to use:**
1. Set up a Supabase edge function or cron job that runs during tournaments
2. Poll the API for new match results (every 30–60 minutes during active tournament days)
3. Insert new matches into the `matches` table, matching players by api_id
4. New players encountered during imports get auto-created in the `players` table

**API call volume for majors-only:**
- A Grand Slam runs ~14 days with ~127 matches
- Polling every 30 minutes = ~672 API calls per Slam
- 4 Slams + 9 Masters ≈ 13 tournaments × ~500 calls = ~6,500 calls/year
- This is well within the cheapest tier of any tennis API

### Important: One Source, Not Aggregated

Pick one paid API and stick with it. Do not try to aggregate across multiple APIs — the mapping complexity (different player IDs, different tournament names, conflicting scores) adds significant engineering burden for marginal data quality improvement. Validate the paid API's data against Sackmann's historical data for accuracy during evaluation.

## What the API Provides vs What the Community Provides

| Data Type | Source | Table |
|-----------|--------|-------|
| Player bio (name, country, age, rank) | API | players |
| Career stats | API | players (career_stats_json) |
| Match results (score, date, surface, tournament) | API | matches |
| Tournament schedules | API | (used for import timing) |
| Match star ratings (1.0–10.0) | Community | reviews |
| Per-player match ratings (1.0–10.0) | Community | reviews |
| Written reviews | Community | reviews |
| Skill radar ratings (11 axes) | Community | skill_ratings |
| Watch log | Community | watched_matches |
| Comments | Community | comments |
| Achievement progress | Community | achievements |

## Data Freshness

- **Historical data (Sackmann):** Seeded once, refreshed monthly or as needed
- **Live tournament data (paid API):** Polled every 30–60 minutes during active tournaments
- **Community data:** Real-time via Supabase (writes happen on user action)
- **Aggregated ratings:** Recomputed via Supabase function/trigger whenever a new review or skill rating is submitted
- **H2H cache:** Recomputed whenever a new match is imported between two players who have a cached record

## Future Expansion

- Expand from majors-only to full tour coverage (requires higher API tier)
- Add doubles coverage
- Add WTA 1000 tournaments as separate category
- Consider Sackmann's Match Charting Project data for advanced shot-level stats
- Explore UTR (Universal Tennis Rating) data integration
