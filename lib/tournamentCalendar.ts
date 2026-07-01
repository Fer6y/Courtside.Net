/**
 * lib/tournamentCalendar.ts
 *
 * The 15 tournaments Courtside tracks (4 Grand Slams + ATP Masters 1000 +
 * WTA 1000), with the date window each is expected in and the name patterns
 * used to verify identity against the API's tournament/info endpoint.
 *
 * IMPORTANT: windows only decide WHEN the refresh pipeline looks for an
 * event. They never decide WHICH seasonId is accepted — identity always
 * comes from tournament/info (name pattern + tier), the guardrail against
 * the wrong-seasonId disease (docs/match-data-validation-2026-06-12.md).
 *
 * `name` is the canonical tournament name as stored in the matches table
 * (rows are "<name> <year>") — changing one splits its catalogue group.
 */

export interface TrackedEvent {
  name: string;
  tier: "grand_slam" | "masters_1000";
  surface: "Hard" | "Clay" | "Grass";
  tours: Array<"ATP" | "WTA">;
  windowLo: string; // MM-DD, deliberately wide
  windowHi: string;
  patterns: string[]; // lower-case substrings of the tournament/info name
}

export const TRACKED_EVENTS: TrackedEvent[] = [
  {
    name: "Australian Open", tier: "grand_slam", surface: "Hard",
    tours: ["ATP", "WTA"], windowLo: "01-08", windowHi: "02-05",
    patterns: ["australian open"],
  },
  {
    name: "Indian Wells Masters", tier: "masters_1000", surface: "Hard",
    tours: ["ATP", "WTA"], windowLo: "03-01", windowHi: "03-25",
    patterns: ["indian wells", "bnp paribas open"],
  },
  {
    name: "Miami Open", tier: "masters_1000", surface: "Hard",
    tours: ["ATP", "WTA"], windowLo: "03-15", windowHi: "04-08",
    patterns: ["miami"],
  },
  {
    name: "Monte-Carlo Masters", tier: "masters_1000", surface: "Clay",
    tours: ["ATP"], windowLo: "04-03", windowHi: "04-25",
    patterns: ["monte", "monaco"],
  },
  {
    name: "Madrid Open", tier: "masters_1000", surface: "Clay",
    tours: ["ATP", "WTA"], windowLo: "04-20", windowHi: "05-12",
    patterns: ["madrid"],
  },
  {
    name: "Italian Open", tier: "masters_1000", surface: "Clay",
    tours: ["ATP", "WTA"], windowLo: "05-05", windowHi: "05-25",
    patterns: ["rome", "italia", "internazionali"],
  },
  {
    name: "Roland Garros", tier: "grand_slam", surface: "Clay",
    tours: ["ATP", "WTA"], windowLo: "05-18", windowHi: "06-15",
    patterns: ["roland garros", "french open"],
  },
  {
    name: "Wimbledon", tier: "grand_slam", surface: "Grass",
    tours: ["ATP", "WTA"], windowLo: "06-25", windowHi: "07-20",
    patterns: ["wimbledon"],
  },
  {
    name: "Canadian Open", tier: "masters_1000", surface: "Hard",
    tours: ["ATP", "WTA"], windowLo: "07-25", windowHi: "08-15",
    patterns: ["canada", "canadian", "rogers", "national bank", "toronto", "montreal"],
  },
  {
    name: "Western & Southern Open", tier: "masters_1000", surface: "Hard",
    tours: ["ATP", "WTA"], windowLo: "08-05", windowHi: "08-25",
    patterns: ["cincinnati", "western & southern", "western and southern"],
  },
  {
    name: "US Open", tier: "grand_slam", surface: "Hard",
    tours: ["ATP", "WTA"], windowLo: "08-20", windowHi: "09-15",
    patterns: ["us open"],
  },
  {
    name: "Wuhan Open", tier: "masters_1000", surface: "Hard",
    tours: ["WTA"], windowLo: "09-15", windowHi: "10-10",
    patterns: ["wuhan"],
  },
  {
    name: "China Open", tier: "masters_1000", surface: "Hard",
    tours: ["WTA"], windowLo: "09-20", windowHi: "10-15",
    patterns: ["beijing", "china open"],
  },
  {
    name: "Shanghai Masters", tier: "masters_1000", surface: "Hard",
    tours: ["ATP"], windowLo: "09-25", windowHi: "10-18",
    patterns: ["shanghai"],
  },
  {
    name: "Paris Masters", tier: "masters_1000", surface: "Hard",
    tours: ["ATP"], windowLo: "10-22", windowHi: "11-10",
    patterns: ["paris", "bercy"],
  },
];

/** Events whose window contains the given date (UTC), with the season year. */
export function eventsInWindow(date: Date): { event: TrackedEvent; year: number }[] {
  const year = date.getUTCFullYear();
  const mmdd = date.toISOString().slice(5, 10);
  return TRACKED_EVENTS
    .filter((e) => mmdd >= e.windowLo && mmdd <= e.windowHi)
    .map((event) => ({ event, year }));
}

/**
 * Does a tournament/info response identify as this event?
 * Tier gate first (excludes Olympics, 500s, Finals, challengers), then the
 * name patterns. Indian Wells is disambiguated before pattern matching
 * because it shares the "BNP Paribas" sponsor with the Paris Masters.
 */
export function identityMatches(
  event: TrackedEvent,
  infoName: string,
  infoTier: string
): boolean {
  const name = (infoName ?? "").toLowerCase();
  const tier = (infoTier ?? "").toLowerCase();

  const tierOk =
    event.tier === "grand_slam"
      ? tier.includes("grand slam")
      : tier.includes("1000") || tier.includes("premier");
  if (!tierOk) return false;

  const isIndianWells = name.includes("indian wells") || name.includes("bnp paribas open");
  if (isIndianWells) return event.name === "Indian Wells Masters";

  return event.patterns.some((p) => name.includes(p));
}
