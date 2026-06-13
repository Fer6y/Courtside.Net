/**
 * _experiment-masters-probe.ts — read-only proof-of-concept.
 *
 * For two hard editions, probe ranked players' TourRank:2 past-matches, collect
 * every candidate tournamentId with an in-window match, then fetch each
 * candidate's draw and print: singles size, #finals, all-dates-in-window?, and
 * the final matchup (names). Goal: confirm "largest valid draw whose dates all
 * sit inside a tight window" uniquely identifies the real Masters.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { matchstat } from "../lib/matchstat";

interface Ed { label: string; tour: "ATP" | "WTA"; year: number; window: [string, string] }

const EDS: Ed[] = [
  { label: "Indian Wells 2022 ATP", tour: "ATP", year: 2022, window: ["2022-03-07", "2022-03-20"] },
];

const FINALS = new Set([12, 13]);
const inWin = (d: string | undefined, [lo, hi]: [string, string]) => {
  const s = String(d ?? "").slice(0, 10);
  return s >= lo && s <= hi;
};

async function rankedIds(tour: string): Promise<string[]> {
  const r = await matchstat<any[]>(`${tour.toLowerCase()}/ranking/singles`);
  return (Array.isArray(r) ? r : [])
    .map((row) => String((row.player ?? row).id ?? "").trim())
    .filter(Boolean);
}

async function main() {
  for (const ed of EDS) {
    console.log(`\n══ ${ed.label}  window ${ed.window[0]}…${ed.window[1]} ══`);
    const ids = await rankedIds(ed.tour);
    const cands = new Set<string>();
    let probed = 0;
    for (const pid of ids.slice(0, 40)) {
      probed++;
      // page through the year's TourRank:2 matches (10/page, newest-first)
      for (let page = 1; page <= 6; page++) {
        let rows: any[] = [];
        try {
          const pm = await matchstat<any[]>(
            `${ed.tour.toLowerCase()}/player/past-matches/${pid}`,
            { filter: `GameYear:${ed.year};TourRank:2`, pageNo: String(page) }
          );
          rows = Array.isArray(pm) ? pm : [];
        } catch { break; }
        if (rows.length === 0) break;
        for (const m of rows) {
          if (inWin(m.date, ed.window) && m.tournamentId) cands.add(String(m.tournamentId));
        }
        const oldest = String(rows[rows.length - 1]?.date ?? "").slice(0, 10);
        if (oldest && oldest < ed.window[0]) break; // past the window, stop paging
      }
    }
    console.log(`  probed ${probed} players → ${cands.size} candidate tournamentIds: ${[...cands].join(", ")}`);

    for (const c of cands) {
      try {
        const res = await matchstat<any>(`${ed.tour.toLowerCase()}/tournament/results/${c}`);
        const singles: any[] = res.singles ?? res.data?.singles ?? [];
        const finals = singles.filter((m) => FINALS.has(m.roundId ?? -1));
        const allIn = singles.every((m) => !m.date || inWin(m.date, ed.window));
        const dates = singles.map((m) => String(m.date ?? "").slice(0, 10)).filter(Boolean).sort();
        const f = finals[0];
        const fstr = f ? `${f.player1?.name} vs ${f.player2?.name} → ${f.match_winner === f.player1Id ? f.player1?.name : f.player2?.name}` : "—";
        console.log(`    id ${c}: singles=${singles.length} finals=${finals.length} allDatesInWindow=${allIn} dates ${dates[0]}…${dates[dates.length-1]}`);
        console.log(`        final: ${fstr}`);
      } catch (e) {
        console.log(`    id ${c}: results error ${(e as Error).message}`);
      }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
