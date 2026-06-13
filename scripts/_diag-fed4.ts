import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FED = "01ea247d-e31b-449c-a2cf-6228b609e4cd";
async function main() {
  const { data: a } = await db.from("matches").select("surface, winner_id, tournament_name, tournament_season, match_date").eq("player1_id", FED);
  const { data: b } = await db.from("matches").select("surface, winner_id, tournament_name, tournament_season, match_date").eq("player2_id", FED);
  const all = [...(a ?? []), ...(b ?? [])];
  const byS: Record<string, { w: number; t: number }> = {};
  for (const m of all) {
    const s = (m.surface ?? "?").toLowerCase();
    byS[s] = byS[s] ?? { w: 0, t: 0 };
    byS[s].t++;
    if (m.winner_id === FED) byS[s].w++;
  }
  console.log("Federer surface breakdown (DB, since 2020):");
  for (const [s, v] of Object.entries(byS)) console.log(`  ${s}: ${v.w}/${v.t} = ${Math.round(v.w/v.t*100)}%`);
  console.log("\nClay matches:");
  for (const m of all.filter((m) => (m.surface??"").toLowerCase()==="clay"))
    console.log(`  ${m.tournament_name} ${m.tournament_season} | won=${m.winner_id===FED} | ${m.match_date}`);
}
main().then(() => process.exit(0));
