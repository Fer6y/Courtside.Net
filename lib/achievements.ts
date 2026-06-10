export type AchievementTier = "common" | "uncommon" | "rare" | "grail";

export interface Achievement {
  id: string;
  tier: AchievementTier;
  name: string;
  description: string;
  badge: string; // path in /public/badges/
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Common ────────────────────────────────────────────────────────────────
  {
    id: "first_review",
    tier: "common",
    name: "First Watch",
    description: "Submit your first match review",
    badge: "/badges/common_first_review.svg",
  },
  {
    id: "first_search",
    tier: "common",
    name: "Scout",
    description: "Explore the match catalogue",
    badge: "/badges/common_first_search.svg",
  },
  {
    id: "first_follow",
    tier: "common",
    name: "Connected",
    description: "Follow another fan",
    badge: "/badges/common_first_follow.svg",
  },
  {
    id: "first_collection",
    tier: "common",
    name: "Collector",
    description: "Create your first named collection",
    badge: "/badges/common_first_collection.svg",
  },

  // ── Uncommon ──────────────────────────────────────────────────────────────
  {
    id: "scorekeeper",
    tier: "uncommon",
    name: "Scorekeeper",
    description: "Review 10 matches",
    badge: "/badges/uncommon_scorekeeper.svg",
  },
  {
    id: "analyst",
    tier: "uncommon",
    name: "Analyst",
    description: "Rate 5 players",
    badge: "/badges/uncommon_analyst.svg",
  },
  {
    id: "connoisseur",
    tier: "uncommon",
    name: "Connoisseur",
    description: "Favorite 3 matches",
    badge: "/badges/uncommon_connoisseur.svg",
  },
  {
    id: "curator",
    tier: "uncommon",
    name: "Curator",
    description: "Build 3 named collections",
    badge: "/badges/uncommon_curator.svg",
  },
  {
    id: "surface_explorer",
    tier: "uncommon",
    name: "Surface Explorer",
    description: "Review matches on Hard, Clay, and Grass",
    badge: "/badges/uncommon_surface_explorer.svg",
  },
  {
    id: "commentator",
    tier: "uncommon",
    name: "Commentator",
    description: "Write 5 detailed reviews with commentary",
    badge: "/badges/uncommon_commentator.svg",
  },

  // ── Rare ──────────────────────────────────────────────────────────────────
  {
    id: "court_authority",
    tier: "rare",
    name: "Court Authority",
    description: "Review 50 matches",
    badge: "/badges/rare_court_authority.svg",
  },
  {
    id: "deep_reader",
    tier: "rare",
    name: "Deep Reader",
    description: "Write 10 detailed reviews with commentary",
    badge: "/badges/rare_deep_reader.svg",
  },
  {
    id: "radar_master",
    tier: "rare",
    name: "Radar Master",
    description: "Rate 20 players",
    badge: "/badges/rare_radar_master.svg",
  },
  {
    id: "archivist",
    tier: "rare",
    name: "Archivist",
    description: "Favorite 10 matches",
    badge: "/badges/rare_archivist.svg",
  },
  {
    id: "chronicler",
    tier: "rare",
    name: "Chronicler",
    description: "Write 25 total reviews",
    badge: "/badges/rare_chronicler.svg",
  },
  {
    id: "networker",
    tier: "rare",
    name: "Networker",
    description: "Follow 10 other fans",
    badge: "/badges/rare_networker.svg",
  },

  // ── Grail ─────────────────────────────────────────────────────────────────
  {
    id: "grand_slam",
    tier: "grail",
    name: "Grand Slam Watcher",
    description: "Review a match from all four Grand Slams",
    badge: "/badges/grail_grand_slam.svg",
  },
  {
    id: "legend",
    tier: "grail",
    name: "Legend",
    description: "Review 100 matches",
    badge: "/badges/grail_legend.svg",
  },
  {
    id: "hall_of_fame",
    tier: "grail",
    name: "Hall of Fame",
    description: "Earn 10 followers",
    badge: "/badges/grail_hall_of_fame.svg",
  },
  {
    id: "omniscient",
    tier: "grail",
    name: "Omniscient",
    description: "Review on every surface at both Slams and Masters",
    badge: "/badges/grail_omniscient.svg",
  },
  {
    id: "author",
    tier: "grail",
    name: "The Author",
    description: "Write 50 reviews with commentary",
    badge: "/badges/grail_author.svg",
  },
  {
    id: "constellation",
    tier: "grail",
    name: "Constellation",
    description: "Be followed by 25 fans",
    badge: "/badges/grail_constellation.svg",
  },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export const TIER_COLORS: Record<AchievementTier, string> = {
  common:   "#9ca3af",
  uncommon: "#4a9eff",
  rare:     "#f5c518",
  grail:    "#22d68a",
};

export const TIER_LABELS: Record<AchievementTier, string> = {
  common:   "Common",
  uncommon: "Uncommon",
  rare:     "Rare",
  grail:    "Grail",
};

// Ordered for display — Grail first
export const TIER_ORDER: AchievementTier[] = ["grail", "rare", "uncommon", "common"];
