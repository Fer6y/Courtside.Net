/**
 * _diagnose-masters-partials.ts — read-only.
 *
 * Dumps the actual rows (matchup, date, round, score, api_event_key) for the 7
 * partial Masters groups flagged by validate-slam-draws.ts (0 finals each), plus
 * the 2 newly-created gaps (Cincinnati 2024 ATP, Italian Open 2025 WTA) and the
 * 2 previously-known gaps (Indian Wells 2025 ATP, Italian Open 2024 ATP).
 *
 * Goal: decide per group whether the existing rows are real-but-incomplete or
 * wrong-event pollution, by eyeballing matchups/dates against known history.
 *
 * Run: npx tsx scripts/_diagnose-masters-partials.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GROUPS: { tournament: string; tour: string }[] = [
  { tournament: "Western & Southern Open 2025", tour: "ATP" },
  { tournament: "Miami Open 2025",              tour: "WTA" },
  { tournament: "Indian Wells Masters 2023",    tour: "ATP" },
  { tournament: "Italian Open 2023",            tour: "WTA" },
  { tournament: "Western & Southern Open 2020", tour: "WTA" },
  { tournament: "Miami Open 2021",              tour: "WTA" },
  { tournament: "Italian Open 2022",            tour: "WTA" },
  // gaps (expected: 0 rows)
  { tournament: "Western & Southern Open 2024", tour: "ATP" },
  { tournament: "Italian Open 2025",            tour: "WTA" },
  { tournament: "Indian Wells Masters 2025",    tour: "ATP" },
  { tournament: "Italian Open 2024",            tour: "ATP" },
];

async function playerName(id: string | null): Promise<string> {
  if (!id) return "—";
  const { data } = await supabase.from("players").select("name").eq("id", id).maybeSingle();
  return data?.name ?? `?${id.slice(0, 6)}`;
}

async function main() {
  for (const g of GROUPS) {
    const { data, error } = await supabase
      .from("matches")
      .select("player1_id, player2_id, winner_id, round, score, match_date, api_event_key, source")
      .eq("tournament", g.tournament)
      .eq("tour", g.tour)
      .order("match_date", { ascending: true })
      .limit(500);
    if (error) throw error;

    console.log(`\n══ ${g.tournament} | ${g.tour} — ${data.length} rows ══`);
    if (data.length === 0) { console.log("  (gap — no rows)"); continue; }

    // date range + round histogram
    const dates = data.map((r) => r.match_date).filter(Boolean).sort() as string[];
    const rounds = new Map<string, number>();
    for (const r of data) rounds.set(r.round ?? "null", (rounds.get(r.round ?? "null") ?? 0) + 1);
    console.log(`  dates: ${dates[0]} … ${dates[dates.length - 1]}`);
    console.log(`  rounds: ${[...rounds.entries()].map(([k, v]) => `${k}×${v}`).join(", ")}`);
    console.log(`  event_key null: ${data.filter((r) => !r.api_event_key).length}, sources: ${[...new Set(data.map((r) => r.source))].join("/")}`);

    // show up to 12 sample matchups (names)
    const sample = data.slice(0, 12);
    for (const r of sample) {
      const [n1, n2, w] = await Promise.all([
        playerName(r.player1_id),
        playerName(r.player2_id),
        playerName(r.winner_id),
      ]);
      console.log(`    ${r.match_date ?? "????-??-??"} [${r.round ?? "null"}] ${n1} vs ${n2} → ${w}  (${r.score ?? "no score"})`);
    }
    if (data.length > 12) console.log(`    … +${data.length - 12} more`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
