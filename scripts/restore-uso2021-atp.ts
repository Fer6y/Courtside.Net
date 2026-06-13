/**
 * restore-uso2021-atp.ts — one-off recovery.
 *
 * The Masters reimport (before tour-namespacing of api_event_key) overwrote 76
 * US Open 2021 ATP rows whose bare match ids collided with WTA 2026 Masters
 * matches (ATP & WTA share overlapping id ranges). With Masters now re-imported
 * under tour-namespaced keys, the bare-id space is free again — re-import the
 * full US Open 2021 ATP draw (seasonId 16934) to restore all 127 rows.
 *
 * Run AFTER the namespaced Masters reimport:  npx tsx scripts/restore-uso2021-atp.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { matchstat } from "../lib/matchstat";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SEASON_ID = "16934";
const ROUND_ID_MAP: Record<number, string> = {
  4: "Round of 128", 5: "Round of 64", 6: "Round of 32", 7: "Round of 16",
  9: "Quarterfinal", 10: "Semifinal", 12: "Final", 13: "Final",
};

async function fetchAllPlayers(): Promise<Map<string,string>> {
  const map = new Map<string,string>();
  for (let from=0;;from+=1000){
    const { data, error } = await supabase.from("players").select("id, api_player_key").not("api_player_key","is",null).range(from, from+999);
    if (error) throw error; for (const p of data) map.set(String(p.api_player_key), p.id); if (data.length<1000) break;
  }
  return map;
}

async function main() {
  const res = await matchstat<any>(`atp/tournament/results/${SEASON_ID}`);
  const singles: any[] = res.singles ?? [];
  console.log(`US Open 2021 ATP (${SEASON_ID}): ${singles.length} singles`);
  const players = await fetchAllPlayers();

  const batch:any[] = []; let skipped=0;
  for (const m of singles) {
    const p1 = players.get(String(m.player1Id)), p2 = players.get(String(m.player2Id));
    if (!p1 || !p2) { skipped++; continue; }
    const winnerId = m.match_winner===m.player1Id?p1:m.match_winner===m.player2Id?p2:null;
    const rid = Number(m.roundId);
    batch.push({
      player1_id:p1, player2_id:p2, winner_id:winnerId,
      tournament:"US Open 2021", round: ROUND_ID_MAP[rid] ?? null,
      score: m.result?String(m.result):null, surface:"Hard",
      match_date: String(m.date??"").slice(0,10) || null,
      api_event_key: String(m.id),               // slam scheme: bare id (unchanged)
      tournament_season:2021, tournament_tier:"grand_slam", source:"api_tennis", tour:"ATP",
    });
  }
  for (let i=0;i<batch.length;i+=100){
    const { error } = await supabase.from("matches").upsert(batch.slice(i,i+100), { onConflict:"api_event_key" });
    if (error) throw error;
  }
  console.log(`✓ ${batch.length} US Open 2021 ATP matches upserted${skipped?`, ${skipped} skipped`:""}`);
}
main().catch(e=>{console.error(e);process.exit(1);});
