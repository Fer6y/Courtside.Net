-- ============================================================
-- COURTSIDE — Full Database Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================


-- ── 1. PLAYERS ───────────────────────────────────────────────
-- One row per professional player (seeded from Sackmann data,
-- updated by the paid tennis API). Users never write to this table.

CREATE TABLE players (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  country          text,                          -- ISO 3166-1 alpha-3 e.g. "ESP"
  age              integer,
  current_rank     integer,
  image_url        text,
  api_id           text UNIQUE,                   -- ID from the paid tennis API
  career_stats     jsonb DEFAULT '{}',            -- flexible blob for API stats
  created_at       timestamptz DEFAULT now()
);


-- ── 2. MATCHES ───────────────────────────────────────────────
-- One row per match (seeded from Sackmann, updated by paid API).
-- Users never write to this table either — they only review matches.

CREATE TABLE matches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id       uuid NOT NULL REFERENCES players(id),
  player2_id       uuid NOT NULL REFERENCES players(id),
  winner_id        uuid REFERENCES players(id),
  tournament       text NOT NULL,                 -- e.g. "Australian Open 2024"
  round            text,                          -- e.g. "Final", "SF", "QF", "R32"
  score            text,                          -- e.g. "6-3 7-6 6-4"
  surface          text CHECK (surface IN ('Hard', 'Clay', 'Grass', 'Carpet')),
  match_date       date,
  api_match_id     text UNIQUE,                   -- dedup key from the paid API
  created_at       timestamptz DEFAULT now()
);


-- ── 3. PROFILES ──────────────────────────────────────────────
-- Created automatically via Clerk webhook when a user signs up.
-- This is the Courtside identity layer — Clerk handles passwords/OAuth.

CREATE TABLE profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id    text UNIQUE NOT NULL,          -- Clerk's "user_xxxx" ID
  username         text UNIQUE NOT NULL,
  display_name     text,
  avatar_url       text,
  bio              text,
  created_at       timestamptz DEFAULT now()
);


-- ── 4. REVIEWS ───────────────────────────────────────────────
-- The primary user interaction. One review per user per match.
-- All three ratings are required — match overall, player 1, player 2.

CREATE TABLE reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id         uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  match_rating     numeric(3,1) NOT NULL CHECK (match_rating BETWEEN 1.0 AND 10.0),
  player1_rating   numeric(3,1) NOT NULL CHECK (player1_rating BETWEEN 1.0 AND 10.0),
  player2_rating   numeric(3,1) NOT NULL CHECK (player2_rating BETWEEN 1.0 AND 10.0),
  comment          text,
  sets_watched     text CHECK (sets_watched IN (
                     '1_set', '2_sets', '3_sets', '4_sets', '5_sets',
                     'full_match', 'highlights'
                   )),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, match_id)                      -- one review per user per match
);


-- ── 5. SKILL RATINGS ─────────────────────────────────────────
-- The deeper engagement — 11 axes across 4 categories.
-- One rating set per user per player (they can update it).
-- Scale: 1.0–5.0 per axis.

CREATE TABLE skill_ratings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id        uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  -- Movement (Blue)
  speed            numeric(3,1) CHECK (speed BETWEEN 1.0 AND 5.0),
  court_coverage   numeric(3,1) CHECK (court_coverage BETWEEN 1.0 AND 5.0),
  positioning      numeric(3,1) CHECK (positioning BETWEEN 1.0 AND 5.0),
  -- Technique (Green)
  serve            numeric(3,1) CHECK (serve BETWEEN 1.0 AND 5.0),
  forehand         numeric(3,1) CHECK (forehand BETWEEN 1.0 AND 5.0),
  backhand         numeric(3,1) CHECK (backhand BETWEEN 1.0 AND 5.0),
  -- Skill (Gold)
  net_play         numeric(3,1) CHECK (net_play BETWEEN 1.0 AND 5.0),
  touch            numeric(3,1) CHECK (touch BETWEEN 1.0 AND 5.0),
  reaction_time    numeric(3,1) CHECK (reaction_time BETWEEN 1.0 AND 5.0),
  return_play      numeric(3,1) CHECK (return_play BETWEEN 1.0 AND 5.0),
  -- Mental (Coral)
  mental_strength  numeric(3,1) CHECK (mental_strength BETWEEN 1.0 AND 5.0),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, player_id)                     -- one skill rating per user per player
);


-- ── 6. FOLLOWS ───────────────────────────────────────────────
-- User-to-user follows. Used for personalised feed in Phase 3+.

CREATE TABLE follows (
  follower_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at       timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)             -- can't follow yourself
);


-- ── 7. COMMENTS ──────────────────────────────────────────────
-- Threaded comments on reviews. parent_comment_id is null for
-- top-level comments, set for replies.

CREATE TABLE comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_id           uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  parent_comment_id   uuid REFERENCES comments(id) ON DELETE CASCADE,
  body                text NOT NULL,
  created_at          timestamptz DEFAULT now()
);


-- ── 8. WATCHED MATCHES ───────────────────────────────────────
-- The watch log — a user's full catalogue of matches they've seen.
-- Populated automatically when they submit a review, or manually added.

CREATE TABLE watched_matches (
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id         uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  watched_at       timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, match_id)
);


-- ── 9. ACHIEVEMENTS ──────────────────────────────────────────
-- Earned decals. achievement_type is the specific trigger
-- (e.g. 'watched_10', 'grand_slam_complete', 'reviews_100').

CREATE TABLE achievements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  tier             text NOT NULL CHECK (tier IN ('common', 'uncommon', 'rare', 'grail')),
  earned_at        timestamptz DEFAULT now(),
  UNIQUE (user_id, achievement_type)              -- each achievement earned once
);


-- ── 10. H2H CACHE ────────────────────────────────────────────
-- Pre-computed head-to-head stats so /h2h pages load instantly
-- without joining and counting matches on every request.
-- Rebuilt by a background job whenever new matches are imported.

CREATE TABLE h2h_cache (
  player1_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player2_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  total_matches    integer DEFAULT 0,
  p1_wins          integer DEFAULT 0,
  p2_wins          integer DEFAULT 0,
  last_updated     timestamptz DEFAULT now(),
  PRIMARY KEY (player1_id, player2_id),
  CHECK (player1_id < player2_id)                 -- enforce consistent ordering
);


-- ============================================================
-- INDEXES — speed up the most common query patterns
-- ============================================================

-- Players: look up by API ID during imports, sort by rank on browse pages
CREATE INDEX idx_players_api_id      ON players(api_id);
CREATE INDEX idx_players_rank        ON players(current_rank);

-- Matches: filter by player, surface, date, tournament
CREATE INDEX idx_matches_player1     ON matches(player1_id);
CREATE INDEX idx_matches_player2     ON matches(player2_id);
CREATE INDEX idx_matches_date        ON matches(match_date DESC);
CREATE INDEX idx_matches_surface     ON matches(surface);
CREATE INDEX idx_matches_tournament  ON matches(tournament);
CREATE INDEX idx_matches_api_id      ON matches(api_match_id);

-- Reviews: load reviews for a match, load reviews by a user
CREATE INDEX idx_reviews_match       ON reviews(match_id);
CREATE INDEX idx_reviews_user        ON reviews(user_id);

-- Skill ratings: load all ratings for a player (for radar chart aggregation)
CREATE INDEX idx_skill_ratings_player ON skill_ratings(player_id);
CREATE INDEX idx_skill_ratings_user   ON skill_ratings(user_id);

-- Profiles: Clerk webhook looks up by clerk_user_id constantly
CREATE INDEX idx_profiles_clerk_id   ON profiles(clerk_user_id);

-- Follows: load who a user follows, load a user's followers
CREATE INDEX idx_follows_follower    ON follows(follower_id);
CREATE INDEX idx_follows_following   ON follows(following_id);

-- Comments: load all comments on a review, load replies to a comment
CREATE INDEX idx_comments_review     ON comments(review_id);
CREATE INDEX idx_comments_parent     ON comments(parent_comment_id);

-- Watched matches: load a user's full watch log
CREATE INDEX idx_watched_user        ON watched_matches(user_id);

-- Achievements: load all achievements for a user profile
CREATE INDEX idx_achievements_user   ON achievements(user_id);

-- H2H cache: look up by either player in the pair
CREATE INDEX idx_h2h_player1         ON h2h_cache(player1_id);
CREATE INDEX idx_h2h_player2         ON h2h_cache(player2_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE players         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_ratings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE h2h_cache       ENABLE ROW LEVEL SECURITY;


-- ── players: public read, no user writes (API/admin only) ────
CREATE POLICY "players: public read"
  ON players FOR SELECT USING (true);

-- ── matches: public read, no user writes ────────────────────
CREATE POLICY "matches: public read"
  ON matches FOR SELECT USING (true);

-- ── profiles: public read, users manage their own ───────────
CREATE POLICY "profiles: public read"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT
  WITH CHECK (clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub'));

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub'));

-- ── reviews: public read, authenticated insert, own update/delete ──
CREATE POLICY "reviews: public read"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "reviews: authenticated insert"
  ON reviews FOR INSERT
  WITH CHECK (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

CREATE POLICY "reviews: update own"
  ON reviews FOR UPDATE
  USING (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

CREATE POLICY "reviews: delete own"
  ON reviews FOR DELETE
  USING (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

-- ── skill_ratings: same pattern as reviews ──────────────────
CREATE POLICY "skill_ratings: public read"
  ON skill_ratings FOR SELECT USING (true);

CREATE POLICY "skill_ratings: authenticated insert"
  ON skill_ratings FOR INSERT
  WITH CHECK (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

CREATE POLICY "skill_ratings: update own"
  ON skill_ratings FOR UPDATE
  USING (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

CREATE POLICY "skill_ratings: delete own"
  ON skill_ratings FOR DELETE
  USING (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

-- ── follows: public read, users manage their own ────────────
CREATE POLICY "follows: public read"
  ON follows FOR SELECT USING (true);

CREATE POLICY "follows: insert own"
  ON follows FOR INSERT
  WITH CHECK (
    follower_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

CREATE POLICY "follows: delete own"
  ON follows FOR DELETE
  USING (
    follower_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

-- ── comments: public read, authenticated insert, own delete ─
CREATE POLICY "comments: public read"
  ON comments FOR SELECT USING (true);

CREATE POLICY "comments: authenticated insert"
  ON comments FOR INSERT
  WITH CHECK (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

CREATE POLICY "comments: delete own"
  ON comments FOR DELETE
  USING (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

-- ── watched_matches: users manage their own ─────────────────
CREATE POLICY "watched_matches: select own"
  ON watched_matches FOR SELECT
  USING (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

CREATE POLICY "watched_matches: insert own"
  ON watched_matches FOR INSERT
  WITH CHECK (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

CREATE POLICY "watched_matches: delete own"
  ON watched_matches FOR DELETE
  USING (
    user_id = (
      SELECT id FROM profiles
      WHERE clerk_user_id = (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )
  );

-- ── achievements: public read, no user writes (server only) ─
CREATE POLICY "achievements: public read"
  ON achievements FOR SELECT USING (true);

-- ── h2h_cache: public read, no user writes ──────────────────
CREATE POLICY "h2h_cache: public read"
  ON h2h_cache FOR SELECT USING (true);


-- ============================================================
-- UPDATED_AT trigger — auto-stamps updated_at on reviews and
-- skill_ratings whenever a row is modified
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER skill_ratings_updated_at
  BEFORE UPDATE ON skill_ratings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
