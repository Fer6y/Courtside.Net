/**
 * probe-wta-ids.ts
 *
 * Discovers WTA Grand Slam season IDs by cycling through WTA-ranked players
 * and checking their past-matches for each slam/year combination.
 *
 * Stops each slam/year as soon as one player confirms it — no wasted calls.
 * Outputs a SLAM_SEASONS block to paste into phase2b-fetch-fixtures.ts.
 *
 * Run: npx tsx scripts/probe-wta-ids.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { matchstat } from "../lib/matchstat";

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

// Wimbledon 2020 was cancelled for both tours
const SKIP = new Set(["Wimbledon|2020"]);

const SLAM_WINDOWS = [
  { slam: "Australian Open", start: "01-10", end: "02-08" },
  { slam: "Roland Garros",   start: "05-18", end: "06-14" },
  { slam: "Wimbledon",       start: "06-24", end: "07-17" },
  { slam: "US Open",         start: "08-22", end: "09-14" },
];

// Roland Garros 2020 was postponed (COVID) — wider window
const EXTRA_WINDOWS = [
  { slam: "Roland Garros", year: 2020, start: "09-25", end: "10-12" },
];

function inWindow(dateStr: string, year: number, start: string, end: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d >= new Date(`${year}-${start}`) && d <= new Date(`${year}-${end}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("\nProbing for WTA Grand Slam season IDs\n");

  // Fetch WTA player IDs from live rankings
  console.log("  Fetching WTA rankings...");
  const rankings = await matchstat<Record<string, unknown>[]>("wta/ranking/singles");
  const playerIds = (Array.isArray(rankings) ? rankings : [])
    .map((r) => String((r.player as Record<string, unknown>)?.id ?? "").trim())
    .filter(Boolean);

  console.log(`  ${playerIds.length} WTA players found.\n`);
  if (playerIds.length === 0) { console.error("No WTA players found."); process.exit(1); }

  const found = new Map<string, string>(); // "Slam|Year" → seasonId

  for (const year of YEARS) {
    const needed = new Set(
      SLAM_WINDOWS.map((w) => w.slam).filter((s) => !SKIP.has(`${s}|${year}`))
    );

    console.log(`  ── WTA ${year} — looking for: ${[...needed].join(", ")}`);
    let tried = 0;

    for (const playerId of playerIds) {
      if (needed.size === 0) break;
      tried++;

      try {
        const raw = await matchstat<unknown[]>(
          `wta/player/past-matches/${playerId}`,
          { filter: `GameYear:${year}` }
        );
        const matches = Array.isArray(raw) ? raw as Record<string, unknown>[] : [];

        for (const m of matches) {
          const dateStr = String(m.date ?? "");
          const tid = String(m.tournamentId ?? m.tournament_id ?? "");
          if (!tid) continue;

          for (const { slam, start, end } of SLAM_WINDOWS) {
            if (needed.has(slam) && inWindow(dateStr, year, start, end)) {
              found.set(`${slam}|${year}`, tid);
              needed.delete(slam);
              console.log(`    ✓ ${slam} ${year} — seasonId: ${tid}`);
            }
          }
          for (const extra of EXTRA_WINDOWS) {
            if (extra.year === year && needed.has(extra.slam) && inWindow(dateStr, year, extra.start, extra.end)) {
              found.set(`${extra.slam}|${year}`, tid);
              needed.delete(extra.slam);
              console.log(`    ✓ ${extra.slam} ${year} (alt window) — seasonId: ${tid}`);
            }
          }
        }
      } catch { /* skip */ }

      await sleep(1200);
    }

    if (needed.size > 0) {
      console.log(`    ⚠️  Not found after ${tried} players: ${[...needed].join(", ")}`);
    }
    console.log();
  }

  // Print SLAM_SEASONS block
  console.log("  ══════════════════════════════════════════════════════════════");
  console.log("  Add these WTA entries to SLAM_SEASONS in phase2b:");
  console.log("  ══════════════════════════════════════════════════════════════\n");

  const entries = [...found.entries()]
    .map(([key, id]) => {
      const [slam, year] = key.split("|");
      return { slam, year: parseInt(year), seasonId: id };
    })
    .sort((a, b) => a.year - b.year || a.slam.localeCompare(b.slam));

  for (const { slam, year, seasonId } of entries) {
    console.log(`  { slam: "${slam}", year: ${year}, seasonId: "${seasonId}", tour: "WTA" },`);
  }

  console.log(`\n  Found ${found.size} WTA season IDs.`);
  if (found.size < (SLAM_WINDOWS.length * YEARS.length) - 1) { // -1 for Wimbledon 2020
    console.log("  Tip: run probe-ao-ids.ts targeting WTA if AO years are still missing.");
  }
}

main().catch(console.error);
