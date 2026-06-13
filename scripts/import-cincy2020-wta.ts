/**
 * import-cincy2020-wta.ts — one-off.
 *
 * The 2020 Cincinnati WTA (played in the NY bubble; "Western & Southern Open -
 * New York", seasonId 13057) is the only Masters edition whose FINAL was never
 * played: Naomi Osaka withdrew injured before the final and Victoria Azarenka
 * was awarded the title by walkover. So the API draw ends at the semifinals
 * (roundIds 4,5,6,9,10 → no roundId 12) and the generic probe/importer (which
 * require exactly one final, and label rounds by counting back from the final)
 * can't handle it.
 *
 * This script:
 *   1. Re-imports the 54 played matches with correct 56-draw round labels
 *      derived from each round's match COUNT (24→R64, 16→R32, 8→R16, 4→QF,
 *      2→SF) — robust to the missing final.
 *   2. Appends the real, documented result: the walkover final
 *      Azarenka def. Osaka (W/O), so the edition has a champion and passes the
 *      strict validator (exactly one Final).
 *
 * Run AFTER reimport-masters.ts:  npx tsx scripts/import-cincy2020-wta.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { matchstat } from "../lib/matchstat";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SEASON_ID = "13057";
const TOURNAMENT = "Western & Southern Open 2020";
const COUNT_TO_ROUND: Record<number, string> = {
  24: "Round of 64", 16: "Round of 32", 8: "Round of 16", 4: "Quarterfinal", 2: "Semifinal",
};

async function fetchAllPlayers(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("players").select("id, api_player_key")
      .not("api_player_key", "is", null).range(from, from + 999);
    if (error) throw error;
    for (const p of data) map.set(String(p.api_player_key), p.id);
    if (data.length < 1000) break;
  }
  return map;
}

async function main() {
  const res = await matchstat<any>(`wta/tournament/results/${SEASON_ID}`);
  const singles: any[] = res.singles ?? [];
  console.log(`Cincinnati 2020 WTA (season ${SEASON_ID}): ${singles.length} played matches`);

  const byRound = new Map<number, number>();
  for (const m of singles) byRound.set(m.roundId, (byRound.get(m.roundId) ?? 0) + 1);

  const playerMap = await fetchAllPlayers();
  const nm = (apiId: number) => playerMap.get(String(apiId));

  // ── 1) upsert the 54 played matches with count-based round labels ──────────
  const batch: any[] = [];
  let skipped = 0;
  for (const m of singles) {
    const p1 = nm(m.player1Id), p2 = nm(m.player2Id);
    if (!p1 || !p2) { skipped++; continue; }
    const winnerId = m.match_winner === m.player1Id ? p1 : m.match_winner === m.player2Id ? p2 : null;
    batch.push({
      player1_id: p1, player2_id: p2, winner_id: winnerId,
      tournament: TOURNAMENT,
      round: COUNT_TO_ROUND[byRound.get(m.roundId) ?? -1] ?? null,
      score: m.result ? String(m.result) : null,
      surface: "Hard",
      match_date: String(m.date ?? "").slice(0, 10) || null,
      api_event_key: `WTA-${m.id}`,   // tour-namespaced (ATP/WTA match ids overlap)
      tournament_season: 2020, tournament_tier: "masters_1000",
      source: "api_tennis", tour: "WTA",
    });
  }
  for (let i = 0; i < batch.length; i += 100) {
    const { error } = await supabase.from("matches").upsert(batch.slice(i, i + 100), { onConflict: "api_event_key" });
    if (error) throw error;
  }
  console.log(`  ✓ ${batch.length} matches upserted${skipped ? `, ${skipped} skipped (missing players)` : ""}`);

  // ── 2) append the walkover final: Azarenka def. Osaka (W/O) ────────────────
  // Finalists = the two semifinal winners (roundId 10).
  const sfRid = Math.max(...singles.map((m) => m.roundId).filter((r) => byRound.get(r) === 2));
  const sfWinners = singles.filter((m) => m.roundId === sfRid).map((m) => ({
    apiId: m.match_winner,
    name: (m.match_winner === m.player1Id ? m.player1?.name : m.player2?.name) ?? "",
  }));
  const aza = sfWinners.find((w) => /azarenka/i.test(w.name));
  const osa = sfWinners.find((w) => /osaka/i.test(w.name));
  if (!aza || !osa) throw new Error(`Could not identify finalists from SFs: ${sfWinners.map((w) => w.name).join(", ")}`);
  const azaId = nm(aza.apiId), osaId = nm(osa.apiId);
  if (!azaId || !osaId) throw new Error(`Finalists not in players table (Azarenka ${aza.apiId}, Osaka ${osa.apiId})`);

  const { error: finErr } = await supabase.from("matches").upsert({
    player1_id: azaId, player2_id: osaId, winner_id: azaId,
    tournament: TOURNAMENT, round: "Final",
    score: "W/O",                              // Osaka withdrew injured; Azarenka awarded the title
    surface: "Hard", match_date: "2020-08-29",
    api_event_key: "WTA-wso2020-final-wo",     // synthetic, stable key (no real API match exists)
    tournament_season: 2020, tournament_tier: "masters_1000",
    source: "api_tennis", tour: "WTA",
  }, { onConflict: "api_event_key" });
  if (finErr) throw finErr;
  console.log(`  ✓ Walkover final added: ${aza.name} def. ${osa.name} (W/O)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
