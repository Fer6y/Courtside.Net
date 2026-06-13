// Skill-axis metadata shared by the player cards (and reusable elsewhere).
// The 17 community-rated axes, grouped into the four rating-system categories.
// Colours match the rating form / RadarChart: Mental coral, Technique green,
// Skill amber, Movement blue.

export type SkillCategory = "mental" | "technique" | "skill" | "movement";

export const CATEGORY_COLOR: Record<SkillCategory, string> = {
  mental:    "#d4734e",
  technique: "#22d68a",
  skill:     "#f5c518",
  movement:  "#4a9eff",
};

// axis key → short display label + category
export const SKILL_META: Record<string, { label: string; category: SkillCategory }> = {
  // Mental
  focus:           { label: "Focus",      category: "mental" },
  clutch:          { label: "Clutch",     category: "mental" },
  resilience:      { label: "Resilience", category: "mental" },
  processing_time: { label: "Processing", category: "mental" },
  // Technique
  serve:           { label: "Serve",      category: "technique" },
  forehand:        { label: "Forehand",   category: "technique" },
  backhand:        { label: "Backhand",   category: "technique" },
  shot_variety:    { label: "Variety",    category: "technique" },
  // Skill
  net_play:        { label: "Net play",   category: "skill" },
  touch:           { label: "Touch",      category: "skill" },
  return_play:     { label: "Return",     category: "skill" },
  reaction_time:   { label: "Reaction",   category: "skill" },
  deception:       { label: "Deception",  category: "skill" },
  // Movement
  speed:           { label: "Speed",      category: "movement" },
  court_coverage:  { label: "Coverage",   category: "movement" },
  positioning:     { label: "Position",   category: "movement" },
  anticipation:    { label: "Anticipation", category: "movement" },
};

// The canonical list of axis keys (e.g. for a select on skill_ratings).
export const SKILL_KEYS = Object.keys(SKILL_META);

export interface TopSkill {
  key: string;
  label: string;
  value: number;
  color: string;
}

// Given a player's per-axis community averages, return the n highest-rated
// axes (descending), each with its label and category colour. Axes with no
// rating (0 / NaN) are ignored.
export function topSkills(avgMap: Record<string, number>, n = 2): TopSkill[] {
  return Object.entries(avgMap)
    .filter(([key, v]) => SKILL_META[key] && Number.isFinite(v) && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, value]) => ({
      key,
      label: SKILL_META[key].label,
      value: Math.round(value * 10) / 10,
      color: CATEGORY_COLOR[SKILL_META[key].category],
    }));
}
