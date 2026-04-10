/**
 * merge-duplicate-players.ts
 *
 * Finds players with the same name in the database, reports them,
 * and optionally merges their match records into a single canonical row.
 *
 * Usage:
 *   npm run merge:players           ← dry run (safe, no changes)
 *   npm run merge:players -- --run  ← actually merge and delete duplicates
 *
 * What it does:
 *  1. Groups all players by normalised name (lowercase, trimmed)
 *  2. For each group of 2+, counts how many matches each UUID is linked to
 *  3. Picks the "canonical" player: highest match count wins, ties broken by rank
 *  4. Updates all match rows (player1_id, player2_id, winner_id) to use the canonical UUID
 *  5. Deletes the now-orphaned duplicate player rows
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DRY_RUN = !process.argv.includes("--run");

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(DRY_RUN ? "── DRY RUN (pass --run to apply changes) ──\n" : "── LIVE RUN ──\n");

  // ── 1. Fetch every player ────────────────────────────────────────────────────
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, name, current_rank, api_id, career_stats");

  if (pErr || !players) {
    console.error("Failed to fetch players:", pErr?.message);
    process.exit(1);
  }

  console.log(`Fetched ${players.length} total player rows.\n`);

  // ── 2. Group by normalised name ──────────────────────────────────────────────
  const groups = new Map<string, typeof players>();
  for (const p of players) {
    const key = p.name.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const dupeGroups = [...groups.values()].filter((g) => g.length > 1);

  if (dupeGroups.length === 0) {
    console.log("✓ No duplicate player names found. Database is clean.");
    return;
  }

  console.log(`Found ${dupeGroups.length} name collision(s):\n`);

  // ── 3. Fetch match counts for every player ID involved ───────────────────────
  const dupeIds = dupeGroups.flat().map((p) => p.id);

  // Count matches where player appears as player1, player2, or winner
  const matchCountMap = new Map<string, number>();
  for (const id of dupeIds) matchCountMap.set(id, 0);

  const { data: matchRows, error: mErr } = await supabase
    .from("matches")
    .select("id, player1_id, player2_id, winner_id")
    .or(dupeIds.map((id) => `player1_id.eq.${id},player2_id.eq.${id}`).join(","));

  if (mErr) {
    console.error("Failed to fetch matches:", mErr.message);
    process.exit(1);
  }

  for (const m of matchRows ?? []) {
    if (matchCountMap.has(m.player1_id)) matchCountMap.set(m.player1_id, (matchCountMap.get(m.player1_id) ?? 0) + 1);
    if (matchCountMap.has(m.player2_id)) matchCountMap.set(m.player2_id, (matchCountMap.get(m.player2_id) ?? 0) + 1);
  }

  // ── 4. Process each duplicate group ─────────────────────────────────────────
  let totalMerged = 0;
  let totalDeleted = 0;

  for (const group of dupeGroups) {
    // Sort: most matches first, then best rank (lowest number) as tiebreak
    const sorted = [...group].sort((a, b) => {
      const matchDiff = (matchCountMap.get(b.id) ?? 0) - (matchCountMap.get(a.id) ?? 0);
      if (matchDiff !== 0) return matchDiff;
      const rankA = a.current_rank ?? 9999;
      const rankB = b.current_rank ?? 9999;
      return rankA - rankB;
    });

    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    console.log(`Player: "${canonical.name}"`);
    console.log(`  Keep:   ${canonical.id} | ${matchCountMap.get(canonical.id) ?? 0} matches | rank ${canonical.current_rank ?? "—"} | tour ${canonical.career_stats?.tour ?? "—"} | api_id: ${canonical.api_id}`);
    for (const d of duplicates) {
      console.log(`  Merge:  ${d.id} | ${matchCountMap.get(d.id) ?? 0} matches | rank ${d.current_rank ?? "—"} | tour ${d.career_stats?.tour ?? "—"} | api_id: ${d.api_id}`);
    }

    if (!DRY_RUN) {
      for (const dupe of duplicates) {
        const dupeId = dupe.id;
        const canonId = canonical.id;

        // Get all matches for this duplicate
        const { data: dupeMatches } = await supabase
          .from("matches")
          .select("id, player1_id, player2_id, winner_id")
          .or(`player1_id.eq.${dupeId},player2_id.eq.${dupeId}`);

        for (const m of dupeMatches ?? []) {
          const update: Record<string, string> = {};
          if (m.player1_id === dupeId) update.player1_id = canonId;
          if (m.player2_id === dupeId) update.player2_id = canonId;
          if (m.winner_id === dupeId)  update.winner_id  = canonId;

          const { error: updateErr } = await supabase
            .from("matches")
            .update(update)
            .eq("id", m.id);

          if (updateErr) {
            console.error(`  ✗ Failed to update match ${m.id}:`, updateErr.message);
          } else {
            totalMerged++;
          }
        }

        // Now safe to delete the duplicate player row
        const { error: deleteErr } = await supabase
          .from("players")
          .delete()
          .eq("id", dupeId);

        if (deleteErr) {
          console.error(`  ✗ Failed to delete player ${dupeId}:`, deleteErr.message);
        } else {
          totalDeleted++;
          console.log(`  ✓ Deleted duplicate: ${dupeId}`);
        }
      }
    }

    console.log("");
  }

  if (DRY_RUN) {
    console.log(`\nDry run complete. Run with --run to apply these ${dupeGroups.length} merge(s).`);
  } else {
    console.log(`\n✓ Merge complete. ${totalMerged} match references updated. ${totalDeleted} duplicate player rows deleted.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
