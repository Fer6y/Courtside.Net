/**
 * probe-masters-seasonids.ts
 *
 * Finds the CORRECT MatchStat seasonIds for every ATP Masters 1000 / WTA 1000
 * edition 2020–2026, repairing the wrong-seasonId disease (the Masters analogue
 * of the slam bug — see docs/match-data-validation-2026-06-12.md).
 *
 * WHY the old fetch-masters got it wrong
 * ──────────────────────────────────────
 *   1. It accepted the FIRST tournamentId found in a (loose, overlapping) date
 *      window without checking the draw — so co-located challenger/ITF events
 *      (31-match draws) and adjacent Masters (Cincinnati filed as Canada) got
 *      imported under the Masters name.
 *   2. player/past-matches returns only the 10 most-recent TourRank:2 matches
 *      per page, newest-first. Without pagination, spring Masters (Mar–May)
 *      never surfaced because a player's last 10 are year-end events.
 *
 * METHOD (validated on Indian Wells 2022 ATP + Canadian Open 2022 WTA)
 * ───────────────────────────────────────────────────────────────────
 *   Per (tour, year):
 *     • Probe ranked players, PAGING past-matches (GameYear:Y;TourRank:2,
 *       pageNo 1..N, stop once a page predates the earliest window).
 *     • Collect every tournamentId with ≥1 match inside any expected window.
 *     • Verify each unique candidate via tournament/results: keep only draws
 *       with ≥ MIN_DRAW singles matches AND exactly one final.
 *     • Assign each kept candidate to the ONE expected event whose tight window
 *       fully contains the candidate's date span; per event pick the LARGEST
 *       draw. A real Masters (55/95) always dwarfs the challenger junk (31);
 *       all-dates-in-window separates back-to-back events (Canada vs Cincy).
 *   Early-exit: stop probing more players once every expected event for the
 *   (tour, year) has a verified ≥ MIN_DRAW candidate.
 *
 * Output: scripts/_verified-masters-seasons.json — consumed by
 *   cleanup-polluted-masters.ts + reimport-masters.ts. Read-only vs our DB.
 *
 * Run: npx tsx scripts/probe-masters-seasonids.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FINAL_ROUND_IDS = new Set([12, 13]);
const MIN_DRAW = 45;            // 48-draw (Paris) = 47 matches; rejects 31-draw junk
const MAX_PLAYERS = 50;
const MAX_PAGES = 7;
const ASSIGN_GUARD_DAYS = 14;   // candidate centre must be within this of an event centre
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

// ── Expected events + (generous) collection windows (MM-DD) ───────────────────
// `null` override = not held that year. Windows only gate which tournamentIds
// become candidates; the actual edition assignment is by NEAREST window centre
// (see tryAssign), so windows may overlap freely. Each window must still span
// its event's real fortnight.
interface EventDef {
  name: string;                                  // canonical DB tournament name
  surface: "Hard" | "Clay";
  tours: Array<"ATP" | "WTA">;
  start: string; end: string;                    // default MM-DD window
  overrides?: Partial<Record<number, { start: string; end: string } | null>>;
}

const EVENTS: EventDef[] = [
  { name: "Indian Wells Masters", surface: "Hard", tours: ["ATP", "WTA"],
    start: "03-01", end: "03-25",
    overrides: { 2020: null, 2021: { start: "10-01", end: "10-22" } } },
  { name: "Miami Open", surface: "Hard", tours: ["ATP", "WTA"],
    start: "03-18", end: "04-08",
    overrides: { 2020: null } },
  { name: "Monte-Carlo Masters", surface: "Clay", tours: ["ATP"],
    start: "04-06", end: "04-24",
    overrides: { 2020: null } },
  { name: "Madrid Open", surface: "Clay", tours: ["ATP", "WTA"],
    start: "04-22", end: "05-10",
    overrides: { 2020: null } },
  { name: "Italian Open", surface: "Clay", tours: ["ATP", "WTA"],
    start: "05-06", end: "05-26",
    overrides: { 2020: { start: "09-10", end: "09-24" } } },
  { name: "Canadian Open", surface: "Hard", tours: ["ATP", "WTA"],
    start: "08-01", end: "08-18",
    overrides: { 2020: null } },
  { name: "Western & Southern Open", surface: "Hard", tours: ["ATP", "WTA"],
    start: "08-12", end: "08-30",
    overrides: { 2020: { start: "08-18", end: "08-31" } } },
  { name: "Shanghai Masters", surface: "Hard", tours: ["ATP"],
    start: "09-25", end: "10-18",
    overrides: { 2020: null, 2021: null, 2022: null } },
  { name: "Paris Masters", surface: "Hard", tours: ["ATP"],
    start: "10-23", end: "11-10" },
  // ── WTA-only fall events ───────────────────────────────────────────────────
  { name: "Wuhan Open", surface: "Hard", tours: ["WTA"],
    start: "09-20", end: "10-12",
    overrides: { 2020: null, 2021: null, 2022: null } },
  { name: "China Open", surface: "Hard", tours: ["WTA"],
    start: "09-24", end: "10-18",
    overrides: { 2020: null, 2021: null, 2022: null } },
  { name: "Guadalajara Open", surface: "Hard", tours: ["WTA"],
    start: "10-14", end: "10-28",
    overrides: { 2020: null, 2023: null, 2024: null, 2025: null, 2026: null } },
];

interface Edition {
  name: string; year: number; tour: "ATP" | "WTA"; surface: "Hard" | "Clay";
  window: [string, string];
}

function buildEditions(): Edition[] {
  const out: Edition[] = [];
  for (const ev of EVENTS) {
    for (const year of YEARS) {
      const ov = ev.overrides?.[year];
      if (ov === null) continue;                 // not held
      const w = ov ?? { start: ev.start, end: ev.end };
      for (const tour of ev.tours) {
        out.push({
          name: ev.name, year, tour, surface: ev.surface,
          window: [`${year}-${w.start}`, `${year}-${w.end}`],
        });
      }
    }
  }
  return out;
}

const inWin = (d: string | undefined, [lo, hi]: [string, string]) => {
  const s = String(d ?? "").slice(0, 10);
  return s >= lo && s <= hi;
};

interface Candidate {
  seasonId: string;
  drawSize: number;
  finals: number;
  dateLo: string; dateHi: string;
  finalNames: string;
}

async function rankedIds(tour: string): Promise<string[]> {
  const r = await matchstat<any[]>(`${tour.toLowerCase()}/ranking/singles`);
  return (Array.isArray(r) ? r : [])
    .map((row) => String((row.player ?? row).id ?? "").trim())
    .filter(Boolean);
}

async function verifyCandidate(tour: string, seasonId: string): Promise<Candidate | null> {
  const res = await matchstat<any>(`${tour.toLowerCase()}/tournament/results/${seasonId}`);
  const singles: any[] = res.singles ?? res.data?.singles ?? [];
  if (singles.length < MIN_DRAW) return null;
  const finals = singles.filter((m) => FINAL_ROUND_IDS.has(m.roundId ?? -1));
  if (finals.length !== 1) return null;
  const dates = singles.map((m) => String(m.date ?? "").slice(0, 10)).filter(Boolean).sort();
  const f = finals[0];
  const winner = f.match_winner === f.player1Id ? f.player1?.name : f.player2?.name;
  return {
    seasonId,
    drawSize: singles.length,
    finals: finals.length,
    dateLo: dates[0], dateHi: dates[dates.length - 1],
    finalNames: `${f.player1?.name} d. ${f.player2?.name === winner ? f.player1?.name : f.player2?.name} → ${winner}`,
  };
}

/** Currently-staged seasonId for an edition (for the before/after report). */
async function currentSeasonId(name: string, year: number, tour: string): Promise<string | null> {
  const { data } = await supabase
    .from("api_raw_staging")
    .select("params")
    .eq("method", "get_fixtures")
    .contains("params", { slam_name: name, year: String(year), tour })
    .limit(1);
  return data?.[0]?.params?.seasonId ?? null;
}

async function main() {
  const editions = buildEditions();
  console.log(`\nProbing ${editions.length} expected Masters editions\n`);

  // group editions by tour+year for shared probe passes
  const byTourYear = new Map<string, Edition[]>();
  for (const e of editions) {
    const k = `${e.tour}|${e.year}`;
    if (!byTourYear.has(k)) byTourYear.set(k, []);
    byTourYear.get(k)!.push(e);
  }

  const verified: any[] = [];
  const unresolved: string[] = [];
  const verifiedCache = new Map<string, Candidate | null>();

  for (const [tourYear, eds] of byTourYear) {
    const [tour, yearStr] = tourYear.split("|");
    const year = Number(yearStr);
    const earliest = eds.map((e) => e.window[0]).sort()[0];
    console.log(`\n── ${tour} ${year}: ${eds.map((e) => e.name).join(", ")}`);

    const ids = await rankedIds(tour);
    const candidateTids = new Set<string>();
    const assigned = new Map<string, Candidate>();   // edition key → best candidate

    const edKey = (e: Edition) => `${e.name} ${e.year} ${e.tour}`;
    const allFound = () => eds.every((e) => assigned.has(edKey(e)));

    const winMid = (e: Edition) => (Date.parse(e.window[0]) + Date.parse(e.window[1])) / 2;
    const DAY = 24 * 60 * 60 * 1000;

    // Assign each verified candidate to the edition whose window CENTRE is
    // closest to the candidate's date centre (within ASSIGN_GUARD_DAYS); per
    // edition keep the LARGEST draw. Centre-based assignment tolerates the
    // razor-thin Canada/Cincinnati and Madrid/Rome boundaries.
    const tryAssign = async () => {
      for (const tid of [...candidateTids]) {
        if (!verifiedCache.has(tid)) {
          try { verifiedCache.set(tid, await verifyCandidate(tour, tid)); }
          catch { verifiedCache.set(tid, null); }
        }
        const cand = verifiedCache.get(tid);
        if (!cand) continue;
        const c = (Date.parse(cand.dateLo) + Date.parse(cand.dateHi)) / 2;
        let best: Edition | null = null, bestDist = Infinity;
        for (const e of eds) {
          const dist = Math.abs(winMid(e) - c);
          if (dist < bestDist) { bestDist = dist; best = e; }
        }
        if (!best || bestDist > ASSIGN_GUARD_DAYS * DAY) continue;
        const k = edKey(best);
        const prev = assigned.get(k);
        if (!prev || cand.drawSize > prev.drawSize) assigned.set(k, cand);
      }
    };

    let probed = 0;
    for (const pid of ids.slice(0, MAX_PLAYERS)) {
      if (allFound()) break;
      probed++;
      for (let page = 1; page <= MAX_PAGES; page++) {
        let rows: any[] = [];
        try {
          const pm = await matchstat<any[]>(
            `${tour.toLowerCase()}/player/past-matches/${pid}`,
            { filter: `GameYear:${year};TourRank:2`, pageNo: String(page) }
          );
          rows = Array.isArray(pm) ? pm : [];
        } catch { break; }
        if (rows.length === 0) break;
        for (const m of rows) {
          if (!m.tournamentId) continue;
          if (eds.some((e) => inWin(m.date, e.window))) candidateTids.add(String(m.tournamentId));
        }
        const oldest = String(rows[rows.length - 1]?.date ?? "").slice(0, 10);
        if (oldest && oldest < earliest) break;
      }
      // re-assign every few players (verification is cached, cheap on repeats)
      if (probed % 6 === 0) await tryAssign();
    }
    await tryAssign();

    for (const e of eds) {
      const k = edKey(e);
      const cand = assigned.get(k);
      const cur = await currentSeasonId(e.name, e.year, e.tour);
      if (cand) {
        const flag = cur === cand.seasonId ? "(unchanged)" : `(was ${cur ?? "—"})`;
        console.log(`    ✓ ${k} → ${cand.seasonId} ${flag}  draw ${cand.drawSize}, ${cand.dateLo}…${cand.dateHi}  | ${cand.finalNames}`);
        verified.push({
          name: e.name, year: e.year, tour: e.tour, surface: e.surface,
          seasonId: cand.seasonId, drawSize: cand.drawSize,
          dateLo: cand.dateLo, dateHi: cand.dateHi,
          finalNames: cand.finalNames,
          currentSeasonId: cur,
          changed: cur !== cand.seasonId,
        });
      } else {
        console.log(`    ✗ ${k} — NO verified draw found (probed ${probed} players)`);
        unresolved.push(k);
      }
    }
  }

  fs.writeFileSync(
    "scripts/_verified-masters-seasons.json",
    JSON.stringify(verified, null, 2)
  );
  const changed = verified.filter((v) => v.changed).length;
  console.log(`\n${verified.length}/${editions.length} editions verified → scripts/_verified-masters-seasons.json`);
  console.log(`  ${changed} need a different seasonId than currently staged.`);
  if (unresolved.length) console.log(`  Unresolved (${unresolved.length}): ${unresolved.join("; ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
