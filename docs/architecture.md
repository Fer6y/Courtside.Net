# Courtside — Architecture

## System Overview

```
┌─────────────┐     ┌──────────┐     ┌────────────────┐
│  Next.js 15  │────▶│  Clerk   │────▶│   Supabase     │
│  (Vercel)    │     │  (Auth)  │     │   (Postgres)   │
└──────┬───────┘     └──────────┘     └───────┬────────┘
       │                                       │
       │  Server Components read via           │
       │  supabase-js (anon key + RLS)         │
       │                                       │
       ▼                                       ▼
  Client Components                    Edge Functions
  write via supabase-js               (service_role key)
  (anon key + Clerk JWT)              - Clerk webhook sync
                                      - Rating aggregation
                                      - Match import cron
                                      - H2H cache recompute
                                      - Achievement triggers
```

## Auth Flow: Clerk → Supabase

1. User signs in via Clerk (Google, Apple, or email)
2. Clerk issues a JWT containing `sub` (the Clerk user ID)
3. On first sign-up, Clerk fires a webhook to a Next.js API route (`/api/webhooks/clerk`)
4. The webhook handler uses `SUPABASE_SERVICE_ROLE_KEY` to insert a row in `profiles` with the `clerk_user_id`
5. For all subsequent Supabase queries from the client, the Clerk JWT is passed as the Supabase auth token
6. RLS policies use `auth.jwt() ->> 'sub'` to match `user_id` / `clerk_user_id` columns

### Clerk Middleware

`middleware.ts` at the project root uses `@clerk/nextjs` to protect routes. Public routes: `/`, `/players`, `/players/[id]`, `/matches`, `/matches/[id]`, `/h2h/*`, `/compare`. Protected routes: anything under `/profile`, any POST/mutation action.

### Supabase Client Setup

Two clients in `/lib/supabase`:

- **Browser client** (`createBrowserClient`) — uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Clerk session token injected via `supabase.auth.setSession()`. Used by client components for mutations.
- **Server client** (`createServerClient`) — uses the same anon key but pulls the Clerk token from cookies/headers server-side. Used by server components for reads.
- **Admin client** (edge functions / API routes only) — uses `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS. Used for webhook handlers, data imports, aggregation triggers.

## Data Import Pipeline

### Historical Seed (One-time)

```
Sackmann GitHub CSVs
  └─▶ Node/Python import script
        ├─▶ players table (map sackmann player_id → api_id)
        └─▶ matches table (filter to Grand Slams + Masters 1000)
```

### Live Tournament Import (Ongoing)

```
Paid Tennis API (api-tennis.com / RapidAPI)
  └─▶ Supabase Edge Function (cron: every 30–60 min during tournaments)
        ├─▶ matches table (upsert by api_match_id)
        ├─▶ players table (auto-create new players)
        └─▶ h2h_cache recompute (for affected player pairs)
```

## Rating Aggregation

### Consensus Community Rating (player profiles)

Triggered on: INSERT, UPDATE, DELETE on `reviews`.

```sql
-- Player consensus rating = average of all per-player ratings across all reviewed matches
-- For a given player, find all reviews where they were player1 or player2
-- and average the corresponding rating column

SELECT
  COALESCE(
    (SELECT AVG(player1_rating) FROM reviews r
     JOIN matches m ON r.match_id = m.id WHERE m.player1_id = target_player_id),
    0
  ) AS avg_as_p1,
  COALESCE(
    (SELECT AVG(player2_rating) FROM reviews r
     JOIN matches m ON r.match_id = m.id WHERE m.player2_id = target_player_id),
    0
  ) AS avg_as_p2;

-- Combined consensus = weighted average of both, weighted by count
```

Implementation: Supabase database function or edge function triggered on review changes. Store the computed consensus rating on the `players` table (or a materialized view) for fast reads.

### Radar Chart Aggregation (player profiles)

Triggered on: INSERT, UPDATE, DELETE on `skill_ratings`.

```sql
-- For each axis, average all non-null ratings for that player
SELECT
  AVG(speed) AS speed,
  AVG(court_coverage) AS court_coverage,
  AVG(positioning) AS positioning,
  -- ... all 11 axes
FROM skill_ratings
WHERE player_id = target_player_id;
```

Only count axes the user actually rated (NULL values are excluded by AVG automatically).

### H2H Cache Recompute

Triggered on: new match imported between two players.

```sql
-- Canonical ordering: smaller UUID is always player1_id
INSERT INTO h2h_cache (player1_id, player2_id, total_matches, p1_wins, p2_wins, last_updated)
SELECT
  LEAST(player1_id, player2_id),
  GREATEST(player1_id, player2_id),
  COUNT(*),
  COUNT(*) FILTER (WHERE winner_id = LEAST(player1_id, player2_id)),
  COUNT(*) FILTER (WHERE winner_id = GREATEST(player1_id, player2_id)),
  NOW()
FROM matches
WHERE (player1_id = $1 AND player2_id = $2)
   OR (player1_id = $2 AND player2_id = $1)
GROUP BY LEAST(player1_id, player2_id), GREATEST(player1_id, player2_id)
ON CONFLICT (player1_id, player2_id)
DO UPDATE SET
  total_matches = EXCLUDED.total_matches,
  p1_wins = EXCLUDED.p1_wins,
  p2_wins = EXCLUDED.p2_wins,
  last_updated = EXCLUDED.last_updated;
```

## Achievement System

Edge function or database trigger that checks conditions after user actions:

| Achievement | Tier | Trigger |
|-------------|------|---------|
| matches_watched_10 | common | watched_matches count reaches 10 |
| full_slam | uncommon | User has watched_matches for all rounds of a single Grand Slam |
| reviews_100 | rare | reviews count reaches 100 |
| early_adopter | grail | User signed up before a hardcoded date |
| ratings_500 | grail | Combined reviews + skill_ratings count reaches 500 |

Check on: INSERT into `reviews`, `watched_matches`, `skill_ratings`.
