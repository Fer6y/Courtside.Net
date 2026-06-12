/**
 * validate-slam-draws.ts — post-import sanity check (the guardrail added after
 * the wrong-seasonId incident, see docs/match-data-validation-2026-06-12.md).
 *
 * For every (tournament, tour) group tagged grand_slam:
 *   - 100–130 rows (a 128-player draw has ~127 matches)
 *   - exactly 1 Final
 *   - no Round Robin rounds, no null rounds
 *   - all match dates within a 1-month span (slams run two weeks)
 *
 * Also reports masters_1000 groups with anything other than exactly 1 Final
 * (draw sizes vary, so only the final count is enforced there).
 *
 * Exits 1 if any grand_slam check fails. Run after ANY match import:
 *   npx tsx scripts/validate-slam-draws.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Row { tournament: string; tour: string | null; round: string | null; match_date: string | null }

async function fetchTier(tier: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("matches")
      .select("tournament, tour, round, match_date")
      .eq("tournament_tier", tier)
      .range(from, from + 999);
    if (error) throw error;
    all.push(...(data as Row[]));
    if (data.length < 1000) break;
  }
  return all;
}

function group(rows: Row[]) {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.tournament} | ${r.tour ?? "?"}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function monthSpan(rows: Row[]): number {
  const dates = rows.map((r) => r.match_date).filter(Boolean).sort() as string[];
  if (dates.length < 2) return 0;
  const lo = new Date(dates[0]).getTime();
  const hi = new Date(dates[dates.length - 1]).getTime();
  return (hi - lo) / (1000 * 60 * 60 * 24);
}

async function main() {
  let failures = 0;

  // ── Grand Slams: strict ────────────────────────────────────────────────────
  const slams = group(await fetchTier("grand_slam"));
  console.log(`\nGrand Slam groups: ${slams.size}\n`);
  for (const [key, rows] of [...slams.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const problems: string[] = [];
    const finals = rows.filter((r) => r.round === "Final").length;
    const rr     = rows.filter((r) => r.round === "Round Robin").length;
    const nullR  = rows.filter((r) => !r.round).length;
    const span   = monthSpan(rows);

    if (rows.length < 100 || rows.length > 130) problems.push(`${rows.length} rows`);
    if (finals !== 1) problems.push(`${finals} finals`);
    if (rr > 0)       problems.push(`${rr} round-robin rows`);
    if (nullR > 0)    problems.push(`${nullR} null rounds`);
    if (span > 31)    problems.push(`dates span ${Math.round(span)} days`);

    if (problems.length) {
      console.log(`  ✗ ${key} — ${problems.join(", ")}`);
      failures++;
    } else {
      console.log(`  ✓ ${key} (${rows.length})`);
    }
  }

  // ── Masters: finals count only (informational) ─────────────────────────────
  const masters = group(await fetchTier("masters_1000"));
  const oddMasters = [...masters.entries()].filter(
    ([, rows]) => rows.filter((r) => r.round === "Final").length !== 1
  );
  console.log(`\nMasters 1000 groups: ${masters.size}, with ≠1 final: ${oddMasters.length}`);
  for (const [key, rows] of oddMasters) {
    const finals = rows.filter((r) => r.round === "Final").length;
    console.log(`  ⚠️  ${key} — ${rows.length} rows, ${finals} finals`);
  }

  if (failures > 0) {
    console.log(`\n✗ ${failures} grand_slam group(s) failed validation.`);
    process.exit(1);
  }
  console.log("\n✓ All grand_slam groups pass.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
