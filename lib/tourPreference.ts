/**
 * lib/tourPreference.ts
 *
 * Which tours the viewer wants surfaced in tour-agnostic spots like the
 * home page "Top of the Draw". Default is ATP-only; the WTA is opt-in.
 *
 * Mirrors the court-theme pattern (lib/courts.ts): a cookie is the source of
 * truth for server rendering (no DB hit per request), with a durable backup on
 * the signed-in user's profile.layout_config.
 */

export type TourPreference = "atp" | "all";

/** Cookie that drives tour-scoped rendering (read in server components). */
export const TOUR_PREF_COOKIE = "tour_pref";
export const DEFAULT_TOUR_PREF: TourPreference = "atp";

export const TOUR_PREF_OPTIONS: { value: TourPreference; label: string; note: string }[] = [
  { value: "atp", label: "ATP only",    note: "Men's tour" },
  { value: "all", label: "ATP + WTA",   note: "Both tours" },
];

/** Narrow an arbitrary string to a valid preference, falling back to the default. */
export function asTourPreference(value: string | null | undefined): TourPreference {
  return value === "atp" || value === "all" ? value : DEFAULT_TOUR_PREF;
}
