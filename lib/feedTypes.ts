import type { AvatarConfig } from "@/lib/avatarTemplates";

export interface ProfileMini {
  id:           string;
  username:     string;
  display_name: string | null;
  avatar_config: AvatarConfig | null;
}

export interface MatchMini {
  id:         string;
  tournament: string;
  round:      string | null;
  surface:    string | null;
  match_date: string | null;
  player1:    { id: string; name: string } | null;
  player2:    { id: string; name: string } | null;
}

export interface PlayerMini {
  id:           string;
  name:         string;
  country:      string | null;
  current_rank: number | null;
}

export interface ReviewActivity {
  type:         "review";
  id:           string;
  created_at:   string;
  user:         ProfileMini;
  match:        MatchMini | null;
  match_rating: number;
  comment:      string | null;
}

export interface RatingActivity {
  type:      "rating";
  id:        string;
  created_at: string;
  user:       ProfileMini;
  player:     PlayerMini | null;
  topSkill:   { label: string; value: number } | null;
}

export type ActivityItem = ReviewActivity | RatingActivity;

export interface TrendingPlayer {
  player:      PlayerMini;
  ratingCount: number;
  topSkill:    { label: string; value: number } | null;
}

export interface HotMatch {
  match:       MatchMini;
  reviewCount: number;
  avgRating:   number;
}

export interface Top25Clash {
  match:   MatchMini & {
    player1: { id: string; name: string; current_rank: number | null } | null;
    player2: { id: string; name: string; current_rank: number | null } | null;
  };
  reviewCount: number;
}
