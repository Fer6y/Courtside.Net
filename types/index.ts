// ── Player ────────────────────────────────────────────────────────────────────

export type Player = {
  id: string;
  name: string;
  country: string | null;
  age: number | null;
  current_rank: number | null;
  image_url: string | null;    // legacy column
  photo_url: string | null;    // api-tennis.com player_logo URL (preferred)
  api_id: string | null;       // Sackmann numeric ID (legacy)
  api_player_key: string | null; // api-tennis.com player_key
  career_stats: {
    tour?: "ATP" | "WTA";
    dob?: string;              // ISO date, stored for crosswalk
    country_full?: string;     // Full country name from API
    [key: string]: unknown;
  };
  created_at: string;
};

// ── Match ─────────────────────────────────────────────────────────────────────

export type Surface = "Hard" | "Clay" | "Grass" | "Carpet";

export type Match = {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  tournament: string;
  round: string | null;
  score: string | null;
  surface: Surface | null;
  match_date: string | null;
  api_match_id: string | null;    // Sackmann dedup key (legacy)
  api_event_key: string | null;   // api-tennis.com event_key
  tournament_season: number | null;
  source: "sackmann" | "api_tennis" | null;
  tournament_tier: "grand_slam" | "masters_1000" | "other" | null;
  created_at: string;
};

// Match with player data joined in — used on browse and detail pages
export type MatchWithPlayers = Match & {
  player1: Pick<Player, "id" | "name" | "country" | "current_rank">;
  player2: Pick<Player, "id" | "name" | "country" | "current_rank">;
};

// ── Profile ───────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  clerk_user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

// ── Review ────────────────────────────────────────────────────────────────────

export type SetsWatched =
  | "1_set"
  | "2_sets"
  | "3_sets"
  | "4_sets"
  | "5_sets"
  | "full_match"
  | "highlights";

export type Review = {
  id: string;
  user_id: string;
  match_id: string;
  match_rating: number;
  player1_rating: number;
  player2_rating: number;
  comment: string | null;
  sets_watched: SetsWatched | null;
  created_at: string;
  updated_at: string;
};

// ── Skill Ratings ─────────────────────────────────────────────────────────────

export type SkillRating = {
  id: string;
  user_id: string;
  player_id: string;
  // Movement
  speed: number | null;
  court_coverage: number | null;
  positioning: number | null;
  // Technique
  serve: number | null;
  forehand: number | null;
  backhand: number | null;
  // Skill
  net_play: number | null;
  touch: number | null;
  reaction_time: number | null;
  return_play: number | null;
  // Mental
  mental_strength: number | null;
  created_at: string;
  updated_at: string;
};

// Aggregated community averages for the radar chart
export type SkillAverages = {
  speed: number;
  court_coverage: number;
  positioning: number;
  serve: number;
  forehand: number;
  backhand: number;
  net_play: number;
  touch: number;
  reaction_time: number;
  return_play: number;
  mental_strength: number;
  total_raters: number;
};

// ── Achievement ───────────────────────────────────────────────────────────────

export type AchievementTier = "common" | "uncommon" | "rare" | "grail";

export type Achievement = {
  id: string;
  user_id: string;
  achievement_type: string;
  tier: AchievementTier;
  earned_at: string;
};

// ── H2H Cache ─────────────────────────────────────────────────────────────────

export type H2HCache = {
  player1_id: string;
  player2_id: string;
  total_matches: number;
  p1_wins: number;
  p2_wins: number;
  last_updated: string;
};
