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

// ── Orphan junk groups: cancelled / non-existent editions with no real draw to
// re-import (the probe correctly found none). Confirmed by _reconcile-masters.ts.
// DELETED with no re-import (matches + their staging).
const ORPHAN_GROUPS: { tournament: string; tour: string }[] = [
  { tournament: "Guadalajara Open 2021", tour: "WTA" }, // 2021 Guadalajara was the WTA Finals, not a 1000
  { tournament: "Madrid Open 2020",      tour: "ATP" }, // Madrid 2020 cancelled (COVID)
  { tournament: "Madrid Open 2020",      tour: "WTA" },
  { tournament: "Shanghai Masters 2021", tour: "ATP" }, // Shanghai 2020–2022 cancelled (COVID)
  { tournament: "Shanghai Masters 2022", tour: "ATP" },
  { tournament: "Wuhan Open 2023",       tour: "WTA" }, // phantom: was really Beijing (→ China Open 2023)
];

async function main() {
  const verified: Verified[] = JSON.parse(
    fs.readFileSync("scripts/_verified-masters-seasons.json", "utf8")
  );
  const changed = verified.filter((v) => v.changed);
  console.log(`\nCleanup — ${changed.length} changed groups + ${ORPHAN_GROUPS.length} orphan junk groups\n`);

  // ── Collect all match ids in the changed groups + orphans ──────────────────
  const allIds: string[] = [];
  const targets = [
    ...changed.map((v) => ({ tournament: `${v.name} ${v.year}`, tour: v.tour, note: `was season ${v.currentSeasonId ?? "—"} → ${v.seasonId}` })),
    ...ORPHAN_GROUPS.map((o) => ({ tournament: o.tournament, tour: o.tour, note: "orphan (no real edition)" })),
  ];
  for (const t of targets) {
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament", t.tournament)
      .eq("tour", t.tour)
      .eq("tournament_tier", "masters_1000")
      .limit(500);
    if (error) throw error;
    console.log(`  ${t.tournament} ${t.tour}: ${data.length} rows  (${t.note})`);
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
  // Orphan staging rows (any seasonId) — match by name + year + tour.
  for (const o of ORPHAN_GROUPS) {
    const m = o.tournament.match(/^(.*)\s(\d{4})$/);
    if (!m) continue;
    const [, name, year] = m;
    const { data, error } = await supabase
      .from("api_raw_staging").delete().eq("method", "get_fixtures")
      .contains("params", { slam_name: name, year, tour: o.tour }).select("id");
    if (error) throw error;
    stagingDeleted += data?.length ?? 0;
  }
  console.log(`  ✓ Deleted ${stagingDeleted} stale staging rows.`);
  console.log("\n  Next: npx tsx scripts/reimport-masters.ts\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
