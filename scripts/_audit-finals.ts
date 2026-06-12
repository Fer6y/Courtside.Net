/**
 * _audit-finals.ts — read-only audit of Grand Slam "Final" rows.
 * Counts finals per tournament/season/tour and prints the matchups
 * so we can spot finals that never happened.
 *
 * Run: npx tsx scripts/_audit-finals.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, tournament, tournament_season, tour, round, match_date, score, " +
        "player1:player1_id(name), player2:player2_id(name)"
    )
    .eq("tournament_tier", "grand_slam")
    .eq("round", "Final")
    .order("tournament_season", { ascending: true })
    .limit(2000);

  if (error) throw error;

  console.log(`Total Grand Slam 'Final' rows: ${data.length}\n`);

  // Group by tournament + season + tour
  const groups = new Map<string, typeof data>();
  for (const m of data) {
    const key = `${m.tournament_season} | ${m.tournament} | ${m.tour ?? "?"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, rows] of sorted) {
    const flag = rows.length > 1 ? `  ⚠️  ${rows.length} finals` : "";
    console.log(`${key}${flag}`);
    for (const m of rows) {
      const p1 = (m.player1 as any)?.name ?? "?";
      const p2 = (m.player2 as any)?.name ?? "?";
      console.log(`    ${m.match_date ?? "no-date"}  ${p1} vs ${p2}  [${m.score ?? "no score"}]`);
    }
  }

  console.log(`\nGroups: ${groups.size} (expected ≈ 1 final per slam/season/tour)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
