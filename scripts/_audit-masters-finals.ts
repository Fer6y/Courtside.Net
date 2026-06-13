/**
 * _audit-masters-finals.ts — read-only.
 * For every masters_1000 group: row count + the "Final" row's matchup (names)
 * + date span. Real Masters finals have famous names; wrong-event pollution
 * shows unknowns. Lets us see the true extent of the wrong-seasonId disease.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // pull all masters rows (paginated)
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("matches")
      .select("tournament, tour, round, match_date, player1_id, player2_id, winner_id")
      .eq("tournament_tier", "masters_1000")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  // player name map
  const ids = new Set<string>();
  for (const r of rows) { if (r.player1_id) ids.add(r.player1_id); if (r.player2_id) ids.add(r.player2_id); }
  const nameMap = new Map<string, string>();
  const idArr = [...ids];
  for (let i = 0; i < idArr.length; i += 300) {
    const { data } = await supabase.from("players").select("id, name").in("id", idArr.slice(i, i + 300));
    for (const p of data ?? []) nameMap.set(p.id, p.name);
  }
  const nm = (id: string | null) => (id ? nameMap.get(id) ?? `?${id.slice(0, 6)}` : "—");

  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const k = `${r.tournament} | ${r.tour}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  console.log(`Masters groups: ${groups.size}\n`);
  for (const [k, g] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const finals = g.filter((r) => r.round === "Final");
    const dates = g.map((r) => r.match_date).filter(Boolean).sort();
    const span = dates.length ? `${dates[0]}…${dates[dates.length - 1]}` : "no dates";
    let finalStr: string;
    if (finals.length === 1) {
      const f = finals[0];
      finalStr = `FINAL: ${nm(f.player1_id)} vs ${nm(f.player2_id)} → ${nm(f.winner_id)}`;
    } else {
      finalStr = `⚠️ ${finals.length} finals`;
    }
    console.log(`  ${k.padEnd(38)} ${String(g.length).padStart(3)} rows  ${span}  ${finalStr}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
