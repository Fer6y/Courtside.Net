/**
 * scripts/fetch-masters-gaps.ts
 *
 * Fills in missing Masters 1000 events by probing player IDs from our
 * own Supabase players table rather than just the live rankings.
 *
 * WHY THIS IS NEEDED
 * ──────────────────
 * The rankings API only returns ~100 players. All of them are active
 * year-round, so their 10 most recent TourRank:2 matches are dominated
 * by H2 events (Paris, Shanghai, Cincinnati). H1 events like Indian Wells
 * (March), Miami (April), Monte Carlo (April), and Italian Open (May) fall
 * off the list.
 *
 * Our players table has 500-1000 players imported from Grand Slams + H2
 * Masters draws. Players who only played spring events will have those in
 * their recent list.
 *
 * SAFE TO RE-RUN — already-staged fixtures are skipped.
 *
 * Run: npm run fetch:masters-gaps
 *
 * AFTER RUNNING
 * ─────────────
 * npm run migrate:phase2c   (import any new players from draws)
 * npm run migrate:phase2d   (process new fixtures into matches table)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Target: only the events we know are missing ───────────────────────────────

interface MissingEvent {
  name:    string;
  tour:    "ATP" | "WTA";
  year:    number;
  start:   string;  // MM-DD
  end:     string;
  surface: "Hard" | "Clay";
}

const MISSING: MissingEvent[] = [
  // ATP H1 events missing for 2022–2025
  { name: "Indian Wells Masters",    tour: "ATP", year: 2022, start: "03-07", end: "03-22", surface: "Hard" },
  { name: "Indian Wells Masters",    tour: "ATP", year: 2023, start: "03-06", end: "03-20", surface: "Hard" },
  { name: "Indian Wells Masters",    tour: "ATP", year: 2024, start: "03-04", end: "03-18", surface: "Hard" },
  { name: "Indian Wells Masters",    tour: "ATP", year: 2025, start: "03-05", end: "03-17", surface: "Hard" },

  { name: "Miami Open",              tour: "ATP", year: 2022, start: "03-22", end: "04-04", surface: "Hard" },
  { name: "Miami Open",              tour: "ATP", year: 2023, start: "03-21", end: "04-03", surface: "Hard" },
  { name: "Miami Open",              tour: "ATP", year: 2024, start: "03-19", end: "04-01", surface: "Hard" },
  { name: "Miami Open",              tour: "ATP", year: 2025, start: "03-18", end: "03-31", surface: "Hard" },

  { name: "Monte-Carlo Masters",     tour: "ATP", year: 2021, start: "04-10", end: "04-19", surface: "Clay" },
  { name: "Monte-Carlo Masters",     tour: "ATP", year: 2022, start: "04-09", end: "04-18", surface: "Clay" },
  { name: "Monte-Carlo Masters",     tour: "ATP", year: 2024, start: "04-06", end: "04-15", surface: "Clay" },

  { name: "Italian Open",            tour: "ATP", year: 2022, start: "05-08", end: "05-16", surface: "Clay" },
  { name: "Italian Open",            tour: "ATP", year: 2023, start: "05-10", end: "05-22", surface: "Clay" },
  { name: "Italian Open",            tour: "ATP", year: 2024, start: "05-06", end: "05-20", surface: "Clay" },

  // ATP Western & Southern Open 2025 (August — surprisingly missed)
  { name: "Western & Southern Open", tour: "ATP", year: 2025, start: "08-11", end: "08-23", surface: "Hard" },

  // WTA gaps
  { name: "Indian Wells Masters",    tour: "WTA", year: 2024, start: "03-06", end: "03-18", surface: "Hard" },
  { name: "Indian Wells Masters",    tour: "WTA", year: 2025, start: "03-05", end: "03-17", surface: "Hard" },
  { name: "Italian Open",           tour: "WTA", year: 2022, start: "05-09", end: "05-16", surface: "Clay" },
  { name: "Italian Open",           tour: "WTA", year: 2025, start: "05-10", end: "05-19", surface: "Clay" },
  { name: "Miami Open",             tour: "WTA", year: 2025, start: "03-19", end: "04-01", surface: "Hard" },
];

// WTA Grand Slam IDs to exclude
const WTA_SLAM_IDS = new Set([
  "13174","13039","13059","13350","13388","13396","13585",
  "13835","13854","13862","14154","14505","14870","14539","14720",
  "15248","15225","15233","15244","15945","16252","15973","15983",
  "16709","16725",
]);

function inWindow(dateStr: string, year: number, start: string, end: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d >= new Date(`${year}-${start}`) && d <= new Date(`${year}-${end}`);
}

async function tryFind(event: MissingEvent, playerIds: string[]): Promise<string | null> {
  for (const playerId of playerIds) {
    try {
      const matches = await matchstat<Record<string, unknown>[]>(
        `${event.tour.toLowerCase()}/player/past-matches/${playerId}`,
        { filter: `GameYear:${event.year};TourRank:2` }
      );
      if (!Array.isArray(matches)) continue;

      for (const m of matches) {
        const tid  = String(m.tournamentId ?? m.tournament_id ?? "").trim();
        const date = String(m.date ?? "").trim();
        if (!tid || !date) continue;
        if (event.tour === "WTA" && WTA_SLAM_IDS.has(tid)) continue;
        if (inWindow(date, event.year, event.start, event.end)) {
          return tid;
        }
      }
    } catch { /* skip */ }
  }
  return null;
}

async function stageFixtures(event: MissingEvent, seasonId: string): Promise<void> {
  // Check if already staged
  const { data: existing } = await supabase
    .from("api_raw_staging")
    .select("id")
    .eq("method", "get_fixtures")
    .contains("params", { seasonId, tour: event.tour })
    .maybeSingle();

  if (existing) {
    console.log(`    SKIP (already staged): ${event.name} ${event.year} ${event.tour}`);
    return;
  }

  const path   = `${event.tour.toLowerCase()}/tournament/results/${seasonId}`;
  const result = await matchstat<Record<string, unknown>>(path);
  const singles: unknown[] = (
    result?.singles ??
    (result?.data as Record<string, unknown>)?.singles ??
    []
  ) as unknown[];

  await supabase.from("api_raw_staging").insert({
    method:   "get_fixtures",
    params: {
      seasonId,
      tour:            event.tour,
      slam_name:       event.name,
      year:            String(event.year),
      surface:         event.surface,
      tournament_tier: "masters_1000",
    },
    response: { singles },
  });

  const warn = singles.length === 0 ? "  ⚠️  zero matches" : "";
  console.log(`    ✓ Staged: ${event.name} ${event.year} ${event.tour} — ${singles.length} matches${warn}`);
}

async function main() {
  console.log("\nfetch-masters-gaps — filling in missing H1 Masters events\n");

  // Load all api_player_key values from our DB (far more than just rankings)
  console.log("  Loading player IDs from database...");
  const { data: dbPlayers } = await supabase
    .from("players")
    .select("api_player_key")
    .not("api_player_key", "is", null);

  const allPlayerIds = (dbPlayers ?? [])
    .map((p) => String(p.api_player_key).trim())
    .filter(Boolean);

  console.log(`  ${allPlayerIds.length} player IDs available for probing.\n`);

  for (const event of MISSING) {
    // Check if already staged — skip immediately if so
    const { data: existing } = await supabase
      .from("api_raw_staging")
      .select("id")
      .eq("method", "get_fixtures")
      .contains("params", { tour: event.tour, slam_name: event.name, year: String(event.year) })
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP (already staged): ${event.name} ${event.year} ${event.tour}`);
      continue;
    }

    console.log(`  Searching: ${event.name} ${event.year} ${event.tour}...`);

    const seasonId = await tryFind(event, allPlayerIds);

    if (!seasonId) {
      console.log(`    ⚠️  Not found — may not be in any player's recent 10 TourRank:2 matches`);
      continue;
    }

    console.log(`    Found seasonId: ${seasonId}`);
    await stageFixtures(event, seasonId);
  }

  console.log("\n  ✓  Gap-fill complete.");
  console.log("  Next:");
  console.log("    npm run migrate:phase2c   (import new players from draws)");
  console.log("    npm run migrate:phase2d   (process into matches table)\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
