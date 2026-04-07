-- Courtside — Row-Level Security Policies
-- Run after schema migration with RLS enabled on all tables
--
-- Clerk user ID is extracted from the JWT via:
--   auth.jwt() ->> 'sub'
-- This matches the clerk_user_id column in profiles and user_id in other tables.

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE h2h_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PLAYERS — Public read, admin-only write
-- (API sync uses service_role key which bypasses RLS)
-- ============================================================
CREATE POLICY "Players are publicly readable"
  ON players FOR SELECT
  USING (true);

-- ============================================================
-- MATCHES — Public read, admin-only write
-- ============================================================
CREATE POLICY "Matches are publicly readable"
  ON matches FOR SELECT
  USING (true);

-- ============================================================
-- PROFILES — Public read, users can update their own
-- (Created by Clerk webhook using service_role key)
-- ============================================================
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (clerk_user_id = auth.jwt() ->> 'sub')
  WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

-- ============================================================
-- REVIEWS — Public read, authenticated insert, own update/delete
-- ============================================================
CREATE POLICY "Reviews are publicly readable"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (user_id = auth.jwt() ->> 'sub');

-- ============================================================
-- SKILL_RATINGS — Public read, authenticated insert, own update/delete
-- ============================================================
CREATE POLICY "Skill ratings are publicly readable"
  ON skill_ratings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create skill ratings"
  ON skill_ratings FOR INSERT
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update their own skill ratings"
  ON skill_ratings FOR UPDATE
  USING (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own skill ratings"
  ON skill_ratings FOR DELETE
  USING (user_id = auth.jwt() ->> 'sub');

-- ============================================================
-- COMMENTS — Public read, authenticated insert, own update/delete
-- ============================================================
CREATE POLICY "Comments are publicly readable"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (user_id = auth.jwt() ->> 'sub');

-- ============================================================
-- FOLLOWS — Users manage only their own follows
-- ============================================================
CREATE POLICY "Follows are publicly readable"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON follows FOR INSERT
  WITH CHECK (follower_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (follower_id = auth.jwt() ->> 'sub');

-- ============================================================
-- WATCHED_MATCHES — Users manage only their own watch log
-- ============================================================
CREATE POLICY "Watch log is publicly readable"
  ON watched_matches FOR SELECT
  USING (true);

CREATE POLICY "Users can log watched matches"
  ON watched_matches FOR INSERT
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can remove from watch log"
  ON watched_matches FOR DELETE
  USING (user_id = auth.jwt() ->> 'sub');

-- ============================================================
-- ACHIEVEMENTS — Public read, system-only write
-- (Triggered by edge functions using service_role key)
-- ============================================================
CREATE POLICY "Achievements are publicly readable"
  ON achievements FOR SELECT
  USING (true);

-- ============================================================
-- H2H_CACHE — Public read, system-only write
-- (Recomputed by edge function on match import)
-- ============================================================
CREATE POLICY "H2H cache is publicly readable"
  ON h2h_cache FOR SELECT
  USING (true);
