/**
 * cleanup-polluted-masters.ts
 *
 * Deletes the polluted Masters 1000 groups — the ones whose verified seasonId
 * differs from what was staged/imported (challenger junk + cross-labelled
 * neighbours), per scripts/_verified-masters-seasons.json (changed: true).
 *
 * Mirrors cleanup-polluted-slams.ts:
 *   • deletes all matches rows in each changed (tournament, tour) group
 *   • deletes the stale get_fixtures staging row (its WRONG seasonId) so a
 *     re-import can never resurrect it
 *   • SAFETY: aborts if any review or watched_matches row references a match
 *     in these groups
 *
 * The matches table key is `tournament` = "<name> <year>" (e.g. "Madrid Open
 * 2021"), `tour`, tournament_tier = 'masters_1000'.
 *
 * Run AFTER probe-masters-seasonids.ts and BEFORE reimport-masters.ts:
 *   npx tsx scripts/cleanup-polluted-masters.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Verified {
  name: string; year: number; tour: string;
  seasonId: string; currentSeasonId: string | null; changed: boolean;
}

async function main() {
  const verified: Verified[] = JSON.parse(
    fs.readFileSync("scripts/_verified-masters-seasons.json", "utf8")
  );
  const changed = verified.filter((v) => v.changed);
  console.log(`\nCleanup — ${changed.length} Masters groups whose seasonId changed\n`);

  // ── Collect all match ids in the changed groups ────────────────────────────
  const allIds: string[] = [];
  const groupTournament = (v: Verified) => `${v.name} ${v.year}`;
  for (const v of changed) {
    const tournament = groupTournament(v);
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament", tournament)
      .eq("tour", v.tour)
      .eq("tournament_tier", "masters_1000")
      .limit(500);
    if (error) throw error;
    console.log(`  ${tournament} ${v.tour}: ${data.length} rows  (was season ${v.currentSeasonId ?? "—"} → ${v.seasonId})`);
    allIds.push(...data.map((r) => r.id));
  }
  console.log(`\n  Total rows to delete: ${allIds.length}`);

  // ── Safety: no user content may reference these matches ────────────────────
  for (const table of ["reviews", "watched_matches"]) {
    let refs = 0;
    for (let i = 0; i < allIds.length; i += 200) {
      const { count, error } = await supabase
        .from(table)
        .select("match_id", { count: "exact", head: true })
        .in("match_id", allIds.slice(i, i + 200));
      if (error) throw error;
      refs += count ?? 0;
    }
    if (refs > 0) {
      console.error(`\n  ✗ ABORT: ${refs} ${table} rows reference these matches. Resolve before deleting.`);
      process.exit(1);
    }
    console.log(`  ✓ ${table}: 0 references`);
  }

  // ── Delete matches ─────────────────────────────────────────────────────────
  let deleted = 0;
  for (let i = 0; i < allIds.length; i += 200) {
    const batch = allIds.slice(i, i + 200);
    const { error } = await supabase.from("matches").delete().in("id", batch);
    if (error) throw error;
    deleted += batch.length;
  }
  console.log(`\n  ✓ Deleted ${deleted} match rows.`);

  // ── Delete the stale (wrong-seasonId) staging rows ─────────────────────────
  let stagingDeleted = 0;
  for (const v of changed) {
    if (!v.currentSeasonId) continue;             // nothing staged (true gap)
    // Target the exact mislabelled row (seasonId + tour + name + year) so we
    // never delete a correctly-named row that happens to share a seasonId.
    const { data, error } = await supabase
      .from("api_raw_staging")
      .delete()
      .eq("method", "get_fixtures")
      .contains("params", {
        seasonId: v.currentSeasonId, tour: v.tour,
        slam_name: v.name, year: String(v.year),
      })
      .select("id");
    if (error) throw error;
    stagingDeleted += data?.length ?? 0;
  }
  console.log(`  ✓ Deleted ${stagingDeleted} stale staging rows.`);
  console.log("\n  Next: npx tsx scripts/reimport-masters.ts\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
