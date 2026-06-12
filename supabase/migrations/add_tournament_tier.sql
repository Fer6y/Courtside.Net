-- ============================================================
-- Migration: add tournament_tier to matches
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add the column (safe to run even if it already exists)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS tournament_tier TEXT DEFAULT 'other';

-- 2. Backfill existing Grand Slam rows by name
UPDATE matches
SET tournament_tier = 'grand_slam'
WHERE tournament_tier = 'other'
  AND (
    tournament ILIKE '%australian open%'
    OR tournament ILIKE '%roland garros%'
    OR tournament ILIKE '%wimbledon%'
    OR tournament ILIKE '%us open%'
  );

-- 3. Backfill existing Masters 1000 rows by name
UPDATE matches
SET tournament_tier = 'masters_1000'
WHERE tournament_tier = 'other'
  AND (
    tournament ILIKE '%indian wells%'
    OR tournament ILIKE '%bnp paribas open%'
    OR tournament ILIKE '%miami open%'
    OR tournament ILIKE '%monte-carlo%'
    OR tournament ILIKE '%monte carlo%'
    OR tournament ILIKE '%madrid open%'
    OR tournament ILIKE '%mutua madrid%'
    OR tournament ILIKE '%italian open%'
    OR tournament ILIKE '%internazionali%'
    OR tournament ILIKE '%rome masters%'
    OR tournament ILIKE '%national bank open%'
    OR tournament ILIKE '%rogers cup%'
    OR tournament ILIKE '%canadian open%'
    OR tournament ILIKE '%western & southern%'
    OR tournament ILIKE '%western and southern%'
    OR tournament ILIKE '%cincinnati%'
    OR tournament ILIKE '%shanghai masters%'
    OR tournament ILIKE '%rolex shanghai%'
    OR tournament ILIKE '%paris masters%'
    OR tournament ILIKE '%rolex paris%'
    OR tournament ILIKE '%bnp paribas masters%'
    OR tournament ILIKE '%wuhan open%'
    OR tournament ILIKE '%china open%'
    OR tournament ILIKE '%guadalajara open%'
    OR tournament ILIKE '%zhengzhou%'
  );

-- 4. Index for filtering by tier (e.g. "show only Grand Slams")
CREATE INDEX IF NOT EXISTS idx_matches_tier ON matches(tournament_tier);

-- 5. Verify counts
SELECT
  tournament_tier,
  COUNT(*) AS match_count
FROM matches
GROUP BY tournament_tier
ORDER BY match_count DESC;
