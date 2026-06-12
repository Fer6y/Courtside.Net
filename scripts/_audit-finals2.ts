/**
 * _audit-finals2.ts — read-only deep dive on suspect Grand Slam rows.
 * 1. Shows source/api_event_key for the bogus finals.
 * 2. Counts rows per round for a few polluted tournaments to gauge spread.
 *
 * Run: npx tsx scripts/_audit-finals2.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 1. All GS finals with provenance fields
  const { data: finals, error } = await supabase
    .from("matches")
    .select(
      "id, tournament, tournament_season, tour, round, match_date, score, source, api_event_key, " +
        "player1:player1_id(name), player2:player2_id(name)"
    )
    .eq("tournament_tier", "grand_slam")
    .eq("round", "Final")
    .order("tournament_season")
    .limit(2000);
  if (error) throw error;

  console.log("=== GS finals with provenance ===");
  for (const m of finals) {
    const p1 = (m.player1 as any)?.name ?? "?";
    const p2 = (m.player2 as any)?.name ?? "?";
    console.log(
      `${m.tournament_season} ${m.tournament} ${m.tour}  ${m.match_date}  ${p1} vs ${p2}` +
        `  src=${m.source ?? "null"}  evt=${m.api_event_key ?? "null"}`
    );
  }

  // 2. Round distribution for a couple of polluted tournaments
  const suspects = [
    { tournament: "US Open 2024", tour: "ATP" },
    { tournament: "Australian Open 2024", tour: "ATP" },
    { tournament: "Wimbledon 2023", tour: "ATP" },
  ];
  for (const s of suspects) {
    const { data: rows, error: e2 } = await supabase
      .from("matches")
      .select("round, match_date")
      .eq("tournament", s.tournament)
      .eq("tour", s.tour)
      .limit(2000);
    if (e2) throw e2;
    const byRound = new Map<string, number>();
    for (const r of rows) byRound.set(r.round ?? "null", (byRound.get(r.round ?? "null") ?? 0) + 1);
    console.log(`\n=== ${s.tournament} ${s.tour} — ${rows.length} rows ===`);
    for (const [round, n] of byRound) console.log(`  ${round}: ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
