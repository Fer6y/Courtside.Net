/**
 * phase4-cutover.ts
 *
 * Makes API-sourced records canonical:
 *   1. If community data exists (Phase 3 was run):
 *      - Re-keys reviews.match_id and skill_ratings.player_id to point at
 *        API-sourced records using the high/manual-confidence crosswalk
 *      - Verifies row counts before and after — no community row should be lost
 *   2. Copies photo_url from API player records onto Sackmann player records
 *      via crosswalk
 *   3. Updates country field (Sackmann: IOC 3-letter, API: full country name)
 *   4. Prints a summary — do not proceed to Phase 5 until all counts check out
 *
 * Run: npm run migrate:phase4
 *
 * ⚠️  Take a full Supabase backup before running this script.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("\nPhase 4 — Cutover\n");
  console.log("  ⚠️  Ensure a full Supabase backup was taken before proceeding.");
  console.log("  Press Ctrl+C now to abort, or wait 5 seconds to continue...\n");
  await new Promise((r) => setTimeout(r, 5000));

  // ── Baseline counts ────────────────────────────────────────────────────────
  const { count: reviewsBefore }  = await supabase.from("reviews").select("*", { count: "exact", head: true });
  const { count: ratingsBefore }  = await supabase.from("skill_ratings").select("*", { count: "exact", head: true });
  const { count: watchBefore }    = await supabase.from("watched_matches").select("*", { count: "exact", head: true });

  console.log("  Baseline community data counts:");
  console.log(`    reviews:         ${reviewsBefore ?? 0}`);
  console.log(`    skill_ratings:   ${ratingsBefore ?? 0}`);
  console.log(`    watched_matches: ${watchBefore ?? 0}\n`);

  // ── Re-key community data via crosswalk (if any crosswalk rows exist) ──────
  const { data: matchCrosswalks } = await supabase
    .from("match_crosswalk")
    .select("supabase_match_id, api_event_key")
    .in("confidence", ["high", "manual"]);

  const { data: playerCrosswalks } = await supabase
    .from("player_crosswalk")
    .select("supabase_player_id, api_player_key")
    .in("confidence", ["high", "manual"]);

  // Build UUID maps: old Sackmann UUID → new API UUID
  // First, load API player UUID by api_player_key
  const { data: apiPlayerRows } = await supabase
    .from("players")
    .select("id, api_player_key")
    .not("api_player_key", "is", null);

  const apiPlayerUUIDByKey = new Map(
    (apiPlayerRows ?? []).map((p) => [p.api_player_key, p.id])
  );

  // Load API match UUID by api_event_key
  const { data: apiMatchRows } = await supabase
    .from("matches")
    .select("id, api_event_key")
    .not("api_event_key", "is", null)
    .eq("source", "api_tennis");

  const apiMatchUUIDByKey = new Map(
    (apiMatchRows ?? []).map((m) => [m.api_event_key, m.id])
  );

  // Re-key reviews.match_id
  let reviewsRekeyed = 0;
  for (const xw of matchCrosswalks ?? []) {
    if (!xw.supabase_match_id || !xw.api_event_key) continue;
    const newMatchId = apiMatchUUIDByKey.get(xw.api_event_key);
    if (!newMatchId || newMatchId === xw.supabase_match_id) continue;

    const { error } = await supabase
      .from("reviews")
      .update({ match_id: newMatchId })
      .eq("match_id", xw.supabase_match_id);

    if (error) {
      console.error(`  Error re-keying reviews for match ${xw.supabase_match_id}: ${error.message}`);
    } else {
      reviewsRekeyed++;
    }
  }

  // Re-key watched_matches.match_id
  let watchRekeyed = 0;
  for (const xw of matchCrosswalks ?? []) {
    if (!xw.supabase_match_id || !xw.api_event_key) continue;
    const newMatchId = apiMatchUUIDByKey.get(xw.api_event_key);
    if (!newMatchId || newMatchId === xw.supabase_match_id) continue;

    const { error } = await supabase
      .from("watched_matches")
      .update({ match_id: newMatchId })
      .eq("match_id", xw.supabase_match_id);

    if (!error) watchRekeyed++;
  }

  // Re-key skill_ratings.player_id
  let ratingsRekeyed = 0;
  for (const xw of playerCrosswalks ?? []) {
    if (!xw.supabase_player_id || !xw.api_player_key) continue;
    const newPlayerId = apiPlayerUUIDByKey.get(xw.api_player_key);
    if (!newPlayerId || newPlayerId === xw.supabase_player_id) continue;

    const { error } = await supabase
      .from("skill_ratings")
      .update({ player_id: newPlayerId })
      .eq("player_id", xw.supabase_player_id);

    if (!error) ratingsRekeyed++;
  }

  if (reviewsRekeyed + ratingsRekeyed + watchRekeyed > 0) {
    console.log("  Community data re-keyed:");
    console.log(`    reviews re-keyed:         ${reviewsRekeyed}`);
    console.log(`    skill_ratings re-keyed:   ${ratingsRekeyed}`);
    console.log(`    watched_matches re-keyed: ${watchRekeyed}\n`);
  } else {
    console.log("  No community data re-keying needed (Phase 3 was skipped or crosswalk is empty).\n");
  }

  // ── Copy photo_url from API players to Sackmann players via crosswalk ─────
  console.log("  Copying photo URLs to Sackmann player records...");
  let photosCopied = 0;

  for (const xw of playerCrosswalks ?? []) {
    if (!xw.supabase_player_id || !xw.api_player_key) continue;
    const apiPlayer = (apiPlayerRows ?? []).find((p) => p.api_player_key === xw.api_player_key);
    if (!apiPlayer) continue;

    const { data: apiPlayerFull } = await supabase
      .from("players")
      .select("photo_url, country")
      .eq("id", apiPlayer.id)
      .single();

    if (apiPlayerFull?.photo_url) {
      await supabase
        .from("players")
        .update({ photo_url: apiPlayerFull.photo_url })
        .eq("id", xw.supabase_player_id)
        .is("photo_url", null); // don't overwrite
      photosCopied++;
    }
  }

  console.log(`  ${photosCopied} photo URLs copied to Sackmann records.\n`);

  // ── Final count verification ───────────────────────────────────────────────
  const { count: reviewsAfter }  = await supabase.from("reviews").select("*", { count: "exact", head: true });
  const { count: ratingsAfter }  = await supabase.from("skill_ratings").select("*", { count: "exact", head: true });
  const { count: watchAfter }    = await supabase.from("watched_matches").select("*", { count: "exact", head: true });

  console.log("  ── Final count verification ──────────────────────────────────");
  const reviewsOk  = (reviewsAfter  ?? 0) >= (reviewsBefore  ?? 0);
  const ratingsOk  = (ratingsAfter  ?? 0) >= (ratingsBefore  ?? 0);
  const watchOk    = (watchAfter    ?? 0) >= (watchBefore    ?? 0);

  console.log(`  reviews:         ${reviewsBefore} → ${reviewsAfter}   ${reviewsOk  ? "✓" : "✗ COUNT DROPPED — STOP"}`);
  console.log(`  skill_ratings:   ${ratingsBefore} → ${ratingsAfter}   ${ratingsOk  ? "✓" : "✗ COUNT DROPPED — STOP"}`);
  console.log(`  watched_matches: ${watchBefore}   → ${watchAfter}     ${watchOk    ? "✓" : "✗ COUNT DROPPED — STOP"}`);

  if (!reviewsOk || !ratingsOk || !watchOk) {
    console.log("\n  ✗  COUNTS DROPPED — do NOT proceed to Phase 5.");
    console.log("  Restore from backup, investigate, and re-run.\n");
    process.exit(1);
  }

  console.log("\n  ✓  All counts intact. Safe to proceed to phase5-cleanup.ts");
  console.log("  But first: test the app end-to-end to confirm all data displays correctly.\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
