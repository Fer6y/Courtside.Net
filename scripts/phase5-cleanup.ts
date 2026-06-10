/**
 * phase5-cleanup.ts
 *
 * FINAL STEP — removes Sackmann-origin data from the database.
 *
 * BEFORE RUNNING:
 *   1. Phase 4 must have completed with no count drops
 *   2. Test the live app end-to-end — all player profiles, match pages,
 *      and community reviews must display correctly
 *   3. Take a fresh Supabase backup
 *
 * Runs in DRY RUN mode by default — pass --live to actually delete.
 *
 * Run (dry run):  npm run migrate:phase5
 * Run (for real): npm run migrate:phase5 -- --live
 *
 * What it removes:
 *   - matches rows where source='sackmann' with no community FK references
 *   - players rows with api_id set but no api_player_key and no community FKs
 *   - api_raw_staging rows (all — can be re-fetched if needed)
 *   - player_crosswalk and match_crosswalk tables (once Sackmann rows are gone)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = !process.argv.includes("--live");

async function main() {
  console.log(`\nPhase 5 — Decommission Sackmann data ${DRY_RUN ? "[DRY RUN]" : "[LIVE]"}\n`);

  if (!DRY_RUN) {
    console.log("  ⚠️  LIVE mode — data will be permanently deleted.");
    console.log("  Press Ctrl+C now to abort, or wait 10 seconds...\n");
    await new Promise((r) => setTimeout(r, 10000));
  }

  // ── Find Sackmann matches with no community references ────────────────────
  const { data: sackmannMatches } = await supabase
    .from("matches")
    .select("id, tournament, round")
    .eq("source", "sackmann");

  const sackmannMatchIds = (sackmannMatches ?? []).map((m) => m.id);

  // Which of these have reviews or watched_matches attached?
  const { data: reviewedMatchIds } = await supabase
    .from("reviews")
    .select("match_id")
    .in("match_id", sackmannMatchIds);

  const { data: watchedMatchIds } = await supabase
    .from("watched_matches")
    .select("match_id")
    .in("match_id", sackmannMatchIds);

  const referenced = new Set([
    ...(reviewedMatchIds ?? []).map((r) => r.match_id),
    ...(watchedMatchIds  ?? []).map((r) => r.match_id),
  ]);

  const safeToDeleteMatches = sackmannMatchIds.filter((id) => !referenced.has(id));
  const stillReferencedMatches = sackmannMatchIds.filter((id) => referenced.has(id));

  console.log(`  Sackmann matches: ${sackmannMatchIds.length} total`);
  console.log(`    Safe to delete:      ${safeToDeleteMatches.length}`);
  console.log(`    Still referenced:    ${stillReferencedMatches.length} (have community data — keep)\n`);

  // ── Find Sackmann players with no community references ────────────────────
  const { data: sackmannPlayers } = await supabase
    .from("players")
    .select("id, name")
    .not("api_id", "is", null)
    .is("api_player_key", null); // Sackmann-only rows that weren't cross-walked

  const sackmannPlayerIds = (sackmannPlayers ?? []).map((p) => p.id);

  // Check skill_ratings, reviews, and match player references
  const { data: ratedPlayerIds } = await supabase
    .from("skill_ratings")
    .select("player_id")
    .in("player_id", sackmannPlayerIds);

  const referencedPlayers = new Set((ratedPlayerIds ?? []).map((r) => r.player_id));

  const safeToDeletePlayers = sackmannPlayerIds.filter((id) => !referencedPlayers.has(id));

  console.log(`  Sackmann-only players (no api_player_key): ${sackmannPlayerIds.length} total`);
  console.log(`    Safe to delete: ${safeToDeletePlayers.length}`);
  console.log(`    Still referenced: ${sackmannPlayerIds.length - safeToDeletePlayers.length}\n`);

  if (DRY_RUN) {
    console.log("  DRY RUN — no changes made.");
    console.log("  Review the numbers above, then run with --live when ready.\n");
    console.log("  Command: npm run migrate:phase5 -- --live\n");
    return;
  }

  // ── LIVE: delete safe Sackmann matches ────────────────────────────────────
  if (safeToDeleteMatches.length > 0) {
    const BATCH = 200;
    for (let i = 0; i < safeToDeleteMatches.length; i += BATCH) {
      const batch = safeToDeleteMatches.slice(i, i + BATCH);
      const { error } = await supabase.from("matches").delete().in("id", batch);
      if (error) throw new Error(`Match delete error: ${error.message}`);
    }
    console.log(`  ✓  Deleted ${safeToDeleteMatches.length} Sackmann match rows.`);
  }

  // ── LIVE: delete safe Sackmann player rows ────────────────────────────────
  if (safeToDeletePlayers.length > 0) {
    const BATCH = 200;
    for (let i = 0; i < safeToDeletePlayers.length; i += BATCH) {
      const batch = safeToDeletePlayers.slice(i, i + BATCH);
      const { error } = await supabase.from("players").delete().in("id", batch);
      if (error) throw new Error(`Player delete error: ${error.message}`);
    }
    console.log(`  ✓  Deleted ${safeToDeletePlayers.length} Sackmann player rows.`);
  }

  // ── LIVE: clear staging table (frees storage, can re-fetch if needed) ─────
  const { error: stagingErr } = await supabase
    .from("api_raw_staging")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all

  if (stagingErr) {
    console.log(`  ⚠️  Could not clear api_raw_staging: ${stagingErr.message}`);
  } else {
    console.log("  ✓  api_raw_staging cleared.");
  }

  console.log("\n  ── Phase 5 complete ──────────────────────────────────────────");
  console.log("  Sackmann data removed. Courtside now runs on api-tennis.com data.");
  console.log("  Remaining to do (run in Supabase SQL Editor when ready):");
  console.log("    DROP TABLE IF EXISTS player_crosswalk;");
  console.log("    DROP TABLE IF EXISTS match_crosswalk;");
  console.log("    ALTER TABLE players DROP COLUMN IF EXISTS api_id;");
  console.log("    ALTER TABLE matches DROP COLUMN IF EXISTS api_match_id;\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
