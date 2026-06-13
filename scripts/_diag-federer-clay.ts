import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: players } = await db
    .from("players")
    .select("id, name, current_rank, career_stats")
    .ilike("name", "%federer%");
  console.log("Federer rows:", players?.map((p) => ({ id: p.id, name: p.name, rank: p.current_rank })));

  for (const p of players ?? []) {
    const { data: matches } = await db
      .from("matches")
      .select("id, surface, winner_id, player1_id, player2_id, match_date, tournament_name, tournament_season")
      .or(`player1_id.eq.${p.id},player2_id.eq.${p.id}`);
    const byS: Record<string, { w: number; t: number }> = {};
    for (const m of matches ?? []) {
      const s = (m.surface ?? "?").toLowerCase();
      byS[s] = byS[s] ?? { w: 0, t: 0 };
      byS[s].t++;
      if (m.winner_id === p.id) byS[s].w++;
    }
    console.log(`\n${p.name} (${p.id}) — ${matches?.length ?? 0} matches in DB`);
    console.log("  by surface:", byS);
    const clay = (matches ?? []).filter((m) => (m.surface ?? "").toLowerCase() === "clay");
    for (const m of clay) {
      console.log(`   clay: ${m.tournament_name} ${m.tournament_season} | won=${m.winner_id === p.id} | ${m.match_date}`);
    }
  }
}
main().then(() => process.exit(0));
