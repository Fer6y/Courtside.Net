import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FED = "01ea247d-e31b-449c-a2cf-6228b609e4cd";
async function main() {
  const r1 = await db.from("matches").select("surface, winner_id, match_date, tournament_season").eq("player1_id", FED);
  const r2 = await db.from("matches").select("surface, winner_id, match_date, tournament_season").eq("player2_id", FED);
  if (r1.error) console.log("r1 error:", r1.error.message);
  if (r2.error) console.log("r2 error:", r2.error.message);
  const all = [...(r1.data ?? []), ...(r2.data ?? [])];
  console.log("rows:", all.length);
  const byS: Record<string, { w: number; t: number }> = {};
  for (const m of all) {
    const s = (m.surface ?? "?").toLowerCase();
    byS[s] = byS[s] ?? { w: 0, t: 0 };
    byS[s].t++;
    if (m.winner_id === FED) byS[s].w++;
  }
  for (const [s, v] of Object.entries(byS)) console.log(`  ${s}: ${v.w}/${v.t} = ${Math.round(v.w/v.t*100)}% (seasons ${all.filter(m=>(m.surface??'').toLowerCase()===s).map(m=>m.tournament_season).join(',')})`);
}
main().then(() => process.exit(0));
