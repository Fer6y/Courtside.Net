/**
 * probe-slam-seasonids.ts
 *
 * Finds the CORRECT MatchStat seasonIds for the 18 slam editions that were
 * imported with wrong IDs (see docs/match-data-validation-2026-06-12.md).
 *
 * Method, per edition:
 *   1. Page through the known champion's past-matches (GameYear:Y;TourRank:1)
 *      and collect every match with a final-round id (12/13) that the champion
 *      WON inside the slam's date window → candidate tournamentId.
 *   2. Verify each candidate by fetching tournament/results/{id}:
 *      the singles draw must have ≥95 matches (128-player main draw) and its
 *      final must include the champion's API id.
 *      (AO 2026 WTA has no known champion here — probe several top players and
 *      verify structurally: ≥95 matches + a first-round id 4 + window dates.)
 *
 * Output: scripts/_verified-slam-seasons.json — consumed by reimport-slams.ts.
 * Read-only against our DB; ~60-90 API calls.
 *
 * Run: npx tsx scripts/probe-slam-seasonids.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import { matchstat } from "../lib/matchstat";

interface Edition {
  slam: string;
  year: number;
  tour: "ATP" | "WTA";
  window: [string, string];          // full ISO date bounds
  probeIds: string[];                // API player ids to page through
  championId: number | null;         // null → structural verification only
}

const FINAL_ROUND_IDS = new Set([12, 13]);

// Champions: Djokovic 5992, Nadal 677, Thiem 20650, Alcaraz 68074,
// Sinner 47275, Kenin 23432, Swiatek 45854, Sabalenka 18455, Gauff 54663
const EDITIONS: Edition[] = [
  { slam: "Australian Open", year: 2020, tour: "ATP", window: ["2020-01-08", "2020-02-10"], probeIds: ["5992"],  championId: 5992 },
  { slam: "Roland Garros",   year: 2020, tour: "ATP", window: ["2020-09-25", "2020-10-12"], probeIds: ["677"],   championId: 677 },
  { slam: "US Open",         year: 2020, tour: "ATP", window: ["2020-08-28", "2020-09-14"], probeIds: ["20650"], championId: 20650 },
  { slam: "Australian Open", year: 2021, tour: "ATP", window: ["2021-02-01", "2021-02-25"], probeIds: ["5992"],  championId: 5992 },
  { slam: "Roland Garros",   year: 2021, tour: "ATP", window: ["2021-05-25", "2021-06-15"], probeIds: ["5992"],  championId: 5992 },
  { slam: "Wimbledon",       year: 2021, tour: "ATP", window: ["2021-06-25", "2021-07-15"], probeIds: ["5992"],  championId: 5992 },
  { slam: "Australian Open", year: 2022, tour: "ATP", window: ["2022-01-14", "2022-02-03"], probeIds: ["677"],   championId: 677 },
  { slam: "Roland Garros",   year: 2023, tour: "ATP", window: ["2023-05-25", "2023-06-13"], probeIds: ["5992"],  championId: 5992 },
  { slam: "Wimbledon",       year: 2023, tour: "ATP", window: ["2023-07-01", "2023-07-18"], probeIds: ["68074"], championId: 68074 },
  { slam: "Australian Open", year: 2024, tour: "ATP", window: ["2024-01-12", "2024-02-01"], probeIds: ["47275"], championId: 47275 },
  { slam: "US Open",         year: 2024, tour: "ATP", window: ["2024-08-24", "2024-09-09"], probeIds: ["47275"], championId: 47275 },
  { slam: "Wimbledon",       year: 2024, tour: "ATP", window: ["2024-06-29", "2024-07-16"], probeIds: ["68074"], championId: 68074 },
  { slam: "Australian Open", year: 2025, tour: "ATP", window: ["2025-01-10", "2025-01-29"], probeIds: ["47275"], championId: 47275 },
  { slam: "Australian Open", year: 2020, tour: "WTA", window: ["2020-01-08", "2020-02-10"], probeIds: ["23432"], championId: 23432 },
  { slam: "Roland Garros",   year: 2023, tour: "WTA", window: ["2023-05-25", "2023-06-13"], probeIds: ["45854"], championId: 45854 },
  { slam: "Australian Open", year: 2024, tour: "WTA", window: ["2024-01-12", "2024-02-01"], probeIds: ["18455"], championId: 18455 },
  { slam: "Roland Garros",   year: 2025, tour: "WTA", window: ["2025-05-23", "2025-06-11"], probeIds: ["54663"], championId: 54663 },
  // AO 2026 WTA — champion unknown to this script; structural verification.
  { slam: "Australian Open", year: 2026, tour: "WTA", window: ["2026-01-09", "2026-02-02"], probeIds: ["18455", "45854", "54663"], championId: null },
];

interface PastMatch {
  date?: string;
  roundId?: number;
  tournamentId?: number;
  match_winner?: number;
  player1Id?: number;
  player2Id?: number;
}

function inWindow(date: string | undefined, [lo, hi]: [string, string]) {
  const d = String(date ?? "").slice(0, 10);
  return d >= lo && d <= hi;
}

/** Page through a player's year until matches predate the window. */
async function collectCandidates(ed: Edition, playerId: string): Promise<Set<number>> {
  const candidates = new Set<number>();
  for (let page = 1; page <= 8; page++) {
    const raw = await matchstat<PastMatch[]>(
      `${ed.tour.toLowerCase()}/player/past-matches/${playerId}`,
      { filter: `GameYear:${ed.year};TourRank:1`, pageNo: String(page) }
    );
    const rows = Array.isArray(raw) ? raw : [];
    if (rows.length === 0) break;

    for (const m of rows) {
      if (!inWindow(m.date, ed.window) || !m.tournamentId) continue;
      // Champion known: anchor on the final they won.
      if (ed.championId !== null) {
        if (FINAL_ROUND_IDS.has(m.roundId ?? -1) && m.match_winner === ed.championId) {
          candidates.add(m.tournamentId);
        }
      } else {
        // Unknown champion: any match in window is a candidate; verified structurally.
        candidates.add(m.tournamentId);
      }
    }
    // Past-matches is newest-first; once the page is entirely older than the
    // window we can stop paging.
    const oldest = String(rows[rows.length - 1]?.date ?? "").slice(0, 10);
    if (oldest && oldest < ed.window[0]) break;
  }
  return candidates;
}

async function verify(ed: Edition, seasonId: number): Promise<{ ok: boolean; detail: string }> {
  const raw = await matchstat<Record<string, unknown>>(
    `${ed.tour.toLowerCase()}/tournament/results/${seasonId}`
  );
  const singles = ((raw.singles ?? (raw.data as any)?.singles ?? []) as PastMatch[]);
  if (singles.length < 95) return { ok: false, detail: `only ${singles.length} singles matches` };

  const finals = singles.filter((m) => FINAL_ROUND_IDS.has(m.roundId ?? -1));
  if (finals.length !== 1) return { ok: false, detail: `${finals.length} final-round matches` };

  const datesOk = singles.every((m) => !m.date || inWindow(m.date, ed.window));
  if (!datesOk) return { ok: false, detail: "matches outside slam date window" };

  if (ed.championId !== null) {
    const f = finals[0];
    if (f.player1Id !== ed.championId && f.player2Id !== ed.championId) {
      return { ok: false, detail: `champion ${ed.championId} not in final (${f.player1Id} vs ${f.player2Id})` };
    }
  } else {
    const hasFirstRound = singles.some((m) => m.roundId === 4);
    if (!hasFirstRound) return { ok: false, detail: "no round-id-4 (R128) matches" };
  }
  return { ok: true, detail: `${singles.length} matches, final ${finals[0].player1Id} vs ${finals[0].player2Id}` };
}

async function main() {
  const verified: { slam: string; year: number; tour: string; seasonId: string }[] = [];
  const failed: string[] = [];

  for (const ed of EDITIONS) {
    const label = `${ed.slam} ${ed.year} ${ed.tour}`;
    let found = false;

    for (const probeId of ed.probeIds) {
      const candidates = await collectCandidates(ed, probeId);
      if (candidates.size === 0) continue;

      for (const cand of candidates) {
        const v = await verify(ed, cand);
        if (v.ok) {
          console.log(`  ✓ ${label} → seasonId ${cand}  (${v.detail})`);
          verified.push({ slam: ed.slam, year: ed.year, tour: ed.tour, seasonId: String(cand) });
          found = true;
          break;
        } else {
          console.log(`    ✗ ${label} candidate ${cand} rejected: ${v.detail}`);
        }
      }
      if (found) break;
    }

    if (!found) {
      console.log(`  ✗ ${label} — NO verified seasonId found`);
      failed.push(label);
    }
  }

  fs.writeFileSync(
    "scripts/_verified-slam-seasons.json",
    JSON.stringify(verified, null, 2)
  );
  console.log(`\n${verified.length}/${EDITIONS.length} editions verified → scripts/_verified-slam-seasons.json`);
  if (failed.length) console.log(`Failed: ${failed.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
