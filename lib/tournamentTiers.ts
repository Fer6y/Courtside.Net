/**
 * lib/tournamentTiers.ts
 *
 * Canonical source of truth for tournament tier classification.
 * Used by both the import scripts (to set tournament_tier on match rows)
 * and by the UI (to render tier badges and special styling).
 *
 * Tiers:
 *   grand_slam    — Australian Open, Roland Garros, Wimbledon, US Open
 *   masters_1000  — ATP Masters 1000 / WTA 1000 events
 *   other         — everything else
 */

export type TournamentTier = "grand_slam" | "masters_1000" | "other";

// ── Grand Slams ───────────────────────────────────────────────────────────────

export const GRAND_SLAM_NAMES = [
  "Australian Open",
  "Roland Garros",
  "Wimbledon",
  "US Open",
] as const;

// ── ATP Masters 1000 ─────────────────────────────────────────────────────────
// Includes common alternate/sponsor names the API may return.

export const MASTERS_1000_ATP: { name: string; surface: "Hard" | "Clay" }[] = [
  { name: "BNP Paribas Open",           surface: "Hard"  }, // Indian Wells
  { name: "Indian Wells Masters",        surface: "Hard"  },
  { name: "Indian Wells",                surface: "Hard"  },
  { name: "Miami Open",                  surface: "Hard"  },
  { name: "Monte-Carlo Masters",         surface: "Clay"  },
  { name: "Rolex Monte-Carlo Masters",   surface: "Clay"  },
  { name: "Monte Carlo Masters",         surface: "Clay"  },
  { name: "Mutua Madrid Open",           surface: "Clay"  },
  { name: "Madrid Open",                 surface: "Clay"  },
  { name: "Internazionali BNL d'Italia", surface: "Clay"  }, // Rome
  { name: "Italian Open",                surface: "Clay"  },
  { name: "Rome Masters",                surface: "Clay"  },
  { name: "National Bank Open",          surface: "Hard"  }, // Canada
  { name: "Rogers Cup",                  surface: "Hard"  },
  { name: "Canadian Open",               surface: "Hard"  },
  { name: "Western & Southern Open",     surface: "Hard"  }, // Cincinnati
  { name: "Cincinnati Masters",          surface: "Hard"  },
  { name: "Rolex Shanghai Masters",      surface: "Hard"  },
  { name: "Shanghai Masters",            surface: "Hard"  },
  { name: "Rolex Paris Masters",         surface: "Hard"  },
  { name: "Paris Masters",               surface: "Hard"  },
  { name: "BNP Paribas Masters",         surface: "Hard"  },
];

// ── WTA 1000 ─────────────────────────────────────────────────────────────────
// WTA equivalent tier (formerly Premier Mandatory / Premier 5).

export const MASTERS_1000_WTA: { name: string; surface: "Hard" | "Clay" }[] = [
  { name: "BNP Paribas Open",            surface: "Hard"  }, // Indian Wells
  { name: "Indian Wells",                surface: "Hard"  },
  { name: "Miami Open",                  surface: "Hard"  },
  { name: "Mutua Madrid Open",           surface: "Clay"  },
  { name: "Madrid Open",                 surface: "Clay"  },
  { name: "Internazionali BNL d'Italia", surface: "Clay"  },
  { name: "Italian Open",                surface: "Clay"  },
  { name: "National Bank Open",          surface: "Hard"  },
  { name: "Canadian Open",               surface: "Hard"  },
  { name: "Rogers Cup",                  surface: "Hard"  },
  { name: "Western & Southern Open",     surface: "Hard"  },
  { name: "Cincinnati",                  surface: "Hard"  },
  { name: "Wuhan Open",                  surface: "Hard"  },
  { name: "China Open",                  surface: "Hard"  }, // Beijing
  { name: "Guadalajara Open",            surface: "Hard"  },
  { name: "Zhengzhou Open",              surface: "Hard"  },
  { name: "Toray Pan Pacific Open",      surface: "Hard"  },
];

// ── Classification ─────────────────────────────────────────────────────────

/**
 * Classify a tournament name into a tier.
 * Works on partial/year-suffixed names like "Roland Garros 2024".
 */
export function getTournamentTier(name: string): TournamentTier {
  const n = name.toLowerCase();

  for (const gs of GRAND_SLAM_NAMES) {
    if (n.includes(gs.toLowerCase())) return "grand_slam";
  }

  const allMasters = [...MASTERS_1000_ATP, ...MASTERS_1000_WTA];
  for (const { name: m } of allMasters) {
    if (n.includes(m.toLowerCase())) return "masters_1000";
  }

  return "other";
}

/**
 * For Masters events: derive the surface from the tournament name.
 * Returns null if not found (caller should use its own fallback).
 */
export function getMastersSurface(name: string): "Hard" | "Clay" | null {
  const n = name.toLowerCase();
  const allMasters = [...MASTERS_1000_ATP, ...MASTERS_1000_WTA];
  for (const { name: m, surface } of allMasters) {
    if (n.includes(m.toLowerCase())) return surface;
  }
  return null;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export interface TierStyle {
  label:       string;
  color:       string;
  background:  string;
  border:      string;
  glow:        string;
}

/**
 * Programme "cover band" treatments — the tinted header strip on match
 * pages. Each Grand Slam has its own identity (content, not user theme:
 * these render identically on every court background). Masters get a
 * quiet silver band; everything else a plain hairline.
 */
export interface CoverBand {
  background:  string;
  borderColor: string;
}

const SLAM_COVERS: { match: string[]; cover: CoverBand }[] = [
  {
    match: ["australian open"],
    cover: { background: "rgba(42,123,212,0.14)",  borderColor: "rgba(42,123,212,0.6)" },
  },
  {
    match: ["roland garros", "french open"],
    cover: { background: "rgba(184,89,58,0.14)",   borderColor: "rgba(184,89,58,0.6)" },
  },
  {
    match: ["wimbledon"],
    cover: { background: "rgba(46,90,52,0.2)",     borderColor: "rgba(120,81,169,0.6)" },
  },
  {
    match: ["us open"],
    cover: { background: "rgba(27,58,107,0.22)",   borderColor: "rgba(74,144,217,0.5)" },
  },
];

const MASTERS_COVER: CoverBand = {
  background:  "rgba(192,192,192,0.06)",
  borderColor: "rgba(192,192,192,0.22)",
};

const PLAIN_COVER: CoverBand = {
  background:  "rgba(236,229,216,0.03)",
  borderColor: "rgba(236,229,216,0.14)",
};

export function getCoverBand(tournamentName: string, tier?: TournamentTier | null): CoverBand {
  const n = tournamentName.toLowerCase();
  for (const { match, cover } of SLAM_COVERS) {
    if (match.some((m) => n.includes(m))) return cover;
  }
  const resolvedTier = tier ?? getTournamentTier(tournamentName);
  return resolvedTier === "masters_1000" ? MASTERS_COVER : PLAIN_COVER;
}

export const TIER_STYLES: Record<TournamentTier, TierStyle | null> = {
  grand_slam: {
    label:      "Grand Slam",
    color:      "#f5c518",
    background: "rgba(245,197,24,0.1)",
    border:     "1px solid rgba(245,197,24,0.35)",
    glow:       "0 0 12px rgba(245,197,24,0.2)",
  },
  masters_1000: {
    label:      "Masters 1000",
    color:      "#c0c0c0",
    background: "rgba(192,192,192,0.08)",
    border:     "1px solid rgba(192,192,192,0.22)",
    glow:       "none",
  },
  other: null, // no badge for regular tournaments
};
