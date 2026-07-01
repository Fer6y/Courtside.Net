/**
 * import-wimbledon-2026.ts
 *
 * One-off LIVE import for Wimbledon 2026 (in progress) — the Phase-0 stopgap
 * from docs/live-match-refresh-plan.md. Safe to re-run every evening of the
 * fortnight: upserts are idempotent and only COMPLETED matches (those with a
 * winner) are imported, so everything visible in the catalogue is reviewable.
 *
 * HOW IT FINDS THE TOURNAMENT (identity, never date windows)
 * ──────────────────────────────────────────────────────────
 *   1. Probe the top-ranked players' past-matches (GameYear:2026, page 1–2) —
 *      the current event dominates page 1 because results are newest-first.
 *   2. Every tournamentId seen inside the Wimbledon date window is only a
 *      CANDIDATE. Each is verified via tournament/info: the name must contain
 *      "wimbledon" AND the tier must be Grand Slam. This is the guardrail
 *      against the wrong-seasonId disease (see docs/match-data-validation).
 *   3. tournament/results/{seasonId} returns the draw; rows without a
 *      match_winner (unplayed / in progress) are skipped.
 *
 * Conventions (must match the existing catalogue):
 *   - api_event_key: BARE match id (slam convention; Masters are tour-prefixed)
 *   - tournament: "Wimbledon 2026", tier grand_slam, surface Grass
 *
 * Run: npx tsx scripts/import-wimbledon-2026.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Event definition ──────────────────────────────────────────────────────────
const EVENT = {
  slamName: "Wimbledon",
  year: 2026,
  surface: "Grass" as const,
  tier: "grand_slam" as const,
  // Wide shortlist window — only gates which candidate ids get identity-checked
  windowLo: "2026-06-20",
  windowHi: "2026-07-20",
};
const TOURS = ["ATP", "WTA"] as const;
const MAX_PROBE_PLAYERS = 25;
const MAX_PAGES = 2;

// ── Field map + normalisers (proven in reimport-slams.ts) ────────────────────
const ROUND_ID_MAP: Record<number, string> = {
  4:  "Round of 128",
  5:  "Round of 64",
  6:  "Round of 32",
  7:  "Round of 16",
  9:  "Quarterfinal",
  10: "Semifinal",
  11: "Round Robin",
  12: "Final",
  13: "Final",
  14: "Round Robin",
};

function normaliseRound(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!isNaN(n) && ROUND_ID_MAP[n]) return ROUND_ID_MAP[n];
  return String(raw);
}

function normaliseDate(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function normaliseDob(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function dobToAge(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

/** Fetch ALL players — Supabase silently caps a single select at 1000 rows. */
async function fetchAllPlayers(): Promise<{ id: string; api_player_key: string }[]> {
  const all: { id: string; api_player_key: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("players")
      .select("id, api_player_key")
      .not("api_player_key", "is", null)
      .range(from, from + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

type Fixture = Record<string, unknown> & {
  player1?: { name?: string };
  player2?: { name?: string };
};

// ── Step 1: discover + identity-verify the seasonId for one tour ─────────────
async function discoverSeasonId(tour: "ATP" | "WTA"): Promise<string> {
  const t = tour.toLowerCase();
  console.log(`\n── ${tour}: discovering ${EVENT.slamName} ${EVENT.year} seasonId`);

  const rankings = await matchstat<Record<string, unknown>[]>(`${t}/ranking/singles`);
  const playerIds = (Array.isArray(rankings) ? rankings : [])
    .map((row) => String(((row.player ?? row) as Record<string, unknown>).id ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_PROBE_PLAYERS);

  // Collect candidate tournamentIds from matches inside the fortnight window
  const candidates = new Set<string>();
  for (const pid of playerIds) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      let rows: Record<string, unknown>[] = [];
      try {
        const pm = await matchstat<Record<string, unknown>[]>(
          `${t}/player/past-matches/${pid}`,
          { filter: `GameYear:${EVENT.year}`, pageNo: String(page) }
        );
        rows = Array.isArray(pm) ? pm : [];
      } catch { break; }
      if (rows.length === 0) break;
      for (const m of rows) {
        const date = normaliseDate(m.date);
        const tid = String(m.tournamentId ?? "").trim();
        if (tid && date && date >= EVENT.windowLo && date <= EVENT.windowHi) candidates.add(tid);
      }
      const oldest = normaliseDate(rows[rows.length - 1]?.date);
      if (oldest && oldest < EVENT.windowLo) break; // older than the window — stop paging
    }
    if (candidates.size > 0 && playerIds.indexOf(pid) >= 9) break; // enough evidence
  }

  if (candidates.size === 0) {
    throw new Error(`${tour}: no candidate tournamentIds found in the ${EVENT.slamName} window — has play started?`);
  }
  console.log(`   candidates in window: ${[...candidates].join(", ")}`);

  // Identity gate — tournament/info must say Wimbledon + Grand Slam tier
  const verified: { id: string; name: string; tier: string; singles: number }[] = [];
  for (const tid of candidates) {
    try {
      const info = await matchstat<Record<string, unknown>>(`${t}/tournament/info/${tid}`);
      const name = String(info.name ?? "");
      const tierStr = String(info.tier ?? "");
      const isWimbledon = name.toLowerCase().includes("wimbledon");
      const isSlamTier = tierStr.toLowerCase().includes("grand slam");
      console.log(`   info ${tid}: "${name}" [${tierStr}] → ${isWimbledon && isSlamTier ? "ACCEPT" : "reject"}`);
      if (!isWimbledon || !isSlamTier) continue;

      const res = await matchstat<Record<string, unknown>>(`${t}/tournament/results/${tid}`);
      const singles = (res.singles ?? (res.data as Record<string, unknown>)?.singles ?? []) as unknown[];
      verified.push({ id: tid, name, tier: tierStr, singles: singles.length });
    } catch (err) {
      console.log(`   info ${tid}: error — ${(err as Error).message}`);
    }
  }

  if (verified.length === 0) {
    throw new Error(`${tour}: no candidate passed the Wimbledon/Grand Slam identity check — aborting, nothing imported`);
  }
  // If several pass (shouldn't happen), take the largest draw
  verified.sort((a, b) => b.singles - a.singles);
  const chosen = verified[0];
  console.log(`   ✓ verified seasonId ${chosen.id} — "${chosen.name}" [${chosen.tier}], ${chosen.singles} singles rows so far`);
  return chosen.id;
}

// ── Steps 2–4: fetch draw, create players, upsert completed matches ──────────
async function importTour(tour: "ATP" | "WTA", seasonId: string) {
  const t = tour.toLowerCase();
  const res = await matchstat<Record<string, unknown>>(`${t}/tournament/results/${seasonId}`);
  const fixtures = (res.singles ?? (res.data as Record<string, unknown>)?.singles ?? []) as Fixture[];

  const completed = fixtures.filter((f) => {
    const w = String(f.match_winner ?? "").trim();
    return w !== "" && w !== "null" && w !== "undefined";
  });
  console.log(`\n── ${tour}: ${fixtures.length} draw rows, ${completed.length} completed`);

  // The API can publish the same match twice under different ids (seen at
  // Wimbledon 2026 R128: a live provisional row marked "completed" with the
  // score at stoppage AND a corrected "retired" row with the true winner).
  // Dedupe by (round, player-pair): prefer the row whose result_type marks a
  // special ending (retired/walkover = the correction), else the newer id.
  // Superseded ids are deleted from the DB so re-runs self-heal.
  const byPair = new Map<string, Fixture[]>();
  for (const f of completed) {
    const pair = [String(f.player1Id), String(f.player2Id)].sort().join("-");
    const key = `${f.roundId}|${pair}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(f);
  }
  const keep: Fixture[] = [];
  const superseded: string[] = [];
  for (const [, group] of byPair) {
    if (group.length === 1) { keep.push(group[0]); continue; }
    const special = group.filter((f) => String(f.result_type ?? "completed") !== "completed");
    const pool = special.length >= 1 ? special : group;
    const chosen = [...pool].sort((a, b) => Number(b.id) - Number(a.id))[0];
    keep.push(chosen);
    for (const f of group) if (f !== chosen) superseded.push(String(f.id));
  }
  if (superseded.length > 0) {
    console.log(`   deduped ${superseded.length} superseded API row(s): ${superseded.join(", ")}`);
    const { error } = await supabase.from("matches").delete().in("api_event_key", superseded);
    if (error) console.error(`   ⚠️  could not delete superseded rows: ${error.message}`);
  }

  // Refresh the staging snapshot (upsert-by-hand: params isn't a unique key)
  const { data: staged } = await supabase
    .from("api_raw_staging")
    .select("id")
    .eq("method", "get_fixtures")
    .contains("params", { seasonId, tour })
    .maybeSingle();
  const stagingRow = {
    method: "get_fixtures",
    params: { seasonId, tour, slam_name: EVENT.slamName, year: String(EVENT.year) },
    response: { singles: fixtures },
  };
  if (staged) {
    await supabase.from("api_raw_staging").update(stagingRow).eq("id", staged.id);
  } else {
    await supabase.from("api_raw_staging").insert(stagingRow);
  }

  // Create any players we haven't met yet
  const referenced = new Set<string>();
  for (const f of keep) {
    const p1 = String(f.player1Id ?? "").trim();
    const p2 = String(f.player2Id ?? "").trim();
    if (p1) referenced.add(p1);
    if (p2) referenced.add(p2);
  }
  let players = await fetchAllPlayers();
  const known = new Set(players.map((p) => String(p.api_player_key)));
  const missing = [...referenced].filter((id) => !known.has(id));
  console.log(`   players referenced: ${referenced.size}, missing from DB: ${missing.length}`);

  for (const playerId of missing) {
    try {
      const profile = await matchstat<Record<string, unknown>>(
        `${t}/player/profile/${playerId}`,
        { include: "ranking,country" }
      );
      const dobIso = normaliseDob(profile.dob);
      const { error } = await supabase.from("players").upsert(
        {
          name:           profile.name ?? "Unknown",
          country:        profile.country ?? null,
          age:            dobToAge(dobIso),
          photo_url:      profile.photo ?? null,
          api_player_key: String(profile.id ?? playerId),
          career_stats: {
            tour,
            dob:          dobIso,
            country_full: profile.country ?? null,
          },
        },
        { onConflict: "api_player_key" }
      );
      if (error) throw new Error(error.message);
      console.log(`   + created player ${profile.name} (${playerId})`);
    } catch (err) {
      console.error(`   ⚠️  player ${playerId}: ${(err as Error).message}`);
    }
  }

  // Upsert completed matches — bare api_event_key (slam convention)
  players = await fetchAllPlayers();
  const playerMap = new Map(players.map((p) => [String(p.api_player_key), p.id]));

  const batch: object[] = [];
  let skipped = 0;
  for (const f of keep) {
    const eventKey = String(f.id ?? "").trim();
    const p1Key = String(f.player1Id ?? "").trim();
    const p2Key = String(f.player2Id ?? "").trim();
    if (!eventKey || !p1Key || !p2Key) { skipped++; continue; }
    const p1 = playerMap.get(p1Key);
    const p2 = playerMap.get(p2Key);
    if (!p1 || !p2) { skipped++; continue; }

    const winnerRaw = String(f.match_winner ?? "");
    const winnerId = winnerRaw === p1Key ? p1 : winnerRaw === p2Key ? p2 : null;
    if (!winnerId) { skipped++; continue; } // completed = must have a resolvable winner

    batch.push({
      player1_id:        p1,
      player2_id:        p2,
      winner_id:         winnerId,
      tournament:        `${EVENT.slamName} ${EVENT.year}`,
      round:             normaliseRound(f.roundId),
      score:             f.result ? String(f.result) : null,
      surface:           EVENT.surface,
      match_date:        normaliseDate(f.date),
      api_event_key:     eventKey,
      tournament_season: EVENT.year,
      tournament_tier:   EVENT.tier,
      source:            "api_tennis",
      tour,
    });
  }

  for (let i = 0; i < batch.length; i += 100) {
    const { error } = await supabase
      .from("matches")
      .upsert(batch.slice(i, i + 100), { onConflict: "api_event_key" });
    if (error) throw error;
  }
  console.log(`   ✓ ${batch.length} matches upserted${skipped ? `, ${skipped} skipped` : ""}`);
}

// ── Step 5: structural validation (live mode — draw is partial mid-event) ────
async function validateLive() {
  console.log(`\n── Validation (live mode)`);
  const { data: rows, error } = await supabase
    .from("matches")
    .select("tour, round, match_date, player1_id, player2_id")
    .eq("tournament", `${EVENT.slamName} ${EVENT.year}`);
  if (error) throw error;

  let failures = 0;
  for (const tour of TOURS) {
    const g = (rows ?? []).filter((r) => r.tour === tour);
    const finals = g.filter((r) => r.round === "Final").length;
    const rr = g.filter((r) => r.round === "Round Robin").length;
    const nullR = g.filter((r) => !r.round).length;
    const badDate = g.filter(
      (r) => !r.match_date || r.match_date < EVENT.windowLo || r.match_date > EVENT.windowHi
    ).length;
    const pairs = new Set<string>();
    let dupPairs = 0;
    for (const r of g) {
      const key = `${r.round}|${[r.player1_id, r.player2_id].sort().join("-")}`;
      if (pairs.has(key)) dupPairs++;
      pairs.add(key);
    }
    const problems: string[] = [];
    if (finals > 1) problems.push(`${finals} Finals`);
    if (rr > 0) problems.push(`${rr} Round Robin rows`);
    if (nullR > 0) problems.push(`${nullR} null rounds`);
    if (badDate > 0) problems.push(`${badDate} dates outside the fortnight`);
    if (dupPairs > 0) problems.push(`${dupPairs} duplicate player-pairs in a round`);
    if (problems.length) {
      failures++;
      console.log(`   ✗ ${tour}: ${g.length} rows — ${problems.join("; ")}`);
    } else {
      console.log(`   ✓ ${tour}: ${g.length} rows, ${finals} final, rounds + dates clean`);
    }
  }
  if (failures > 0) throw new Error("Live validation failed — inspect the rows above");
  console.log(`   (full draw-size validation runs once the event completes)`);
}

async function main() {
  console.log(`\nimport-wimbledon-2026 — live import, completed matches only`);
  for (const tour of TOURS) {
    const seasonId = await discoverSeasonId(tour);
    await importTour(tour, seasonId);
  }
  await validateLive();
  console.log(`\n  ✓ Done. Re-run any evening of the fortnight to pick up new results.\n`);
}

main().catch((e) => {
  console.error(`\nABORTED: ${(e as Error).message}\n`);
  process.exit(1);
});
