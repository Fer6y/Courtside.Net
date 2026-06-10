/**
 * phase2e-fetch-standings.ts
 *
 * Fetches current ATP + WTA singles rankings from MatchStat and updates
 * current_rank on player records that have a matching api_player_key.
 *
 * Safe to re-run at any point — just overwrites current_rank.
 *
 * Run: npm run migrate:phase2e
 *
 * ⚠️  FIELD MAP — verify against Phase 0 ranking sample, then update:
 *   id_field   — the player ID field in a ranking row (must match api_player_key)
 *   rank_field — the rank integer field (e.g. "rank" or "position")
 *   name_field — player name (for logging only)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Confirmed from Phase 0 output. Ranking row structure:
// { id, date, point, position, rankingPoints, player: { id, name, countryAcr, country: { name, acronym } } }
// player ID and name are nested inside the `player` object.
const FIELD_MAP = {
  rank: "position",  // top-level integer rank
  // player fields are nested — extracted manually below
};

async function updateRankings(tour: "ATP" | "WTA") {
  console.log(`  Fetching ${tour} rankings...`);

  const rankings = await matchstat<Record<string, unknown>[]>(`${tour.toLowerCase()}/ranking/singles`);

  if (!Array.isArray(rankings) || rankings.length === 0) {
    console.log(`  ⚠️  No rankings returned for ${tour}`);
    return;
  }

  // Stage raw response
  await supabase.from("api_raw_staging").insert({
    method:   "get_standings",
    params:   { tour },
    response: { data: rankings },
  });

  console.log(`  ${rankings.length} ${tour} players in rankings.`);

  let updated = 0;
  let notFound = 0;

  for (const row of rankings) {
    // player ID is nested: row.player.id
    const playerObj = (row.player ?? {}) as Record<string, unknown>;
    const playerId  = String(playerObj.id ?? "").trim();
    const rank      = parseInt(String(row[FIELD_MAP.rank] ?? "0")) || null;

    if (!playerId || !rank) continue;

    const { data } = await supabase
      .from("players")
      .update({ current_rank: rank })
      .eq("api_player_key", playerId)
      .select("id")
      .single();

    if (data) updated++; else notFound++;
  }

  console.log(`  ${updated} ranks updated, ${notFound} not found in DB.`);
}

async function main() {
  console.log("\nPhase 2e — Updating player rankings\n");

  await updateRankings("ATP");
  await updateRankings("WTA");

  console.log("\n  ✓  Rankings updated.");
  console.log("\n  ── Phase 2 complete ──────────────────────────────────────────");
  console.log("  Decide whether Phase 3 (crosswalk) is needed:");
  console.log("  → No community data yet?  Skip to: npm run migrate:phase4");
  console.log("  → Community data exists?   Run:     npm run migrate:phase3\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
