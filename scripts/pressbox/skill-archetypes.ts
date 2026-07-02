/**
 * skill-archetypes.ts — the Press Box scouting book.
 *
 * One consensus 17-axis profile per player (1–5 scale, the same scale the
 * rating form uses). Each persona's actual submitted rating is this archetype
 * plus seeded jitter and their own emphasis bumps (see seed.ts), so raters
 * agree on the shape of a player but not the exact numbers — which is what a
 * real community of opinionated watchers looks like.
 *
 * Axis order (matches app/players/[id]/rate/actions.ts AXES):
 *   focus, clutch, resilience, processing_time,
 *   serve, forehand, backhand, shot_variety,
 *   net_play, touch, return_play, reaction_time, deception,
 *   speed, court_coverage, positioning, anticipation
 */

export const AXES = [
  "focus", "clutch", "resilience", "processing_time",
  "serve", "forehand", "backhand", "shot_variety",
  "net_play", "touch", "return_play", "reaction_time", "deception",
  "speed", "court_coverage", "positioning", "anticipation",
] as const;

export type Axis = (typeof AXES)[number];

function profile(values: number[]): Record<Axis, number> {
  if (values.length !== AXES.length) throw new Error(`expected ${AXES.length} values, got ${values.length}`);
  return Object.fromEntries(AXES.map((axis, i) => [axis, values[i]])) as Record<Axis, number>;
}

// keyed by exact players.name — seed.ts resolves names → ids and warns on misses
export const SKILL_ARCHETYPES: Record<string, Record<Axis, number>> = {
  // ── ATP ─────────────────────────────────────────────────────────────────
  //                          foc  clu  res  pro  srv  fh   bh   var  net  tch  ret  rea  dec  spd  cov  pos  ant
  "Jannik Sinner":    profile([5,  4.5, 4.5, 4.5, 4.5, 5,   5,   4,   4,   4,   5,   5,   3.5, 4.5, 4.5, 5,   4.5]),
  "Carlos Alcaraz":   profile([4,  5,   4.5, 5,   4,   5,   4.5, 5,   4.5, 5,   4.5, 5,   5,   5,   5,   4.5, 4.5]),
  "Novak Djokovic":   profile([5,  5,   5,   5,   4.5, 4.5, 5,   4.5, 4,   4.5, 5,   4.5, 4,   4,   4.5, 5,   5]),
  "Alexander Zverev": profile([3.5,3.5, 4,   3.5, 5,   4,   4.5, 3.5, 3.5, 3.5, 4.5, 4,   3,   4,   4.5, 4,   4]),
  "Daniil Medvedev":  profile([4,  4,   4.5, 4,   4.5, 3.5, 4,   3.5, 3.5, 3.5, 4.5, 4,   3.5, 4.5, 5,   3.5, 4.5]),
  "Ben Shelton":      profile([3.5,4,   4,   3.5, 5,   4.5, 3.5, 4,   4.5, 4,   3.5, 4,   4,   4.5, 4,   3.5, 3.5]),
  "Alex De Minaur":   profile([4.5,3.5, 4.5, 4,   3.5, 4,   4,   3.5, 4,   3.5, 4.5, 4.5, 3.5, 5,   5,   4.5, 5]),
  "Taylor Fritz":     profile([4.5,4,   4,   3.5, 5,   4.5, 4,   3.5, 3.5, 3.5, 4,   4,   3,   3.5, 3.5, 4,   3.5]),
  "Casper Ruud":      profile([4.5,3.5, 4,   3.5, 4,   4.5, 3.5, 3.5, 3.5, 3.5, 4,   3.5, 3,   4,   4.5, 4,   4]),
  "Lorenzo Musetti":  profile([3.5,3.5, 3.5, 4,   3.5, 4,   4.5, 5,   4.5, 5,   4,   4,   4.5, 4,   4.5, 4,   4]),
  "Alexander Bublik": profile([2.5,3.5, 2.5, 4,   5,   4,   3.5, 5,   4.5, 5,   3,   3.5, 5,   3.5, 3,   3.5, 3.5]),
  "Frances Tiafoe":   profile([3,  4,   3.5, 3.5, 4.5, 4.5, 3.5, 4,   4.5, 4.5, 3.5, 4.5, 4,   4.5, 4,   3.5, 4]),
  "Joao Fonseca":     profile([3.5,4,   3.5, 4,   4.5, 5,   4,   4,   3.5, 4,   4,   4.5, 3.5, 4,   4,   3.5, 4]),
  "Jakub Mensik":     profile([3.5,4.5, 4,   3.5, 5,   4,   4.5, 3.5, 3.5, 3.5, 4,   4,   3,   3.5, 3.5, 3.5, 3.5]),
  "Learner Tien":     profile([4,  4,   4,   4.5, 3.5, 4,   4.5, 4,   3.5, 4,   4.5, 4.5, 4,   4,   4.5, 4,   4.5]),
  "Andrey Rublev":    profile([3,  3,   3.5, 3,   4.5, 5,   3.5, 3,   3,   3,   4,   3.5, 2.5, 4,   4,   3.5, 3.5]),
  // ── WTA ─────────────────────────────────────────────────────────────────
  "Aryna Sabalenka":  profile([4,  4.5, 4.5, 4,   5,   5,   4.5, 3.5, 3.5, 3.5, 4.5, 4,   3,   4,   4,   4,   4]),
  "Elena Rybakina":   profile([4,  4,   3.5, 3.5, 5,   5,   4,   3.5, 3.5, 3.5, 4,   4,   3,   3.5, 3.5, 4,   3.5]),
  "Iga Swiatek":      profile([4.5,4,   4.5, 4.5, 4,   5,   4.5, 4,   3.5, 4,   4.5, 4.5, 3.5, 5,   5,   4.5, 4.5]),
  "Coco Gauff":       profile([4,  4.5, 4.5, 4,   3.5, 3.5, 4.5, 4,   4,   4,   5,   5,   3.5, 5,   5,   4.5, 5]),
  "Jessica Pegula":   profile([4.5,3.5, 4,   4.5, 3.5, 4,   4.5, 3.5, 4,   3.5, 4.5, 4.5, 3.5, 4,   4,   4.5, 4.5]),
  "Amanda Anisimova": profile([3.5,4,   3.5, 4.5, 4,   4.5, 5,   3.5, 3.5, 3.5, 4.5, 5,   3.5, 3.5, 3.5, 4,   4]),
  "Mirra Andreeva":   profile([4,  4,   4.5, 4.5, 4,   4,   4.5, 4.5, 4,   4.5, 4.5, 4,   4.5, 4,   4.5, 4.5, 4.5]),
  "Elina Svitolina":  profile([4.5,4,   5,   4,   3.5, 4,   4.5, 3.5, 3.5, 3.5, 4.5, 4,   3,   4.5, 5,   4.5, 4.5]),
  "Naomi Osaka":      profile([3.5,4.5, 3.5, 4,   5,   5,   4.5, 3.5, 3,   3.5, 4,   4,   3,   3.5, 3.5, 4,   3.5]),
  "Madison Keys":     profile([3.5,4.5, 3.5, 3.5, 4.5, 5,   4.5, 3.5, 3.5, 3.5, 4,   4,   3,   3.5, 3.5, 3.5, 3.5]),
  "Jasmine Paolini":  profile([4.5,4,   4.5, 4,   3.5, 4.5, 3.5, 4,   4,   4,   4,   4.5, 3.5, 5,   4.5, 4,   4.5]),
  "Victoria Mboko":   profile([3.5,4,   4,   3.5, 4,   4.5, 4,   3.5, 3.5, 3.5, 4,   4,   3.5, 4.5, 4,   3.5, 4]),
};
