/**
 * cleanup-polluted-slams.ts
 *
 * Deletes the 18 polluted Grand Slam groups identified in
 * docs/match-data-validation-2026-06-12.md — match rows that actually belong
 * to other tournaments (Rome 2020, Davis Cup 2024, Dallas 2024, ...) but were
 * imported under slam names via wrong seasonIds in phase2b.
 *
 * Also deletes the corresponding api_raw_staging fixture rows so phase2d-style
 * reprocessing can never resurrect them.
 *
 * SAFETY: aborts if any review or watched_matches row references a match in
 * these groups (validated as zero on 2026-06-12).
 *
 * The two legitimate finals inside these groups (Roland Garros 2023 ATP,
 * US Open 2024 ATP — both api_event_key NULL) are also deleted; they are
 * recreated with proper event keys by reimport-slams.ts.
 *
 * Run: npx tsx scripts/cleanup-polluted-slams.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POLLUTED: { tournament: string; tour: string }[] = [
  { tournament: "Australian Open 2020", tour: "ATP" },
  { tournament: "Australian Open 2020", tour: "WTA" },
  { tournament: "Roland Garros 2020",   tour: "ATP" },
  { tournament: "US Open 2020",         tour: "ATP" },
  { tournament: "Australian Open 2021", tour: "ATP" },
  { tournament: "Roland Garros 2021",   tour: "ATP" },
  { tournament: "Wimbledon 2021",       tour: "ATP" },
  { tournament: "Australian Open 2022", tour: "ATP" },
  { tournament: "Roland Garros 2023",   tour: "ATP" },
  { tournament: "Roland Garros 2023",   tour: "WTA" },
  { tournament: "Wimbledon 2023",       tour: "ATP" },
  { tournament: "Australian Open 2024", tour: "ATP" },
  { tournament: "Australian Open 2024", tour: "WTA" },
  { tournament: "US Open 2024",         tour: "ATP" },
  { tournament: "Wimbledon 2024",       tour: "ATP" },
  { tournament: "Australian Open 2025", tour: "ATP" },
  { tournament: "Roland Garros 2025",   tour: "WTA" },
  { tournament: "Australian Open 2026", tour: "WTA" },
];

// Wrong seasonIds from phase2b's SLAM_SEASONS — their staged fixtures must go.
const BAD_STAGING: { seasonId: string; tour: string }[] = [
  // ATP
  { seasonId: "16565", tour: "ATP" }, // "AO 2020" → Challenger
  { seasonId: "16803", tour: "ATP" }, // "RG 2020" → Challenger
  { seasonId: "16459", tour: "ATP" }, // "USO 2020" → Rome Masters
  { seasonId: "16879", tour: "ATP" }, // "AO 2021" → Murray River Open
  { seasonId: "17177", tour: "ATP" }, // "RG 2021" → Challenger
  { seasonId: "17163", tour: "ATP" }, // "W 2021" → Challenger
  { seasonId: "17541", tour: "ATP" }, // "AO 2022" → Argentina Open
  { seasonId: "18844", tour: "ATP" }, // "RG 2023" → Challenger
  { seasonId: "18862", tour: "ATP" }, // "W 2023" → ITF
  { seasonId: "19359", tour: "ATP" }, // "AO 2024" → Dallas Open
  { seasonId: "20106", tour: "ATP" }, // "USO 2024" → Davis Cup Finals
  { seasonId: "19844", tour: "ATP" }, // "W 2024" → Challenger/ITF
  { seasonId: "20419", tour: "ATP" }, // "AO 2025" → junior/ITF
  // WTA
  { seasonId: "13174", tour: "WTA" }, // "AO 2020" → Fed Cup qualifier
  { seasonId: "14870", tour: "WTA" }, // "RG 2023" → ITF
  { seasonId: "15248", tour: "WTA" }, // "AO 2024" → Transylvania Open
  { seasonId: "16252", tour: "WTA" }, // "RG 2025" → ITF/WTA 125
  { seasonId: "16709", tour: "WTA" }, // "AO 2026" → post-AO WTA event
];

async function main() {
  console.log("\nCleanup — polluted Grand Slam groups\n");

  // ── Collect all match ids in the polluted groups ───────────────────────────
  const allIds: string[] = [];
  for (const g of POLLUTED) {
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament", g.tournament)
      .eq("tour", g.tour)
      .eq("tournament_tier", "grand_slam")
      .limit(500);
    if (error) throw error;
    console.log(`  ${g.tournament} ${g.tour}: ${data.length} rows`);
    allIds.push(...data.map((r) => r.id));
  }
  console.log(`\n  Total rows to delete: ${allIds.length}`);

  // ── Safety: no user content may reference these matches ───────────────────
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
      console.error(`\n  ✗ ABORT: ${refs} ${table} rows reference these matches.`);
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

  // ── Delete bogus staged fixtures ───────────────────────────────────────────
  let stagingDeleted = 0;
  for (const { seasonId, tour } of BAD_STAGING) {
    const { data, error } = await supabase
      .from("api_raw_staging")
      .delete()
      .eq("method", "get_fixtures")
      .contains("params", { seasonId, tour })
      .select("id");
    if (error) throw error;
    stagingDeleted += data?.length ?? 0;
  }
  console.log(`  ✓ Deleted ${stagingDeleted} bogus staging rows.`);
  console.log("\n  Next: npx tsx scripts/reimport-slams.ts\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
