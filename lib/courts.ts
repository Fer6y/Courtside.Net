/**
 * lib/courts.ts
 *
 * Court-theme helpers safe to use in server components. The client
 * component that applies overrides lives in components/CourtOverride.tsx.
 */

export type CourtName = "grass" | "clay" | "hard";

/** Cookie that drives the server-rendered court theme (no flash, no DB hit). */
export const COURT_COOKIE = "court";
export const DEFAULT_COURT: CourtName = "grass";

export const COURT_OPTIONS: { value: CourtName; label: string; note: string }[] = [
  { value: "grass", label: "Grass", note: "The lawn" },
  { value: "clay",  label: "Clay",  note: "Terre battue" },
  { value: "hard",  label: "Hard",  note: "Acrylic blue" },
];

/** Narrow an arbitrary string to a valid court, falling back to the default. */
export function asCourt(value: string | null | undefined): CourtName {
  return value === "grass" || value === "clay" || value === "hard" ? value : DEFAULT_COURT;
}

/** Map a match surface to a court theme; null = leave the user's court */
export function surfaceToCourt(surface: string | null | undefined): CourtName | null {
  switch (surface?.toLowerCase()) {
    case "clay":  return "clay";
    case "grass": return "grass";
    case "hard":  return "hard";
    default:      return null;
  }
}

/**
 * Inline bootstrap script — runs during HTML parsing, before first paint,
 * so a full page load lands directly on the match's surface with no flash.
 * The user's own court is stashed in dataset.courtUser for restore.
 */
export function courtOverrideScript(court: CourtName): string {
  return `(function(){var h=document.documentElement;if(!h.dataset.courtUser){h.dataset.courtUser=h.dataset.court||"grass";}h.dataset.court="${court}";})();`;
}
