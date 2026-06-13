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
 * For every masters_1000 group (since the 2026-06 Masters cleanup):
 *   - 45–100 rows (48-draw = 47 matches, 96-draw = 95; small wrong-event
 *     draws were ~31)
 *   - exactly 1 Final
 *   - no Round Robin rows, no null rounds
 *   - all match dates within an 18-day span (Masters run 1–2 weeks)
 *
 * Exits 1 if any grand_slam OR masters_1000 check fails. Run after ANY match
 * import:
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

interface Bounds { minRows: number; maxRows: number; maxSpan: number }

/** Check one tier's groups against its bounds. Returns the failure count. */
function checkTier(label: string, rows: Row[], b: Bounds): number {
  const groups = group(rows);
  console.log(`\n${label} groups: ${groups.size}\n`);
  let failures = 0;
  for (const [key, g] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const problems: string[] = [];
    const finals = g.filter((r) => r.round === "Final").length;
    const rr     = g.filter((r) => r.round === "Round Robin").length;
    const nullR  = g.filter((r) => !r.round).length;
    const span   = monthSpan(g);

    if (g.length < b.minRows || g.length > b.maxRows) problems.push(`${g.length} rows`);
    if (finals !== 1)     problems.push(`${finals} finals`);
    if (rr > 0)           problems.push(`${rr} round-robin rows`);
    if (nullR > 0)        problems.push(`${nullR} null rounds`);
    if (span > b.maxSpan) problems.push(`dates span ${Math.round(span)} days`);

    if (problems.length) {
      console.log(`  ✗ ${key} — ${problems.join(", ")}`);
      failures++;
    } else {
      console.log(`  ✓ ${key} (${g.length})`);
    }
  }
  return failures;
}

async function main() {
  // Grand Slams: 128-draw → ~127 matches, run two weeks.
  const slamFails = checkTier(
    "Grand Slam", await fetchTier("grand_slam"),
    { minRows: 100, maxRows: 130, maxSpan: 31 }
  );
  // Masters: 48-draw (47) to 96-draw (95), run 1–2 weeks.
  const mastersFails = checkTier(
    "Masters 1000", await fetchTier("masters_1000"),
    { minRows: 45, maxRows: 100, maxSpan: 18 }
  );

  const failures = slamFails + mastersFails;
  if (failures > 0) {
    console.log(`\n✗ ${slamFails} grand_slam + ${mastersFails} masters_1000 group(s) failed validation.`);
    process.exit(1);
  }
  console.log("\n✓ All grand_slam and masters_1000 groups pass.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
