-- Courtside — Full Database Schema
-- Supabase (Postgres) — 10 tables
-- Run as a single migration: supabase/migrations/001_initial_schema.sql

-- ============================================================
-- PLAYERS — Tennis player profiles from API + Sackmann seed
-- ============================================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,                          -- 3-letter IOC code (e.g., 'ESP', 'ITA')
  age INTEGER,
  current_rank INTEGER,
  image_url TEXT,
  api_id TEXT UNIQUE,                    -- External ID from Sackmann or paid API
  career_stats_json JSONB DEFAULT '{}',  -- Flexible blob for career stats
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_players_api_id ON players(api_id);
CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_players_current_rank ON players(current_rank);

-- ============================================================
-- MATCHES — Match results from API + Sackmann seed
-- ============================================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID NOT NULL REFERENCES players(id),
  tournament TEXT NOT NULL,              -- e.g., 'Australian Open', 'Indian Wells'
  round TEXT,                            -- e.g., 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'
  score TEXT,                            -- e.g., '6-3 6-4 7-6(4)'
  surface TEXT CHECK (surface IN ('Hard', 'Clay', 'Grass', 'Carpet')),
  date DATE NOT NULL,
  winner_id UUID REFERENCES players(id),
  api_match_id TEXT UNIQUE,              -- External ID from API
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_player1 ON matches(player1_id);
CREATE INDEX idx_matches_player2 ON matches(player2_id);
CREATE INDEX idx_matches_winner ON matches(winner_id);
CREATE INDEX idx_matches_tournament ON matches(tournament);
CREATE INDEX idx_matches_date ON matches(date DESC);
CREATE INDEX idx_matches_surface ON matches(surface);

-- ============================================================
-- PROFILES — User profiles synced from Clerk via webhook
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,    -- Clerk's user ID, used as FK from other tables
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_clerk ON profiles(clerk_user_id);
CREATE INDEX idx_profiles_username ON profiles(username);

-- ============================================================
-- REVIEWS — Match ratings (3 sliders, 1.0–10.0)
-- The primary quick interaction loop
-- ============================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  match_id UUID NOT NULL REFERENCES matches(id),
  match_rating NUMERIC(3,1) NOT NULL CHECK (match_rating >= 1.0 AND match_rating <= 10.0),
  player1_rating NUMERIC(3,1) NOT NULL CHECK (player1_rating >= 1.0 AND player1_rating <= 10.0),
  player2_rating NUMERIC(3,1) NOT NULL CHECK (player2_rating >= 1.0 AND player2_rating <= 10.0),
  comment TEXT,
  sets_watched TEXT NOT NULL,            -- e.g., 'Full Match', '3 Sets', 'Highlights'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)              -- One review per user per match
);

CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_match ON reviews(match_id);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- ============================================================
-- SKILL_RATINGS — Radar chart data (11 axes, 1.0–5.0)
-- Separate deeper engagement from player profiles
-- ============================================================
CREATE TABLE skill_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  player_id UUID NOT NULL REFERENCES players(id),
  -- Movement (Blue)
  speed NUMERIC(2,1) CHECK (speed >= 1.0 AND speed <= 5.0),
  court_coverage NUMERIC(2,1) CHECK (court_coverage >= 1.0 AND court_coverage <= 5.0),
  positioning NUMERIC(2,1) CHECK (positioning >= 1.0 AND positioning <= 5.0),
  -- Technique (Green)
  serve NUMERIC(2,1) CHECK (serve >= 1.0 AND serve <= 5.0),
  forehand NUMERIC(2,1) CHECK (forehand >= 1.0 AND forehand <= 5.0),
  backhand NUMERIC(2,1) CHECK (backhand >= 1.0 AND backhand <= 5.0),
  -- Skill (Gold)
  net_play NUMERIC(2,1) CHECK (net_play >= 1.0 AND net_play <= 5.0),
  touch NUMERIC(2,1) CHECK (touch >= 1.0 AND touch <= 5.0),
  reaction_time NUMERIC(2,1) CHECK (reaction_time >= 1.0 AND reaction_time <= 5.0),
  return_play NUMERIC(2,1) CHECK (return_play >= 1.0 AND return_play <= 5.0),
  -- Mental (Coral)
  mental_strength NUMERIC(2,1) CHECK (mental_strength >= 1.0 AND mental_strength <= 5.0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, player_id)             -- One skill rating per user per player (updatable)
);

CREATE INDEX idx_skill_ratings_user ON skill_ratings(user_id);
CREATE INDEX idx_skill_ratings_player ON skill_ratings(player_id);

-- ============================================================
-- FOLLOWS — User follow relationships
-- ============================================================
CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  following_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)    -- Can't follow yourself
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- ============================================================
-- COMMENTS — Threaded comments on reviews
-- ============================================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_review ON comments(review_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

-- ============================================================
-- WATCHED_MATCHES — User watch log
-- ============================================================
CREATE TABLE watched_matches (
  user_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  match_id UUID NOT NULL REFERENCES matches(id),
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, match_id)
);

CREATE INDEX idx_watched_user ON watched_matches(user_id);
CREATE INDEX idx_watched_match ON watched_matches(match_id);

-- ============================================================
-- ACHIEVEMENTS — Earned badges/decals
-- ============================================================
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(clerk_user_id),
  achievement_type TEXT NOT NULL,         -- e.g., 'matches_watched_10', 'full_slam', 'reviews_100', 'early_adopter'
  tier TEXT NOT NULL CHECK (tier IN ('common', 'uncommon', 'rare', 'grail')),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_type)      -- Can't earn same achievement twice
);

CREATE INDEX idx_achievements_user ON achievements(user_id);

-- ============================================================
-- H2H_CACHE — Pre-computed head-to-head records
-- ============================================================
CREATE TABLE h2h_cache (
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID NOT NULL REFERENCES players(id),
  total_matches INTEGER DEFAULT 0,
  p1_wins INTEGER DEFAULT 0,
  p2_wins INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player1_id, player2_id),
  CHECK (player1_id < player2_id)        -- Canonical ordering: smaller UUID first
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at on reviews
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
