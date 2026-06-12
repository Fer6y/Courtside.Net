/**
 * phase2b-fetch-fixtures.ts
 *
 * Fetches the full singles draw results for every Grand Slam season (2020–2024)
 * and caches raw responses in api_raw_staging.
 *
 * BEFORE RUNNING: paste the SLAM_SEASONS block from phase2a output below.
 *
 * Key facts about this API:
 *   - Results come back as { singles: [...], doubles: [...], qualifying: [...] }
 *   - In historical data, player1 is ALWAYS the winner
 *   - Each year-edition has its own seasonId
 *
 * Safe to re-run — already-staged calls are skipped.
 *
 * Run: npm run migrate:phase2b
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Confirmed tournament IDs from discovery runs.
// 2026-06-12: 18 seasonIds corrected after they were found to point at the
// wrong events (see docs/match-data-validation-2026-06-12.md). Verified by
// scripts/probe-slam-seasonids.ts against known finals.
// Wimbledon 2020 cancelled (COVID). WTA AO 2024/2025 pending targeted probe.
// Wimbledon/USO 2026 not yet played.
const SLAM_SEASONS: { slam: string; year: number; seasonId: string; tour: "ATP" | "WTA" }[] = [
  // ── ATP ──────────────────────────────────────────────────────────────────
  { slam: "Australian Open", year: 2020, seasonId: "16435", tour: "ATP" },
  { slam: "Roland Garros",   year: 2020, seasonId: "16462", tour: "ATP" },
  { slam: "US Open",         year: 2020, seasonId: "16485", tour: "ATP" },
  { slam: "Australian Open", year: 2021, seasonId: "16881", tour: "ATP" },
  { slam: "Roland Garros",   year: 2021, seasonId: "16911", tour: "ATP" },
  { slam: "Wimbledon",       year: 2021, seasonId: "16919", tour: "ATP" },
  { slam: "US Open",         year: 2021, seasonId: "16934", tour: "ATP" },
  { slam: "Australian Open", year: 2022, seasonId: "17535", tour: "ATP" },
  { slam: "Roland Garros",   year: 2022, seasonId: "17563", tour: "ATP" },
  { slam: "Wimbledon",       year: 2022, seasonId: "17571", tour: "ATP" },
  { slam: "US Open",         year: 2022, seasonId: "17741", tour: "ATP" },
  { slam: "Australian Open", year: 2023, seasonId: "18405", tour: "ATP" },
  { slam: "Roland Garros",   year: 2023, seasonId: "18432", tour: "ATP" },
  { slam: "Wimbledon",       year: 2023, seasonId: "18440", tour: "ATP" },
  { slam: "US Open",         year: 2023, seasonId: "18507", tour: "ATP" },
  { slam: "Australian Open", year: 2024, seasonId: "19355", tour: "ATP" },
  { slam: "Roland Garros",   year: 2024, seasonId: "19383", tour: "ATP" },
  { slam: "Wimbledon",       year: 2024, seasonId: "19391", tour: "ATP" },
  { slam: "US Open",         year: 2024, seasonId: "19405", tour: "ATP" },
  { slam: "Australian Open", year: 2025, seasonId: "20315", tour: "ATP" },
  { slam: "Roland Garros",   year: 2025, seasonId: "20340", tour: "ATP" },
  { slam: "Wimbledon",       year: 2025, seasonId: "20348", tour: "ATP" },
  { slam: "US Open",         year: 2025, seasonId: "20359", tour: "ATP" },
  { slam: "Australian Open", year: 2026, seasonId: "21305", tour: "ATP" },
  { slam: "Roland Garros",   year: 2026, seasonId: "21329", tour: "ATP" },
  // ── WTA ──────────────────────────────────────────────────────────────────
  { slam: "Australian Open", year: 2020, seasonId: "13017", tour: "WTA" },
  { slam: "Roland Garros",   year: 2020, seasonId: "13039", tour: "WTA" },
  { slam: "US Open",         year: 2020, seasonId: "13059", tour: "WTA" },
  { slam: "Australian Open", year: 2021, seasonId: "13350", tour: "WTA" },
  { slam: "Roland Garros",   year: 2021, seasonId: "13388", tour: "WTA" },
  { slam: "Wimbledon",       year: 2021, seasonId: "13396", tour: "WTA" },
  { slam: "US Open",         year: 2021, seasonId: "13585", tour: "WTA" },
  { slam: "Australian Open", year: 2022, seasonId: "13835", tour: "WTA" },
  { slam: "Roland Garros",   year: 2022, seasonId: "13854", tour: "WTA" },
  { slam: "Wimbledon",       year: 2022, seasonId: "13862", tour: "WTA" },
  { slam: "US Open",         year: 2022, seasonId: "14154", tour: "WTA" },
  { slam: "Australian Open", year: 2023, seasonId: "14505", tour: "WTA" },
  { slam: "Roland Garros",   year: 2023, seasonId: "14528", tour: "WTA" },
  { slam: "Wimbledon",       year: 2023, seasonId: "14539", tour: "WTA" },
  { slam: "US Open",         year: 2023, seasonId: "14720", tour: "WTA" },
  { slam: "Australian Open", year: 2024, seasonId: "15206", tour: "WTA" },
  { slam: "Roland Garros",   year: 2024, seasonId: "15225", tour: "WTA" },
  { slam: "Wimbledon",       year: 2024, seasonId: "15233", tour: "WTA" },
  { slam: "US Open",         year: 2024, seasonId: "15244", tour: "WTA" },
  { slam: "Australian Open", year: 2025, seasonId: "15945", tour: "WTA" },
  { slam: "Roland Garros",   year: 2025, seasonId: "15965", tour: "WTA" },
  { slam: "Wimbledon",       year: 2025, seasonId: "15973", tour: "WTA" },
  { slam: "US Open",         year: 2025, seasonId: "15983", tour: "WTA" },
  { slam: "Australian Open", year: 2026, seasonId: "16705", tour: "WTA" },
  { slam: "Roland Garros",   year: 2026, seasonId: "16725", tour: "WTA" },
];

async function main() {
  if (SLAM_SEASONS.length === 0) {
    console.error("\n✗  SLAM_SEASONS is empty.");
    console.error("   Run phase2a first, then paste its output into SLAM_SEASONS above.\n");
    process.exit(1);
  }

  console.log(`\nPhase 2b — Fetching ${SLAM_SEASONS.length} tournament draws\n`);

  let done = 0;
  let skipped = 0;

  for (const { slam, year, seasonId, tour } of SLAM_SEASONS) {
    // Skip if already staged
    const { data: existing } = await supabase
      .from("api_raw_staging")
      .select("id")
      .eq("method", "get_fixtures")
      .contains("params", { seasonId, tour })
      .maybeSingle();

    if (existing) {
      console.log(`  [${++done}/${SLAM_SEASONS.length}]  SKIP: ${slam} ${year} ${tour}`);
      skipped++;
      continue;
    }

    try {
      const path = `${tour.toLowerCase()}/tournament/results/${seasonId}`;
      const result = await matchstat<Record<string, unknown>>(path);

      // Singles draw is nested under result.singles
      const singles: unknown[] = (result.singles ?? result.data?.singles ?? []) as unknown[];

      // Store only the singles array (not full raw) to keep row size manageable
      const { error: insertErr } = await supabase.from("api_raw_staging").insert({
        method:   "get_fixtures",
        params:   { seasonId, tour, slam_name: slam, year: String(year) },
        response: { singles },
      });
      if (insertErr) throw new Error(`Supabase insert failed: ${insertErr.message}`);

      const warn = singles.length === 0 ? " ⚠️  zero matches" : "";
      console.log(`  [${++done}/${SLAM_SEASONS.length}]  ${slam} ${year} ${tour} — ${singles.length} singles matches${warn}`);
    } catch (err) {
      console.error(`  [${++done}/${SLAM_SEASONS.length}]  ERROR: ${slam} ${year} ${tour} — ${(err as Error).message}`);
    }
  }

  console.log(`\n  ✓  Done. ${done - skipped} fetched, ${skipped} skipped.`);
  console.log("  Next: npm run migrate:phase2c\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
