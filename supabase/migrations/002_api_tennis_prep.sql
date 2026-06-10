-- ============================================================
-- Migration 002 — api-tennis.com data migration prep
-- Run in Supabase SQL Editor BEFORE running any phase scripts
-- ============================================================


-- ── Players: add API Tennis identity + photo ──────────────────────────────────
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS api_player_key  text UNIQUE,  -- api-tennis.com player_key
  ADD COLUMN IF NOT EXISTS photo_url       text;          -- player_logo URL from API
  -- Note: existing api_id column holds the Sackmann numeric ID — keep it for crosswalk

-- ── Matches: add API Tennis identity + provenance ────────────────────────────
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS api_event_key      text UNIQUE,       -- api-tennis.com event_key
  ADD COLUMN IF NOT EXISTS tournament_season  integer,            -- e.g. 2024
  ADD COLUMN IF NOT EXISTS source             text DEFAULT 'sackmann'
    CHECK (source IN ('sackmann', 'api_tennis'));

-- Back-fill source on all existing rows (they are all Sackmann)
UPDATE matches SET source = 'sackmann' WHERE source IS NULL;


-- ── Raw API response cache ────────────────────────────────────────────────────
-- Store the full raw JSON once; re-parse it locally as needed.
-- Avoids burning API rate limits on re-fetches.
CREATE TABLE IF NOT EXISTS api_raw_staging (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  method      text    NOT NULL,   -- 'get_fixtures', 'get_players', 'get_standings', etc.
  params      jsonb   NOT NULL,   -- query parameters used for the call
  response    jsonb   NOT NULL,   -- full raw API response body
  fetched_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_raw_method ON api_raw_staging(method);
CREATE INDEX IF NOT EXISTS idx_api_raw_params ON api_raw_staging USING gin(params);


-- ── Player crosswalk ─────────────────────────────────────────────────────────
-- Maps Sackmann numeric player IDs to api-tennis.com player_keys.
-- Only needed if community rating data exists when we migrate.
CREATE TABLE IF NOT EXISTS player_crosswalk (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sackmann_id         text NOT NULL,    -- players.api_id (Sackmann numeric)
  api_player_key      text NOT NULL,    -- api-tennis.com player_key
  supabase_player_id  uuid REFERENCES players(id),
  confidence          text NOT NULL CHECK (confidence IN ('high', 'low', 'manual')),
  match_basis         text,             -- e.g. 'dob', 'dob+country', 'dob+lastname'
  notes               text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (sackmann_id, api_player_key)
);

CREATE INDEX IF NOT EXISTS idx_player_crosswalk_sackmann ON player_crosswalk(sackmann_id);
CREATE INDEX IF NOT EXISTS idx_player_crosswalk_api      ON player_crosswalk(api_player_key);


-- ── Match crosswalk ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_crosswalk (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sackmann_match_id   text NOT NULL,    -- matches.api_match_id (Sackmann format)
  api_event_key       text NOT NULL,    -- api-tennis.com event_key
  supabase_match_id   uuid REFERENCES matches(id),
  confidence          text NOT NULL CHECK (confidence IN ('high', 'low', 'manual')),
  match_basis         text,             -- e.g. 'tournament+round+players'
  notes               text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (sackmann_match_id, api_event_key)
);

CREATE INDEX IF NOT EXISTS idx_match_crosswalk_sackmann ON match_crosswalk(sackmann_match_id);
CREATE INDEX IF NOT EXISTS idx_match_crosswalk_api      ON match_crosswalk(api_event_key);
