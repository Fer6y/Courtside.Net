/**
 * scripts/fetch-masters.ts
 *
 * Discovers and stages ATP Masters 1000 + WTA 1000 tournament fixtures
 * for 2020–2026, using the same player-probing strategy as phase2a.
 *
 * HOW IT WORKS
 * ────────────
 * The API's tournament/calendar endpoint only returns low-level ITF/Futures
 * events — Masters are NOT listed there. Instead we use player/past-matches
 * filtered by TourRank:2 (= Masters/Premier tier), probe enough ranked players
 * that all Masters windows are covered, then fetch the full singles draw for
 * each discovered tournament.
 *
 * QUIRKS
 * ──────
 * • The API returns only the 10 most recent TourRank:2 matches per player.
 *   Top players' lists are dominated by year-end events, so we probe up to
 *   MAX_PLAYERS players until every Masters window is covered.
 * • For ATP, TourRank:2 also returns ATP Finals (Nov) and Davis Cup (late Nov).
 *   Date windows exclude those automatically.
 * • For WTA, TourRank:2 also returns Grand Slams (different tier numbering).
 *   These are excluded via a hard-coded set of known WTA Slam IDs.
 *
 * SAFE TO RE-RUN
 * ──────────────
 * Already-staged fixtures are skipped (deduped by seasonId + tour).
 *
 * Run: npm run fetch:masters
 *
 * AFTER RUNNING
 * ─────────────
 * npm run migrate:phase2d   ← processes staged fixtures into matches table
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const MAX_PLAYERS = 150;

// ── WTA Grand Slam exclusion set ─────────────────────────────────────────────
// TourRank:2 on WTA player matches also returns Grand Slams. Exclude them.
const WTA_SLAM_IDS = new Set([
  "13174", "13039", "13059",                   // 2020
  "13350", "13388", "13396", "13585",          // 2021
  "13835", "13854", "13862", "14154",          // 2022
  "14505", "14870", "14539", "14720",          // 2023
  "15248", "15225", "15233", "15244",          // 2024
  "15945", "16252", "15973", "15983",          // 2025
  "16709", "16725",                            // 2026 (partial)
]);

// ── Masters date windows ──────────────────────────────────────────────────────
// format: "MM-DD". Match dates from player past-matches fall inside the
// tournament week. start/end are deliberately wide to catch edge cases.
//
// year-overrides handle COVID rescheduling (2020/2021 disruptions).

interface MastersWindow {
  name:     string;
  surface:  "Hard" | "Clay";
  tours:    Array<"ATP" | "WTA">;
  start:    string;  // default MM-DD
  end:      string;
  overrides?: Partial<Record<number, { start: string; end: string } | null>>;
  // null override = event cancelled that year (skip)
}

const MASTERS_WINDOWS: MastersWindow[] = [
  {
    name: "Indian Wells Masters", surface: "Hard", tours: ["ATP", "WTA"],
    start: "03-04", end: "03-23",
    overrides: {
      2020: null,                              // cancelled (COVID)
      2021: { start: "10-06", end: "10-19" }, // postponed to October
    },
  },
  {
    name: "Miami Open", surface: "Hard", tours: ["ATP", "WTA"],
    start: "03-21", end: "04-06",
    overrides: { 2020: null },                 // cancelled (COVID)
  },
  {
    name: "Monte-Carlo Masters", surface: "Clay", tours: ["ATP"],
    start: "04-08", end: "04-22",
    overrides: { 2020: null },                 // cancelled (COVID)
  },
  {
    name: "Madrid Open", surface: "Clay", tours: ["ATP", "WTA"],
    start: "04-24", end: "05-14",
    overrides: {
      // 2020 Madrid was played in September on Hard (bubble)
      2020: { start: "09-10", end: "09-22" },
    },
  },
  {
    name: "Italian Open", surface: "Clay", tours: ["ATP", "WTA"],
    start: "05-08", end: "05-22",
  },
  {
    name: "Canadian Open", surface: "Hard", tours: ["ATP", "WTA"],
    start: "07-28", end: "08-15",
    overrides: { 2020: null },                 // cancelled (COVID)
  },
  {
    name: "Western & Southern Open", surface: "Hard", tours: ["ATP", "WTA"],
    start: "08-12", end: "08-26",
    overrides: {
      // 2020 Cincinnati was combined ATP+WTA event in a bubble
      2020: { start: "08-20", end: "09-01" },
    },
  },
  {
    name: "Shanghai Masters", surface: "Hard", tours: ["ATP"],
    start: "09-29", end: "10-15",
    overrides: { 2020: null },                 // cancelled (COVID)
  },
  {
    name: "Paris Masters", surface: "Hard", tours: ["ATP"],
    start: "10-27", end: "11-09",
  },
  // ── WTA-only fall events ───────────────────────────────────────────────────
  // These vary significantly by year — Wuhan and Beijing were absent
  // 2020–2022 due to COVID and replaced by Guadalajara.
  {
    name: "Wuhan Open", surface: "Hard", tours: ["WTA"],
    start: "09-19", end: "10-06",
    overrides: { 2020: null, 2021: null, 2022: null },
  },
  {
    name: "China Open", surface: "Hard", tours: ["WTA"],
    start: "09-28", end: "10-11",
    overrides: { 2020: null, 2021: null, 2022: null },
  },
  {
    name: "Guadalajara Open", surface: "Hard", tours: ["WTA"],
    start: "10-17", end: "10-31",
    overrides: {
      // Guadalajara replaced Asian swing 2021-2022 only
      2020: null, 2023: null, 2024: null, 2025: null, 2026: null,
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWindowForYear(
  w: MastersWindow,
  year: number,
  tour: "ATP" | "WTA"
): { start: string; end: string } | null {
  if (!w.tours.includes(tour)) return null;
  const override = w.overrides?.[year];
  if (override === null) return null;          // explicitly cancelled
  if (override !== undefined) return override;
  return { start: w.start, end: w.end };
}

function identifyMasters(
  dateStr: string,
  year: number,
  tour: "ATP" | "WTA"
): MastersWindow | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  for (const w of MASTERS_WINDOWS) {
    const window = getWindowForYear(w, year, tour);
    if (!window) continue;
    const lo = new Date(`${year}-${window.start}`);
    const hi = new Date(`${year}-${window.end}`);
    if (d >= lo && d <= hi) return w;
  }
  return null;
}

/** Build a set of window keys that exist for this year+tour combo */
function buildNeededSet(year: number, tour: "ATP" | "WTA"): Set<string> {
  const needed = new Set<string>();
  for (const w of MASTERS_WINDOWS) {
    const window = getWindowForYear(w, year, tour);
    if (window) needed.add(w.name);
  }
  return needed;
}

// ── Core discovery ────────────────────────────────────────────────────────────

async function discoverAndStage(tour: "ATP" | "WTA", year: number) {
  const needed = buildNeededSet(year, tour);
  if (needed.size === 0) {
    console.log(`  ${tour} ${year}: no Masters expected (all cancelled)`);
    return;
  }

  console.log(`\n  ── ${tour} ${year}  (looking for: ${[...needed].join(", ")})`);

  // Load ranked player IDs for probing
  const rankings = await matchstat<Record<string, unknown>[]>(
    `${tour.toLowerCase()}/ranking/singles`
  );
  const playerIds: string[] = (Array.isArray(rankings) ? rankings : [])
    .map((row) => {
      const p = (row.player ?? row) as Record<string, unknown>;
      return String(p.id ?? "").trim();
    })
    .filter(Boolean);

  if (playerIds.length === 0) {
    console.log(`    ⚠️  No ${tour} ranked players found — skipping`);
    return;
  }

  // discovered: tournament name → { seasonId, surface }
  const discovered = new Map<string, { seasonId: string; surface: "Hard" | "Clay" }>();

  for (const playerId of playerIds.slice(0, MAX_PLAYERS)) {
    if (needed.size === 0) break;

    try {
      const matches = await matchstat<Record<string, unknown>[]>(
        `${tour.toLowerCase()}/player/past-matches/${playerId}`,
        { filter: `GameYear:${year};TourRank:2` }
      );
      if (!Array.isArray(matches)) continue;

      for (const m of matches) {
        const tid  = String(m.tournamentId ?? m.tournament_id ?? "").trim();
        const date = String(m.date ?? "").trim();
        if (!tid || !date) continue;

        // For WTA: skip known Grand Slam IDs
        if (tour === "WTA" && WTA_SLAM_IDS.has(tid)) continue;

        // Already identified this tournamentId? Mark it found and continue
        if ([...discovered.values()].some((v) => v.seasonId === tid)) continue;

        const window = identifyMasters(date, year, tour);
        if (!window) continue; // ATP Finals, Davis Cup, etc. — skip

        if (needed.has(window.name)) {
          discovered.set(window.name, { seasonId: tid, surface: window.surface });
          needed.delete(window.name);
          console.log(`    ✓ ${window.name} → seasonId ${tid}  (via player ${playerId})`);
        }
      }
    } catch {
      // Skip players that return errors
    }
  }

  if (needed.size > 0) {
    console.log(`    ⚠️  Not found after probing: ${[...needed].join(", ")}`);
  }

  // ── Fetch and stage fixtures ──────────────────────────────────────────────
  for (const [name, { seasonId, surface }] of discovered) {
    // Skip if already staged
    const { data: existing } = await supabase
      .from("api_raw_staging")
      .select("id")
      .eq("method", "get_fixtures")
      .contains("params", { seasonId, tour })
      .maybeSingle();

    if (existing) {
      console.log(`    SKIP (already staged): ${name} ${year} ${tour}`);
      continue;
    }

    try {
      const path   = `${tour.toLowerCase()}/tournament/results/${seasonId}`;
      const result = await matchstat<Record<string, unknown>>(path);

      const singles: unknown[] = (
        result?.singles ??
        (result?.data as Record<string, unknown>)?.singles ??
        []
      ) as unknown[];

      // Guard against the wrong-seasonId disease (see
      // docs/match-data-validation-2026-06-12.md): a real Masters main draw is
      // 48–96 players (47–95 matches). Anything smaller is a co-located
      // challenger/ITF/qualifying event grabbed by mistake — never stage it.
      // The verified-discovery path is scripts/probe-masters-seasonids.ts.
      if (singles.length < 45) {
        console.log(`    SKIP (only ${singles.length} singles — not a Masters main draw): ${name} ${year} ${tour} season ${seasonId}`);
        continue;
      }

      await supabase.from("api_raw_staging").insert({
        method:   "get_fixtures",
        params: {
          seasonId,
          tour,
          slam_name:       name,
          year:            String(year),
          surface,
          tournament_tier: "masters_1000",
        },
        response: { singles },
      });

      const warn = singles.length === 0 ? "  ⚠️  zero matches" : "";
      console.log(`    Staged: ${name} ${year} ${tour} — ${singles.length} singles matches${warn}`);
    } catch (err) {
      console.error(`    ERROR staging ${name} ${year} ${tour}: ${(err as Error).message}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\nfetch-masters — ATP Masters 1000 + WTA 1000 (2020–2026)\n");

  for (const year of YEARS) {
    await discoverAndStage("ATP", year);
    await discoverAndStage("WTA", year);
  }

  console.log("\n\n  ✓  Masters discovery complete.");
  console.log("  Next: npm run migrate:phase2d\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
