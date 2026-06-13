/**
 * probe-masters-seasonids.ts
 *
 * Finds the CORRECT MatchStat seasonIds for every ATP Masters 1000 / WTA 1000
 * edition 2020–2026, repairing the wrong-seasonId disease (the Masters analogue
 * of the slam bug — see docs/match-data-validation-2026-06-12.md).
 *
 * WHY the old data was wrong
 * ──────────────────────────
 *   The original import accepted tournamentIds by loose DATE WINDOW without
 *   checking what the tournament actually was, so it swept in:
 *     • co-located challenger/ITF events (31-match draws),
 *     • the wrong adjacent Masters (Cincinnati filed as Canada; Wuhan/Beijing
 *       swapped),
 *     • the Olympics (Tokyo 2021 / Paris 2024 sit next to the Canada week).
 *
 * METHOD — identity by tournament/info, not by date
 * ─────────────────────────────────────────────────
 *   The API has tournament/info/{seasonId} → { name, tier, court, date }.
 *   Name is "<Event> - <City>", tier is "ATP World Tour Masters 1000" /
 *   "WTA 1000" (Olympics = "Olympic Tennis Event", challengers = "Future").
 *   So per (tour, year):
 *     • Probe ranked players, PAGING past-matches (GameYear:Y;TourRank:2) —
 *       paging is required or spring Masters never surface (the endpoint
 *       returns only the 10 most-recent per page, newest-first).
 *     • Collect every tournamentId seen.
 *     • tournament/info each unique id; keep those whose NAME maps to a known
 *       Masters event (city/event match) — this alone excludes the Olympics,
 *       challengers, ATP/WTA Finals, Davis/BJK Cup.
 *     • Verify the draw via tournament/results (≥45 singles, exactly 1 final);
 *       per (event, year) keep the largest such draw.
 *   Early-exit: stop probing once every expected event for the (tour, year)
 *   has a verified candidate.
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
const MIN_DRAW = 45;
const MAX_PLAYERS = 60;
const MAX_PAGES = 8;
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

// ── Expected events: canonical DB name, surface, tours, name-match patterns,
//    and the years each is NOT held (cancellations / didn't exist). ───────────
interface EventDef {
  name: string;
  surface: "Hard" | "Clay";
  tours: Array<"ATP" | "WTA">;
  patterns: string[];                 // lower-case substrings of tournament/info name
  notHeld?: Partial<Record<number, Array<"ATP" | "WTA"> | true>>; // true = both tours
}

const EVENTS: EventDef[] = [
  { name: "Indian Wells Masters", surface: "Hard", tours: ["ATP", "WTA"],
    patterns: ["indian wells", "bnp paribas open"], notHeld: { 2020: true } },
  { name: "Miami Open", surface: "Hard", tours: ["ATP", "WTA"],
    patterns: ["miami"], notHeld: { 2020: true } },
  { name: "Monte-Carlo Masters", surface: "Clay", tours: ["ATP"],
    patterns: ["monte", "monaco"], notHeld: { 2020: true } },
  { name: "Madrid Open", surface: "Clay", tours: ["ATP", "WTA"],
    patterns: ["madrid"], notHeld: { 2020: true } },
  { name: "Italian Open", surface: "Clay", tours: ["ATP", "WTA"],
    patterns: ["rome", "italia", "internazionali"] },
  // Fall 2026 events are still in the future (today = 2026-06-12) → not held yet.
  { name: "Canadian Open", surface: "Hard", tours: ["ATP", "WTA"],
    patterns: ["canada", "canadian", "rogers", "national bank", "toronto", "montreal"],
    notHeld: { 2020: true, 2026: true } },
  { name: "Western & Southern Open", surface: "Hard", tours: ["ATP", "WTA"],
    patterns: ["cincinnati", "western & southern", "western and southern"],
    notHeld: { 2026: true } },
  { name: "Shanghai Masters", surface: "Hard", tours: ["ATP"],
    patterns: ["shanghai"], notHeld: { 2020: true, 2021: true, 2022: true, 2026: true } },
  { name: "Paris Masters", surface: "Hard", tours: ["ATP"],
    patterns: ["paris", "bercy"], notHeld: { 2026: true } },
  { name: "Wuhan Open", surface: "Hard", tours: ["WTA"],
    patterns: ["wuhan"], notHeld: { 2020: true, 2021: true, 2022: true, 2026: true } },
  { name: "China Open", surface: "Hard", tours: ["WTA"],
    patterns: ["beijing", "china open"], notHeld: { 2020: true, 2021: true, 2022: true, 2026: true } },
  { name: "Guadalajara Open", surface: "Hard", tours: ["WTA"],
    patterns: ["guadalajara"],
    notHeld: { 2020: true, 2021: true, 2023: true, 2024: true, 2025: true, 2026: true } },
];

function isHeld(ev: EventDef, year: number, tour: "ATP" | "WTA"): boolean {
  if (!ev.tours.includes(tour)) return false;
  const nh = ev.notHeld?.[year];
  if (nh === true) return false;
  if (Array.isArray(nh) && nh.includes(tour)) return false;
  return true;
}

/**
 * Tier gate — accept only Masters 1000 / WTA 1000 (incl. older WTA "Premier"
 * naming). Excludes Grand Slams (Roland Garros is *in* Paris and would match
 * the "paris" pattern), the Olympics, ATP/WTA Finals, Davis/BJK Cup, and
 * challengers/futures by identity rather than by date.
 */
function isMastersTier(tier: string): boolean {
  const t = (tier ?? "").toLowerCase();
  return t.includes("1000") || t.includes("premier");
}

/** Map a tournament/info name to a canonical event (or null). */
function matchEvent(infoName: string): EventDef | null {
  const n = (infoName ?? "").toLowerCase();
  // Paris vs Indian Wells share the "BNP Paribas" sponsor — disambiguate first.
  if (n.includes("indian wells") || n.includes("bnp paribas open")) {
    return EVENTS.find((e) => e.name === "Indian Wells Masters")!;
  }
  for (const ev of EVENTS) {
    if (ev.patterns.some((p) => n.includes(p))) return ev;
  }
  return null;
}

interface Info { name: string; tier: string; surface: string; date: string }
interface Draw { drawSize: number; finals: number; dateLo: string; dateHi: string; finalNames: string }

async function rankedIds(tour: string): Promise<string[]> {
  const r = await matchstat<any[]>(`${tour.toLowerCase()}/ranking/singles`);
  return (Array.isArray(r) ? r : [])
    .map((row) => String((row.player ?? row).id ?? "").trim())
    .filter(Boolean);
}

async function fetchInfo(tour: string, id: string): Promise<Info | null> {
  try {
    const r = await matchstat<any>(`${tour.toLowerCase()}/tournament/info/${id}`);
    return { name: r.name ?? "", tier: r.tier ?? "", surface: r.court?.name ?? "", date: String(r.date ?? "").slice(0, 10) };
  } catch { return null; }
}

async function fetchDraw(tour: string, id: string): Promise<Draw | null> {
  const res = await matchstat<any>(`${tour.toLowerCase()}/tournament/results/${id}`);
  const singles: any[] = res.singles ?? res.data?.singles ?? [];
  if (singles.length < MIN_DRAW) return null;
  const finals = singles.filter((m) => FINAL_ROUND_IDS.has(m.roundId ?? -1));
  if (finals.length !== 1) return null;
  const dates = singles.map((m) => String(m.date ?? "").slice(0, 10)).filter(Boolean).sort();
  const f = finals[0];
  const winner = f.match_winner === f.player1Id ? f.player1?.name : f.player2?.name;
  const loser  = f.match_winner === f.player1Id ? f.player2?.name : f.player1?.name;
  return {
    drawSize: singles.length, finals: finals.length,
    dateLo: dates[0], dateHi: dates[dates.length - 1],
    finalNames: `${winner} d. ${loser}`,
  };
}

async function currentSeasonId(name: string, year: number, tour: string): Promise<string | null> {
  const { data } = await supabase
    .from("api_raw_staging").select("params").eq("method", "get_fixtures")
    .contains("params", { slam_name: name, year: String(year), tour }).limit(1);
  return data?.[0]?.params?.seasonId ?? null;
}

async function main() {
  // expected editions
  const editions: { name: string; year: number; tour: "ATP" | "WTA"; surface: "Hard" | "Clay" }[] = [];
  for (const ev of EVENTS) for (const year of YEARS) for (const tour of ev.tours) {
    if (isHeld(ev, year, tour)) editions.push({ name: ev.name, year, tour, surface: ev.surface });
  }
  console.log(`\nProbing ${editions.length} expected Masters editions\n`);

  const verified: any[] = [];
  const unresolved: string[] = [];
  const infoCache = new Map<string, Info | null>();   // key tour:id
  const drawCache = new Map<string, Draw | null>();    // key tour:id

  const byTourYear = new Map<string, typeof editions>();
  for (const e of editions) {
    const k = `${e.tour}|${e.year}`;
    if (!byTourYear.has(k)) byTourYear.set(k, []);
    byTourYear.get(k)!.push(e);
  }

  for (const [tourYear, eds] of byTourYear) {
    const [tour, yearStr] = tourYear.split("|");
    const year = Number(yearStr);
    console.log(`\n── ${tour} ${year}: ${eds.map((e) => e.name).join(", ")}`);

    const ids = await rankedIds(tour);
    const seenTids = new Set<string>();
    const assigned = new Map<string, { seasonId: string; info: Info; draw: Draw }>(); // event name → best

    const tryAssign = async () => {
      for (const tid of [...seenTids]) {
        const ik = `${tour}:${tid}`;
        if (!infoCache.has(ik)) infoCache.set(ik, await fetchInfo(tour, tid));
        const info = infoCache.get(ik);
        if (!info) continue;
        if (!isMastersTier(info.tier)) continue;                       // not a 1000-tier event (slam/Olympics/Finals)
        const ev = matchEvent(info.name);
        if (!ev || !eds.some((e) => e.name === ev.name)) continue;     // not an expected event this year
        if (info.date && !info.date.startsWith(String(year))) continue; // wrong year
        if (!drawCache.has(ik)) {
          try { drawCache.set(ik, await fetchDraw(tour, tid)); } catch { drawCache.set(ik, null); }
        }
        const draw = drawCache.get(ik);
        if (!draw) continue;
        const prev = assigned.get(ev.name);
        if (!prev || draw.drawSize > prev.draw.drawSize) assigned.set(ev.name, { seasonId: tid, info, draw });
      }
    };
    const allFound = () => eds.every((e) => assigned.has(e.name));

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
        for (const m of rows) if (m.tournamentId) seenTids.add(String(m.tournamentId));
        const oldest = String(rows[rows.length - 1]?.date ?? "").slice(0, 10);
        if (oldest && oldest < `${year}-01-01`) break;
      }
      if (probed % 5 === 0) await tryAssign();
    }
    await tryAssign();

    for (const e of eds) {
      const a = assigned.get(e.name);
      const cur = await currentSeasonId(e.name, e.year, e.tour);
      if (a) {
        const flag = cur === a.seasonId ? "(unchanged)" : `(was ${cur ?? "—"})`;
        console.log(`    ✓ ${e.name} ${e.year} ${e.tour} → ${a.seasonId} ${flag}  "${a.info.name}" [${a.info.tier}] draw ${a.draw.drawSize}, ${a.draw.dateLo}…${a.draw.dateHi} | ${a.draw.finalNames}`);
        verified.push({
          name: e.name, year: e.year, tour: e.tour,
          surface: (a.info.surface === "Clay" || a.info.surface === "Hard") ? a.info.surface : e.surface,
          seasonId: a.seasonId, infoName: a.info.name, tier: a.info.tier,
          drawSize: a.draw.drawSize, dateLo: a.draw.dateLo, dateHi: a.draw.dateHi,
          finalNames: a.draw.finalNames, currentSeasonId: cur, changed: cur !== a.seasonId,
        });
      } else {
        console.log(`    ✗ ${e.name} ${e.year} ${e.tour} — NO Masters draw found (probed ${probed})`);
        unresolved.push(`${e.name} ${e.year} ${e.tour}`);
      }
    }
  }

  fs.writeFileSync("scripts/_verified-masters-seasons.json", JSON.stringify(verified, null, 2));
  const changed = verified.filter((v) => v.changed).length;
  console.log(`\n${verified.length}/${editions.length} editions verified → scripts/_verified-masters-seasons.json`);
  console.log(`  ${changed} need a different seasonId than currently staged.`);
  if (unresolved.length) console.log(`  Unresolved (${unresolved.length}): ${unresolved.join("; ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
