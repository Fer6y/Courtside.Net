/**
 * phase2a-fetch-tournaments.ts
 *
 * Discovers Grand Slam tournament IDs (tournamentId) for 2020–2024 by
 * cycling through ranked ATP players until all 4 Slams are found per year.
 *
 * Why this approach:
 *   - The calendar endpoint only returns ITF futures, not Grand Slams.
 *   - player/past-matches returns ~10 most recent matches per year.
 *   - By using many different players we guarantee coverage: a player who
 *     reached the US Open final and then retired for the year will have that
 *     Slam in their top 10 for that year.
 *
 * Output: a SLAM_SEASONS block to paste into phase2b-fetch-fixtures.ts.
 *
 * Run: npm run migrate:phase2a
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Grand Slam date windows (slightly wider than actual)
// Note: Roland Garros 2020 was postponed to Sep 27–Oct 11 (COVID). Regular window covers other years.
const SLAM_WINDOWS: { slam: string; start: string; end: string }[] = [
  { slam: "Australian Open", start: "01-10", end: "02-08" },
  { slam: "Roland Garros",   start: "05-18", end: "06-14" },
  { slam: "Wimbledon",       start: "06-24", end: "07-17" },
  { slam: "US Open",         start: "08-22", end: "09-14" },
];

// Extra windows for years when tournaments moved (COVID 2020)
const EXTRA_WINDOWS: { slam: string; year: number; start: string; end: string }[] = [
  { slam: "Roland Garros", year: 2020, start: "09-25", end: "10-12" }, // postponed
];

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

// Max players to try before giving up on a year (fetched from live rankings)
// Higher value needed to find AO — it's the first slam of the year so gets
// pushed off the "10 most recent" list for players active all season.
const MAX_PLAYERS_TO_TRY = 200;

// Known missing/unavailable — Wimbledon 2020 cancelled for both ATP and WTA
const KNOWN_MISSING: { slam: string; year: number; reason: string }[] = [
  { slam: "Wimbledon", year: 2020, reason: "cancelled (COVID)" },
  { slam: "WTA_Wimbledon", year: 2020, reason: "cancelled (COVID)" },
];

// All confirmed ATP IDs from Phase 2a discovery runs
const PRE_SEEDED: { slam: string; year: number; seasonId: string }[] = [
  { slam: "Australian Open", year: 2020, seasonId: "16565" },
  { slam: "Roland Garros",   year: 2020, seasonId: "16803" },
  { slam: "US Open",         year: 2020, seasonId: "16459" },
  { slam: "Australian Open", year: 2021, seasonId: "16879" },
  { slam: "Roland Garros",   year: 2021, seasonId: "17177" },
  { slam: "Wimbledon",       year: 2021, seasonId: "17163" },
  { slam: "US Open",         year: 2021, seasonId: "16934" },
  { slam: "Australian Open", year: 2022, seasonId: "17541" },
  { slam: "Roland Garros",   year: 2022, seasonId: "17563" },
  { slam: "Wimbledon",       year: 2022, seasonId: "17571" },
  { slam: "US Open",         year: 2022, seasonId: "17741" },
  { slam: "Roland Garros",   year: 2023, seasonId: "18844" },
  { slam: "Wimbledon",       year: 2023, seasonId: "18862" },
  { slam: "US Open",         year: 2023, seasonId: "18507" },
  { slam: "Australian Open", year: 2024, seasonId: "19359" },
  { slam: "Roland Garros",   year: 2024, seasonId: "19383" },
  { slam: "Wimbledon",       year: 2024, seasonId: "19844" },
  { slam: "US Open",         year: 2024, seasonId: "20106" },
  { slam: "Australian Open", year: 2025, seasonId: "20419" },
  { slam: "Roland Garros",   year: 2025, seasonId: "20340" },
  { slam: "Wimbledon",       year: 2025, seasonId: "20348" },
  { slam: "US Open",         year: 2025, seasonId: "20359" },
  { slam: "Australian Open", year: 2026, seasonId: "21305" },
  { slam: "Roland Garros",   year: 2026, seasonId: "21329" },
];

function inWindow(dateStr: string, year: number, start: string, end: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const lo = new Date(`${year}-${start}`);
  const hi = new Date(`${year}-${end}`);
  return d >= lo && d <= hi;
}

// All confirmed WTA IDs from Phase 2a discovery runs (empty until first run)
const PRE_SEEDED_WTA: { slam: string; year: number; seasonId: string }[] = [
  { slam: "Australian Open", year: 2020, seasonId: "13174" },
  { slam: "Roland Garros",   year: 2020, seasonId: "13039" },
  { slam: "US Open",         year: 2020, seasonId: "13059" },
  { slam: "Australian Open", year: 2021, seasonId: "13350" },
  { slam: "Roland Garros",   year: 2021, seasonId: "13388" },
  { slam: "Wimbledon",       year: 2021, seasonId: "13396" },
  { slam: "US Open",         year: 2021, seasonId: "13585" },
  { slam: "Australian Open", year: 2022, seasonId: "13835" },
  { slam: "Roland Garros",   year: 2022, seasonId: "13854" },
  { slam: "Wimbledon",       year: 2022, seasonId: "13862" },
  { slam: "US Open",         year: 2022, seasonId: "14154" },
  { slam: "Australian Open", year: 2023, seasonId: "14505" },
  { slam: "Roland Garros",   year: 2023, seasonId: "14870" },
  { slam: "Wimbledon",       year: 2023, seasonId: "14539" },
  { slam: "US Open",         year: 2023, seasonId: "14720" },
  { slam: "Australian Open", year: 2024, seasonId: "15248" },
  { slam: "Roland Garros",   year: 2024, seasonId: "15225" },
  { slam: "Wimbledon",       year: 2024, seasonId: "15233" },
  { slam: "US Open",         year: 2024, seasonId: "15244" },
  { slam: "Australian Open", year: 2025, seasonId: "15945" },
  { slam: "Roland Garros",   year: 2025, seasonId: "16252" },
  { slam: "Wimbledon",       year: 2025, seasonId: "15973" },
  { slam: "US Open",         year: 2025, seasonId: "15983" },
  { slam: "Australian Open", year: 2026, seasonId: "16709" },
  { slam: "Roland Garros",   year: 2026, seasonId: "16725" },
];

async function getAtpPlayerIds(): Promise<string[]> {
  console.log("  Fetching ATP rankings to get player IDs...\n");
  const rankings = await matchstat<Record<string, unknown>[]>("atp/ranking/singles");
  if (!Array.isArray(rankings)) return [];
  return rankings.map((row) => {
    const player = (row.player ?? {}) as Record<string, unknown>;
    return String(player.id ?? "").trim();
  }).filter(Boolean);
}

async function getWtaPlayerIds(): Promise<string[]> {
  console.log("  Fetching WTA rankings to get player IDs...\n");
  const rankings = await matchstat<Record<string, unknown>[]>("wta/ranking/singles");
  if (!Array.isArray(rankings)) return [];
  return rankings.map((row) => {
    const player = (row.player ?? {}) as Record<string, unknown>;
    return String(player.id ?? "").trim();
  }).filter(Boolean);
}

async function main() {
  console.log("\nPhase 2a — Collecting Grand Slam tournament IDs (2020–2026)\n");

  // Get player IDs from live rankings
  const atpPlayerIds = await getAtpPlayerIds();
  console.log(`  ${atpPlayerIds.length} ATP players found in rankings.\n`);

  if (atpPlayerIds.length === 0) {
    console.error("  ✗  No ATP player IDs found — check rankings endpoint.");
    process.exit(1);
  }

  const wtaPlayerIds = await getWtaPlayerIds();
  console.log(`  ${wtaPlayerIds.length} WTA players found in rankings.\n`);

  // Map: "Slam|Year" → tournamentId  (WTA keys use "WTA_Slam|Year" prefix)
  const discovered = new Map<string, string>();

  // Pre-seed known ATP IDs
  for (const { slam, year, seasonId } of PRE_SEEDED) {
    discovered.set(`${slam}|${year}`, seasonId);
    console.log(`  Pre-seeded ATP: ${slam} ${year} → tournamentId: ${seasonId}`);
  }

  // Pre-seed known WTA IDs
  for (const { slam, year, seasonId } of PRE_SEEDED_WTA) {
    discovered.set(`WTA_${slam}|${year}`, seasonId);
    console.log(`  Pre-seeded WTA: ${slam} ${year} → tournamentId: ${seasonId}`);
  }

  // Build skip set
  const skipKeys = new Set(KNOWN_MISSING.map((m) => `${m.slam}|${m.year}`));
  for (const { slam, year, reason } of KNOWN_MISSING) {
    if (!discovered.has(`${slam}|${year}`)) {
      console.log(`  Skipping: ${slam} ${year} (${reason})`);
    }
  }
  console.log();

  // ── ATP discovery loop ──────────────────────────────────────────────────────
  console.log("  ── ATP Discovery ──────────────────────────────────────────────\n");
  for (const year of YEARS) {
    const needed = new Set(
      SLAM_WINDOWS.map((w) => w.slam).filter((s) => !skipKeys.has(`${s}|${year}`))
    );
    console.log(`  ── ATP ${year} — looking for: ${[...needed].join(", ")}`);

    let playersTried = 0;
    for (const playerId of atpPlayerIds.slice(0, MAX_PLAYERS_TO_TRY)) {
      if (needed.size === 0) break;
      playersTried++;

      try {
        const raw = await matchstat(`atp/player/past-matches/${playerId}`, {
          filter: `GameYear:${year}`,
        });

        const matches: Record<string, unknown>[] = Array.isArray(raw)
          ? raw as Record<string, unknown>[]
          : [];

        for (const m of matches) {
          const dateStr = String(m.date ?? "");
          const tid     = String(m.tournamentId ?? m.tournament_id ?? "");
          if (!tid) continue;

          // Check standard windows
          for (const { slam, start, end } of SLAM_WINDOWS) {
            if (needed.has(slam) && inWindow(dateStr, year, start, end)) {
              discovered.set(`${slam}|${year}`, tid);
              needed.delete(slam);
              console.log(`    ✓ ${slam} ${year} — tournamentId: ${tid}  (via player ${playerId})`);
            }
          }

          // Check extra windows (COVID-postponed tournaments etc.)
          for (const extra of EXTRA_WINDOWS) {
            if (extra.year === year && needed.has(extra.slam) && inWindow(dateStr, year, extra.start, extra.end)) {
              discovered.set(`${extra.slam}|${year}`, tid);
              needed.delete(extra.slam);
              console.log(`    ✓ ${extra.slam} ${year} (alt window) — tournamentId: ${tid}  (via player ${playerId})`);
            }
          }
        }
      } catch {
        // Skip players that return errors
      }
    }

    if (needed.size > 0) {
      console.log(`    ⚠️  Not found after ${playersTried} players: ${[...needed].join(", ")}`);
    }
    console.log();
  }

  // ── WTA discovery loop ──────────────────────────────────────────────────────
  console.log("  ── WTA Discovery ──────────────────────────────────────────────\n");
  for (const year of YEARS) {
    const needed = new Set(
      SLAM_WINDOWS.map((w) => w.slam).filter((s) => !skipKeys.has(`WTA_${s}|${year}`))
    );
    console.log(`  ── WTA ${year} — looking for: ${[...needed].join(", ")}`);

    let playersTried = 0;
    for (const playerId of wtaPlayerIds.slice(0, MAX_PLAYERS_TO_TRY)) {
      if (needed.size === 0) break;
      playersTried++;

      try {
        const raw = await matchstat(`wta/player/past-matches/${playerId}`, {
          filter: `GameYear:${year}`,
        });

        const matches: Record<string, unknown>[] = Array.isArray(raw)
          ? raw as Record<string, unknown>[]
          : [];

        for (const m of matches) {
          const dateStr = String(m.date ?? "");
          const tid     = String(m.tournamentId ?? m.tournament_id ?? "");
          if (!tid) continue;

          // Check standard windows
          for (const { slam, start, end } of SLAM_WINDOWS) {
            if (needed.has(slam) && inWindow(dateStr, year, start, end)) {
              discovered.set(`WTA_${slam}|${year}`, tid);
              needed.delete(slam);
              console.log(`    ✓ WTA ${slam} ${year} — tournamentId: ${tid}  (via player ${playerId})`);
            }
          }

          // Check extra windows (COVID-postponed tournaments etc.)
          for (const extra of EXTRA_WINDOWS) {
            if (extra.year === year && needed.has(extra.slam) && inWindow(dateStr, year, extra.start, extra.end)) {
              discovered.set(`WTA_${extra.slam}|${year}`, tid);
              needed.delete(extra.slam);
              console.log(`    ✓ WTA ${extra.slam} ${year} (alt window) — tournamentId: ${tid}  (via player ${playerId})`);
            }
          }
        }
      } catch {
        // Skip players that return errors
      }
    }

    if (needed.size > 0) {
      console.log(`    ⚠️  Not found after ${playersTried} players: ${[...needed].join(", ")}`);
    }
    console.log();
  }

  // Stage discovery results
  await supabase.from("api_raw_staging").upsert({
    method:   "get_tournaments",
    params:   { strategy: "player_past_matches_atp_wta", version: "3" },
    response: { discovered: Object.fromEntries(discovered) },
  });

  // Print the SLAM_SEASONS block
  console.log("  ══════════════════════════════════════════════════════════════");
  console.log("  Paste this SLAM_SEASONS block into phase2b-fetch-fixtures.ts:");
  console.log("  ══════════════════════════════════════════════════════════════\n");

  const seasons: { slam: string; year: number; seasonId: string; tour: "ATP" | "WTA" }[] = [];
  for (const [key, seasonId] of discovered) {
    if (key.startsWith("WTA_")) {
      // WTA key format: "WTA_SlamName|Year"
      const withoutPrefix = key.slice(4); // remove "WTA_"
      const [slam, yearStr] = withoutPrefix.split("|");
      seasons.push({ slam, year: parseInt(yearStr), seasonId, tour: "WTA" });
    } else {
      const [slam, yearStr] = key.split("|");
      seasons.push({ slam, year: parseInt(yearStr), seasonId, tour: "ATP" });
    }
  }
  seasons.sort((a, b) => a.tour.localeCompare(b.tour) || a.year - b.year || a.slam.localeCompare(b.slam));

  console.log("const SLAM_SEASONS: { slam: string; year: number; seasonId: string; tour: \"ATP\" | \"WTA\" }[] = [");
  for (const { slam, year, seasonId, tour } of seasons) {
    console.log(`  { slam: "${slam}", year: ${year}, seasonId: "${seasonId}", tour: "${tour}" },`);
  }
  console.log("];\n");

  const atpSeasons = seasons.filter((s) => s.tour === "ATP");
  const wtaSeasons = seasons.filter((s) => s.tour === "WTA");
  const expectedPerTour = SLAM_WINDOWS.length * YEARS.length;
  console.log(`  Found ${atpSeasons.length}/${expectedPerTour} ATP Slam season IDs.`);
  console.log(`  Found ${wtaSeasons.length}/${expectedPerTour} WTA Slam season IDs.`);
  console.log(`  Total: ${seasons.length}/${expectedPerTour * 2} combined.`);

  if (atpSeasons.length < expectedPerTour || wtaSeasons.length < expectedPerTour) {
    console.log("  ⚠️  Some missing. Options:");
    console.log("     1. Increase MAX_PLAYERS_TO_TRY above 200");
    console.log("     2. Add specific player IDs for years with missing Slams");
    console.log("     3. Verify missing Slam/year combos actually occurred (Wimbledon 2020 was cancelled)\n");
  } else {
    console.log("  ✓  All ATP and WTA Slam IDs found.");
    console.log("  Next: paste the block into phase2b and run: npm run migrate:phase2b\n");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
