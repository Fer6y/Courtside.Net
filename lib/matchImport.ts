/**
 * lib/matchImport.ts
 *
 * The live match-import engine behind /api/cron/refresh-matches (and any
 * manual import script). Everything here was proven in production first:
 * the field map and normalisers by 13k imported matches (reimport-slams),
 * identity-gated discovery by the Masters cleanup (probe-masters-seasonids)
 * and the Wimbledon 2026 live import (scripts/import-wimbledon-2026.ts).
 *
 * Data-quality rules (docs/live-match-refresh-plan.md):
 *   - identity via tournament/info (name + tier), never date windows
 *   - completed matches only (match_winner present) — everything visible
 *     in the catalogue is reviewable
 *   - api_event_key: Grand Slams use the bare match id, Masters are
 *     tour-prefixed (`ATP-<id>` / `WTA-<id>`) because raw ids overlap
 *   - dedupe duplicate provisional rows (same round + player pair under
 *     two ids); prefer the corrected retired/walkover row, else newer id
 *   - all player lookups paged (the 1,000-row cap bites at 1,408 players)
 *
 * SERVER-SIDE ONLY — imports lib/matchstat.ts (API key).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { matchstat } from "./matchstat";
import { identityMatches, type TrackedEvent } from "./tournamentCalendar";

export type Tour = "ATP" | "WTA";

// ── Normalisers (field names confirmed against the API since phase 0) ────────

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

const FINAL_ROUND_IDS = new Set([12, 13]);

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

/** Slams store the bare API match id; Masters are tour-prefixed. */
function eventKeyFor(tier: TrackedEvent["tier"], tour: Tour, rawId: string): string {
  return tier === "masters_1000" ? `${tour}-${rawId}` : rawId;
}

/** Every player with an api_player_key — paged past the 1,000-row cap. */
async function fetchPlayerMap(db: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("players")
      .select("id, api_player_key")
      .not("api_player_key", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(`players fetch: ${error.message}`);
    for (const p of data ?? []) map.set(String(p.api_player_key), p.id);
    if (!data || data.length < 1000) break;
  }
  return map;
}

type Fixture = Record<string, unknown>;

async function fetchDraw(tour: Tour, seasonId: string): Promise<Fixture[]> {
  const res = await matchstat<Record<string, unknown>>(
    `${tour.toLowerCase()}/tournament/results/${seasonId}`
  );
  return (res.singles ?? (res.data as Record<string, unknown>)?.singles ?? []) as Fixture[];
}

// ── Discovery ─────────────────────────────────────────────────────────────────

export interface DiscoveryResult {
  event: TrackedEvent;
  seasonId: string;
  infoName: string;
  infoTier: string;
}

/**
 * Find seasonIds for the target events on one tour. Probes top-ranked
 * players' recent matches for candidate tournamentIds inside the window
 * union, then verifies each candidate's IDENTITY via tournament/info.
 * Probing only top-ranked players also means qualifying draws never enter
 * the candidate set (top players don't play qualifying).
 *
 * Returns only verified finds; an event not yet in the feed (play hasn't
 * started) is simply absent and will be found on a later run.
 */
export async function discoverSeasonIds(
  tour: Tour,
  year: number,
  targets: TrackedEvent[],
  opts: { maxPlayers?: number; maxPages?: number } = {}
): Promise<DiscoveryResult[]> {
  if (targets.length === 0) return [];
  const t = tour.toLowerCase();
  const maxPlayers = opts.maxPlayers ?? 10;
  const maxPages = opts.maxPages ?? 2;

  const windowLo = `${year}-${targets.map((e) => e.windowLo).sort()[0]}`;
  const windowHi = `${year}-${targets.map((e) => e.windowHi).sort().at(-1)}`;

  const rankings = await matchstat<Record<string, unknown>[]>(`${t}/ranking/singles`);
  const playerIds = (Array.isArray(rankings) ? rankings : [])
    .map((row) => String(((row.player ?? row) as Record<string, unknown>).id ?? "").trim())
    .filter(Boolean)
    .slice(0, maxPlayers);

  const candidates = new Set<string>();
  for (const pid of playerIds) {
    for (let page = 1; page <= maxPages; page++) {
      let rows: Fixture[] = [];
      try {
        const pm = await matchstat<Fixture[]>(`${t}/player/past-matches/${pid}`, {
          filter: `GameYear:${year}`,
          pageNo: String(page),
        });
        rows = Array.isArray(pm) ? pm : [];
      } catch {
        break;
      }
      if (rows.length === 0) break;
      for (const m of rows) {
        const date = normaliseDate(m.date);
        const tid = String(m.tournamentId ?? "").trim();
        if (tid && date && date >= windowLo && date <= windowHi) candidates.add(tid);
      }
      const oldest = normaliseDate(rows[rows.length - 1]?.date);
      if (oldest && oldest < windowLo) break;
    }
  }
  if (candidates.size === 0) return [];

  // Identity-check every candidate once, then match against each target.
  const infos = new Map<string, { name: string; tier: string }>();
  for (const tid of candidates) {
    try {
      const info = await matchstat<Record<string, unknown>>(`${t}/tournament/info/${tid}`);
      infos.set(tid, { name: String(info.name ?? ""), tier: String(info.tier ?? "") });
    } catch {
      // unidentifiable candidate — ignore
    }
  }

  const results: DiscoveryResult[] = [];
  for (const event of targets) {
    const matching: { tid: string; name: string; tier: string; draw: number }[] = [];
    for (const [tid, info] of infos) {
      if (!identityMatches(event, info.name, info.tier)) continue;
      let draw = 0;
      try { draw = (await fetchDraw(tour, tid)).length; } catch { /* keep 0 */ }
      matching.push({ tid, name: info.name, tier: info.tier, draw });
    }
    if (matching.length === 0) continue;
    matching.sort((a, b) => b.draw - a.draw); // several passing = keep largest draw
    const best = matching[0];
    results.push({ event, seasonId: best.tid, infoName: best.name, infoTier: best.tier });
  }
  return results;
}

// ── Import one tournament ─────────────────────────────────────────────────────

export interface ImportSummary {
  drawRows: number;
  completedRows: number;
  newMatches: number;
  upserted: number;
  playersCreated: number;
  superseded: number;
  finalCompleted: boolean;
  problems: string[];
}

export async function importTournament(
  db: SupabaseClient,
  args: {
    event: TrackedEvent;
    tour: Tour;
    year: number;
    seasonId: string;
    maxNewPlayers?: number;
  }
): Promise<ImportSummary> {
  const { event, tour, year, seasonId } = args;
  const maxNewPlayers = args.maxNewPlayers ?? 20;
  const t = tour.toLowerCase();
  const label = `${event.name} ${year}`;

  const fixtures = await fetchDraw(tour, seasonId);
  const completed = fixtures.filter((f) => {
    const w = String(f.match_winner ?? "").trim();
    return w !== "" && w !== "null" && w !== "undefined";
  });

  // Dedupe duplicate provisional rows: same (round, player pair) under two
  // ids. Prefer the corrected special-ending row, else the newer id; delete
  // superseded ids from the DB so every poll self-heals.
  const byPair = new Map<string, Fixture[]>();
  for (const f of completed) {
    const pair = [String(f.player1Id), String(f.player2Id)].sort().join("-");
    const key = `${f.roundId}|${pair}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(f);
  }
  const keep: Fixture[] = [];
  const supersededKeys: string[] = [];
  for (const [, group] of byPair) {
    if (group.length === 1) { keep.push(group[0]); continue; }
    const special = group.filter((f) => String(f.result_type ?? "completed") !== "completed");
    const pool = special.length >= 1 ? special : group;
    const chosen = [...pool].sort((a, b) => Number(b.id) - Number(a.id))[0];
    keep.push(chosen);
    for (const f of group) {
      if (f !== chosen) supersededKeys.push(eventKeyFor(event.tier, tour, String(f.id)));
    }
  }
  if (supersededKeys.length > 0) {
    await db.from("matches").delete().in("api_event_key", supersededKeys);
  }

  // Refresh the staging snapshot — this is also the pipeline's seasonId
  // cache: a (slam_name, year, tour) staging row means "already discovered".
  const stagingParams = {
    seasonId, tour, slam_name: event.name, year: String(year),
    surface: event.surface, tournament_tier: event.tier,
  };
  const { data: staged } = await db
    .from("api_raw_staging")
    .select("id")
    .eq("method", "get_fixtures")
    .contains("params", { seasonId, tour })
    .maybeSingle();
  if (staged) {
    await db.from("api_raw_staging")
      .update({ params: stagingParams, response: { singles: fixtures } })
      .eq("id", staged.id);
  } else {
    await db.from("api_raw_staging")
      .insert({ method: "get_fixtures", params: stagingParams, response: { singles: fixtures } });
  }

  // Create players we haven't met yet (capped per run — converges).
  const referenced = new Set<string>();
  for (const f of keep) {
    const p1 = String(f.player1Id ?? "").trim();
    const p2 = String(f.player2Id ?? "").trim();
    if (p1) referenced.add(p1);
    if (p2) referenced.add(p2);
  }
  let playerMap = await fetchPlayerMap(db);
  const missing = [...referenced].filter((id) => !playerMap.has(id));
  let playersCreated = 0;
  for (const playerId of missing.slice(0, maxNewPlayers)) {
    try {
      const profile = await matchstat<Record<string, unknown>>(
        `${t}/player/profile/${playerId}`,
        { include: "ranking,country" }
      );
      const dobIso = normaliseDob(profile.dob);
      const { error } = await db.from("players").upsert(
        {
          name:           profile.name ?? "Unknown",
          country:        profile.country ?? null,
          age:            dobToAge(dobIso),
          photo_url:      profile.photo ?? null,
          api_player_key: String(profile.id ?? playerId),
          career_stats:   { tour, dob: dobIso, country_full: profile.country ?? null },
        },
        { onConflict: "api_player_key" }
      );
      if (error) throw new Error(error.message);
      playersCreated++;
    } catch {
      // next run retries; the match rows for this player skip until then
    }
  }
  if (playersCreated > 0) playerMap = await fetchPlayerMap(db);

  // Which matches are actually NEW (for meaningful logs)?
  const { data: existingRows } = await db
    .from("matches")
    .select("api_event_key")
    .eq("tournament", label)
    .eq("tour", tour);
  const existingKeys = new Set((existingRows ?? []).map((r) => String(r.api_event_key)));

  // Upsert completed matches.
  const batch: Record<string, unknown>[] = [];
  let newMatches = 0;
  for (const f of keep) {
    const rawId = String(f.id ?? "").trim();
    const p1Key = String(f.player1Id ?? "").trim();
    const p2Key = String(f.player2Id ?? "").trim();
    if (!rawId || !p1Key || !p2Key) continue;
    const p1 = playerMap.get(p1Key);
    const p2 = playerMap.get(p2Key);
    if (!p1 || !p2) continue;

    const winnerRaw = String(f.match_winner ?? "");
    const winnerId = winnerRaw === p1Key ? p1 : winnerRaw === p2Key ? p2 : null;
    if (!winnerId) continue;

    const eventKey = eventKeyFor(event.tier, tour, rawId);
    if (!existingKeys.has(eventKey)) newMatches++;
    batch.push({
      player1_id:        p1,
      player2_id:        p2,
      winner_id:         winnerId,
      tournament:        label,
      round:             normaliseRound(f.roundId),
      score:             f.result ? String(f.result) : null,
      surface:           event.surface,
      match_date:        normaliseDate(f.date),
      api_event_key:     eventKey,
      tournament_season: year,
      tournament_tier:   event.tier,
      source:            "api_tennis",
      tour,
    });
  }
  for (let i = 0; i < batch.length; i += 100) {
    const { error } = await db
      .from("matches")
      .upsert(batch.slice(i, i + 100), { onConflict: "api_event_key" });
    if (error) throw new Error(`match upsert (${label} ${tour}): ${error.message}`);
  }

  const finalCompleted = keep.some(
    (f) => FINAL_ROUND_IDS.has(Number(f.roundId)) && String(f.match_winner ?? "").trim() !== ""
  );

  const problems = await validateLive(db, label, tour, year, event);

  return {
    drawRows: fixtures.length,
    completedRows: completed.length,
    newMatches,
    upserted: batch.length,
    playersCreated,
    superseded: supersededKeys.length,
    finalCompleted,
    problems,
  };
}

// ── Live structural validation ────────────────────────────────────────────────

/** Structure-only checks (draw-size bounds only apply once the event ends). */
async function validateLive(
  db: SupabaseClient,
  label: string,
  tour: Tour,
  year: number,
  event: TrackedEvent
): Promise<string[]> {
  const { data: rows, error } = await db
    .from("matches")
    .select("round, match_date, player1_id, player2_id")
    .eq("tournament", label)
    .eq("tour", tour);
  if (error) return [`validation query failed: ${error.message}`];

  const g = rows ?? [];
  const problems: string[] = [];
  const finals = g.filter((r) => r.round === "Final").length;
  const rr = g.filter((r) => r.round === "Round Robin").length;
  const nullR = g.filter((r) => !r.round).length;
  const lo = `${year}-${event.windowLo}`;
  const hi = `${year}-${event.windowHi}`;
  const badDate = g.filter((r) => !r.match_date || r.match_date < lo || r.match_date > hi).length;
  const pairs = new Set<string>();
  let dupPairs = 0;
  for (const r of g) {
    const key = `${r.round}|${[r.player1_id, r.player2_id].sort().join("-")}`;
    if (pairs.has(key)) dupPairs++;
    pairs.add(key);
  }
  if (finals > 1) problems.push(`${finals} Finals`);
  if (rr > 0) problems.push(`${rr} Round Robin rows`);
  if (nullR > 0) problems.push(`${nullR} null rounds`);
  if (badDate > 0) problems.push(`${badDate} dates outside the window`);
  if (dupPairs > 0) problems.push(`${dupPairs} duplicate player-pairs in a round`);
  return problems;
}

// ── Rankings sync (runs when an event completes) ──────────────────────────────

/**
 * Refresh players.current_rank from the live tour rankings — the logic of
 * scripts/sync-live-rankings.ts, applied without a dry-run step. Players in
 * the live list get their live position; stale occupiers of a covered rank
 * get nulled; everyone else is left alone.
 */
export async function syncRankings(
  db: SupabaseClient
): Promise<{ corrected: number; cleared: number }> {
  const live: Record<Tour, Map<string, number>> = { ATP: new Map(), WTA: new Map() };
  let liveMax = 0;
  for (const tour of ["ATP", "WTA"] as Tour[]) {
    const arr = await matchstat<Array<{ position: number; player?: { id: number } }>>(
      `${tour.toLowerCase()}/ranking/singles`
    );
    for (const e of Array.isArray(arr) ? arr : []) {
      if (e.player?.id == null) continue;
      live[tour].set(String(e.player.id), e.position);
      if (e.position > liveMax) liveMax = e.position;
    }
  }

  interface PlayerRow {
    id: string;
    current_rank: number | null;
    api_player_key: string | null;
    career_stats: { tour?: string } | null;
  }
  const players: PlayerRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("players")
      .select("id, current_rank, api_player_key, career_stats")
      .not("api_player_key", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(`players fetch: ${error.message}`);
    players.push(...((data ?? []) as PlayerRow[]));
    if (!data || data.length < 1000) break;
  }

  let corrected = 0;
  let cleared = 0;
  for (const p of players) {
    const tour = p.career_stats?.tour as Tour | undefined;
    if (tour !== "ATP" && tour !== "WTA") continue;
    const livePos = live[tour].get(String(p.api_player_key));
    let next: number | null | undefined;
    if (livePos != null) next = livePos;
    else if (p.current_rank != null && p.current_rank <= liveMax) next = null;
    else next = undefined;
    if (next === undefined || next === p.current_rank) continue;
    const { error } = await db.from("players").update({ current_rank: next }).eq("id", p.id);
    if (!error) {
      if (next === null) cleared++;
      else corrected++;
    }
  }
  return { corrected, cleared };
}
