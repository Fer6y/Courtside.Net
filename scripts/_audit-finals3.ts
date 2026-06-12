/**
 * _audit-finals3.ts — read-only. Lists every distinct (tournament, tour, season)
 * combo tagged grand_slam with row counts, to find duplicate/polluted variants.
 *
 * Run: npx tsx scripts/_audit-finals3.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchAll() {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("matches")
      .select("tournament, tournament_season, tour, round")
      .eq("tournament_tier", "grand_slam")
      .range(from, from + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

async function main() {
  const rows = await fetchAll();
  console.log(`Total grand_slam rows: ${rows.length}\n`);

  const groups = new Map<string, { n: number; rounds: Map<string, number> }>();
  for (const r of rows) {
    const key = `${r.tournament_season} | ${r.tournament} | ${r.tour ?? "?"}`;
    if (!groups.has(key)) groups.set(key, { n: 0, rounds: new Map() });
    const g = groups.get(key)!;
    g.n++;
    g.rounds.set(r.round ?? "null", (g.rounds.get(r.round ?? "null") ?? 0) + 1);
  }

  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, g] of sorted) {
    const roundStr = [...g.rounds.entries()]
      .map(([r, n]) => `${r}:${n}`)
      .join("  ");
    // A full slam singles draw is 127 matches (or 126 in some COVID years)
    const flag = g.n < 100 ? "  ⚠️ partial" : "";
    console.log(`${key} — ${g.n} rows${flag}`);
    console.log(`    ${roundStr}`);
  }
  console.log(`\n${groups.size} tournament groups`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
