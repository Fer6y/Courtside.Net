/**
 * probe-ao-ids.ts
 *
 * Targeted search for Australian Open season IDs.
 *
 * WHY AO IS HARD TO FIND:
 *   AO is played in January — the first slam of the year. For active players
 *   who play 30+ matches a year, AO is always pushed off the "10 most recent"
 *   list returned by the GameYear filter. We need players who played only a
 *   FEW matches in a given year (e.g. injured after AO) so AO stays visible.
 *
 * STRATEGY:
 *   Use all player IDs from our DB (not just top 101 ranked). Lower-ranked
 *   players or those who had injury-shortened seasons are more likely to have
 *   AO in their 10 most recent. We stop each year as soon as AO is found.
 *
 * Run: npx tsx scripts/probe-ao-ids.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ATP AO gaps — all found. Set to empty unless new gaps appear.
const MISSING_AO_YEARS: number[] = [];

// WTA AO gaps
const MISSING_WTA_AO_YEARS = [2024, 2025];

// AO date window: second week of January to first week of February
function isAoDate(dateStr: string, year: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const lo = new Date(`${year}-01-06`);
  const hi = new Date(`${year}-02-05`);
  return d >= lo && d <= hi;
}

// Wimbledon date window: last week of June to third week of July
function isWimbledonDate(dateStr: string, year: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const lo = new Date(`${year}-06-23`);
  const hi = new Date(`${year}-07-17`);
  return d >= lo && d <= hi;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("\nProbing for Australian Open season IDs\n");

  // Load all player API keys from our DB — split by tour
  const { data: dbPlayers } = await supabase
    .from("players")
    .select("api_player_key, name, career_stats")
    .not("api_player_key", "is", null);

  if (!dbPlayers || dbPlayers.length === 0) {
    console.error("No players found in DB.");
    process.exit(1);
  }

  const atpPlayerIds = [...new Set(
    dbPlayers
      .filter((p) => (p.career_stats as Record<string, unknown>)?.tour !== "WTA")
      .map((p) => String(p.api_player_key))
  )];
  const wtaPlayerIds = [...new Set(
    dbPlayers
      .filter((p) => (p.career_stats as Record<string, unknown>)?.tour === "WTA")
      .map((p) => String(p.api_player_key))
  )];

  // For backward compat, keep playerIds as ATP pool
  const playerIds = atpPlayerIds;
  console.log(`  ${atpPlayerIds.length} ATP + ${wtaPlayerIds.length} WTA player IDs loaded from DB.\n`);

  // { key: "AO|year" or "Wimbledon|year" } → seasonId
  const found: Record<string, string> = {};
  const MISSING_WIMBLEDON_YEARS = [2024];

  // Search for AO
  for (const year of MISSING_AO_YEARS) {
    console.log(`  ── Searching AO ${year} ──`);
    let tried = 0;
    const key = `AO|${year}`;

    for (const playerId of playerIds) {
      if (found[key]) break;
      tried++;

      try {
        const raw = await matchstat<unknown[]>(
          `atp/player/past-matches/${playerId}`,
          { filter: `GameYear:${year}` }
        );
        const matches = Array.isArray(raw) ? raw as Record<string, unknown>[] : [];
        for (const m of matches) {
          const dateStr = String(m.date ?? "");
          const tid = String(m.tournamentId ?? m.tournament_id ?? "");
          if (tid && isAoDate(dateStr, year)) {
            found[key] = tid;
            const name = dbPlayers.find((p) => String(p.api_player_key) === playerId)?.name ?? playerId;
            console.log(`    ✓ AO ${year} — seasonId: ${tid}  (via ${name})`);
            break;
          }
        }
      } catch { /* skip */ }

      await sleep(1200);
    }

    if (!found[key]) console.log(`    ✗ Not found after ${tried} players`);
    console.log();
  }

  // Search for missing Wimbledon years
  for (const year of MISSING_WIMBLEDON_YEARS) {
    console.log(`  ── Searching Wimbledon ${year} ──`);
    let tried = 0;
    const key = `Wimbledon|${year}`;

    for (const playerId of playerIds) {
      if (found[key]) break;
      tried++;

      try {
        const raw = await matchstat<unknown[]>(
          `atp/player/past-matches/${playerId}`,
          { filter: `GameYear:${year}` }
        );
        const matches = Array.isArray(raw) ? raw as Record<string, unknown>[] : [];
        for (const m of matches) {
          const dateStr = String(m.date ?? "");
          const tid = String(m.tournamentId ?? m.tournament_id ?? "");
          if (tid && isWimbledonDate(dateStr, year)) {
            found[key] = tid;
            const name = dbPlayers.find((p) => String(p.api_player_key) === playerId)?.name ?? playerId;
            console.log(`    ✓ Wimbledon ${year} — seasonId: ${tid}  (via ${name})`);
            break;
          }
        }
      } catch { /* skip */ }

      await sleep(1200);
    }

    if (!found[key]) console.log(`    ✗ Not found after ${tried} players`);
    console.log();
  }

  // Search for WTA AO missing years
  for (const year of MISSING_WTA_AO_YEARS) {
    console.log(`  ── Searching WTA AO ${year} ──`);
    let tried = 0;
    const key = `WTA_AO|${year}`;

    for (const playerId of wtaPlayerIds) {
      if (found[key]) break;
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
          if (tid && isAoDate(dateStr, year)) {
            found[key] = tid;
            const name = dbPlayers.find((p) => String(p.api_player_key) === playerId)?.name ?? playerId;
            console.log(`    ✓ WTA AO ${year} — seasonId: ${tid}  (via ${name})`);
            break;
          }
        }
      } catch { /* skip */ }

      await sleep(1200);
    }

    if (!found[key]) console.log(`    ✗ Not found after ${tried} players`);
    console.log();
  }

  console.log("\n  ══════════════════════════════════════");
  console.log("  Results — add these to phase2b SLAM_SEASONS:");
  console.log("  ══════════════════════════════════════\n");
  for (const [key, id] of Object.entries(found)) {
    const isWta = key.startsWith("WTA_");
    const cleanKey = isWta ? key.slice(4) : key;
    const [slam, year] = cleanKey.split("|");
    const slamName = slam === "AO" ? "Australian Open" : slam;
    const tour = isWta ? "WTA" : "ATP";
    console.log(`  { slam: "${slamName}", year: ${year}, seasonId: "${id}", tour: "${tour}" },`);
  }
}

main().catch(console.error);
