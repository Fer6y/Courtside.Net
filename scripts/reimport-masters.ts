/**
 * reimport-masters.ts
 *
 * Re-imports every Masters 1000 edition in scripts/_verified-masters-seasons.json
 * using the verified seasonIds from probe-masters-seasonids.ts. Targeted
 * phase2b → 2c → 2d pipeline (stage → create players → upsert matches).
 *
 * Processes ALL verified editions, not just the changed ones, because every
 * pre-existing Masters row was labelled with the SLAM round map (absolute
 * roundId → name), which is wrong for 56/96-draws. Re-importing with the
 * draw-size-agnostic round labeller below rewrites those rounds in place
 * (upsert on api_event_key) and fills any matches the first import skipped.
 *
 *   • Changed editions: staging was deleted by cleanup-polluted-masters.ts, so
 *     fixtures are fetched fresh here.
 *   • Unchanged editions: staging already present → no API fetch, just reprocess.
 *
 * ROUND LABELLING (see _probe-rounds.ts findings)
 * ───────────────────────────────────────────────
 * roundIds are positional, not absolute: roundId 4 = first round in BOTH a
 * 96-draw (32 matches) and a 56-draw (24 matches), and 56/48-draws skip
 * roundId 7. So we order the draw's distinct roundIds ascending and assign
 * names counting BACK from the final — guaranteeing exactly one "Final".
 *
 * Run: npx tsx scripts/reimport-masters.ts
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

const FIELD_MAP = {
  event_key:  "id",
  date:       "date",
  player1_id: "player1Id",
  player2_id: "player2Id",
  winner:     "match_winner",
  score:      "result",
  round:      "roundId",
} as const;

const ROUND_LADDER = [
  "Final", "Semifinal", "Quarterfinal",
  "Round of 16", "Round of 32", "Round of 64", "Round of 128", "Round of 256",
];

/** Map this draw's distinct roundIds → names, counting back from the final. */
function buildRoundLabels(fixtures: Record<string, unknown>[]): Map<number, string> {
  const ids = [...new Set(
    fixtures.map((f) => Number(f[FIELD_MAP.round])).filter((n) => !isNaN(n))
  )].sort((a, b) => a - b);
  const map = new Map<number, string>();
  for (let i = 0; i < ids.length; i++) {
    const fromEnd = ids.length - 1 - i;          // 0 = last round = Final
    map.set(ids[i], ROUND_LADDER[fromEnd] ?? `Round ${ids.length - i}`);
  }
  return map;
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
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
function dobToAge(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date();
  let age = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) age--;
  return age;
}

interface Verified {
  name: string; year: number; tour: "ATP" | "WTA"; surface: "Hard" | "Clay";
  seasonId: string;
}

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

async function main() {
  const editions: Verified[] = JSON.parse(
    fs.readFileSync("scripts/_verified-masters-seasons.json", "utf8")
  );
  console.log(`\nRe-import — ${editions.length} Masters editions\n`);

  // ── Step 1: stage fixtures (skip if already staged) ────────────────────────
  for (const ed of editions) {
    const { data: existingRows } = await supabase
      .from("api_raw_staging")
      .select("id")
      .eq("method", "get_fixtures")
      .contains("params", { seasonId: ed.seasonId, tour: ed.tour })
      .limit(1);
    if (existingRows?.length) { console.log(`  staged: ${ed.name} ${ed.year} ${ed.tour} (skip fetch)`); continue; }

    const raw = await matchstat<Record<string, unknown>>(
      `${ed.tour.toLowerCase()}/tournament/results/${ed.seasonId}`
    );
    const singles = (raw.singles ?? (raw.data as any)?.singles ?? []) as unknown[];
    if (singles.length < 45) {
      throw new Error(`${ed.name} ${ed.year} ${ed.tour}: only ${singles.length} fixtures — aborting`);
    }
    const { error } = await supabase.from("api_raw_staging").insert({
      method:   "get_fixtures",
      params: {
        seasonId: ed.seasonId, tour: ed.tour, slam_name: ed.name,
        year: String(ed.year), surface: ed.surface, tournament_tier: "masters_1000",
      },
      response: { singles },
    });
    if (error) throw error;
    console.log(`  fetched: ${ed.name} ${ed.year} ${ed.tour} — ${singles.length} fixtures`);
  }

  // ── Load staging rows for our editions ─────────────────────────────────────
  const stagingRows: { params: Record<string, string>; response: any }[] = [];
  for (const ed of editions) {
    const { data, error } = await supabase
      .from("api_raw_staging")
      .select("params, response")
      .eq("method", "get_fixtures")
      .contains("params", { seasonId: ed.seasonId, tour: ed.tour, slam_name: ed.name, year: String(ed.year) })
      .limit(1);
    if (error) throw error;
    if (!data?.length) throw new Error(`No staging row for ${ed.name} ${ed.year} ${ed.tour} (season ${ed.seasonId})`);
    stagingRows.push(data[0]);
  }

  // ── Step 2: create missing players ─────────────────────────────────────────
  const playerTour = new Map<string, string>();
  for (const row of stagingRows) {
    const fixtures: Record<string, unknown>[] = row.response?.singles ?? [];
    const tour = (row.params.tour ?? "ATP").toLowerCase();
    for (const f of fixtures) {
      const p1 = String(f[FIELD_MAP.player1_id] ?? "").trim();
      const p2 = String(f[FIELD_MAP.player2_id] ?? "").trim();
      if (p1) playerTour.set(p1, tour);
      if (p2) playerTour.set(p2, tour);
    }
  }
  const known = new Set((await fetchAllPlayers()).map((p) => String(p.api_player_key)));
  const missing = [...playerTour.keys()].filter((id) => !known.has(id));
  console.log(`\n  Players referenced: ${playerTour.size}, missing from DB: ${missing.length}\n`);

  let created = 0;
  for (const playerId of missing) {
    const tour = playerTour.get(playerId)!;
    try {
      const profile = await matchstat<Record<string, unknown>>(
        `${tour}/player/profile/${playerId}`, { include: "ranking,country" }
      );
      const dobIso = normaliseDob(profile.dob);
      const { error } = await supabase.from("players").upsert({
        name:           profile.name ?? "Unknown",
        country:        profile.country ?? null,
        age:            dobToAge(dobIso),
        photo_url:      profile.photo ?? null,
        api_player_key: String(profile.id ?? playerId),
        career_stats:   { tour: tour === "wta" ? "WTA" : "ATP", dob: dobIso, country_full: profile.country ?? null },
      }, { onConflict: "api_player_key" });
      if (error) throw new Error(error.message);
      await supabase.from("api_raw_staging").insert({
        method: "get_players", params: { player_id: playerId }, response: { data: profile },
      });
      created++;
      process.stdout.write(`\r  Created ${created}/${missing.length} players...`);
    } catch (err) {
      console.error(`\n  ⚠️  player ${playerId}: ${(err as Error).message}`);
    }
  }
  if (missing.length > 0) console.log();

  // ── Step 3: upsert matches ─────────────────────────────────────────────────
  const playerMap = new Map((await fetchAllPlayers()).map((p) => [String(p.api_player_key), p.id]));

  for (const row of stagingRows) {
    const fixtures: Record<string, unknown>[] = row.response?.singles ?? [];
    const name    = row.params.slam_name;
    const year    = row.params.year;
    const tour    = row.params.tour ?? "ATP";
    const surface = row.params.surface ?? "Hard";
    const roundLabels = buildRoundLabels(fixtures);

    const batch: object[] = [];
    let skipped = 0;
    for (const f of fixtures) {
      const eventKey = String(f[FIELD_MAP.event_key] ?? "").trim();
      const p1Key    = String(f[FIELD_MAP.player1_id] ?? "").trim();
      const p2Key    = String(f[FIELD_MAP.player2_id] ?? "").trim();
      if (!eventKey || !p1Key || !p2Key) { skipped++; continue; }
      const p1 = playerMap.get(p1Key);
      const p2 = playerMap.get(p2Key);
      if (!p1 || !p2) { skipped++; continue; }

      const winnerRaw = String(f[FIELD_MAP.winner] ?? "");
      const winnerId = winnerRaw === p1Key ? p1 : winnerRaw === p2Key ? p2 : null;
      const roundId  = Number(f[FIELD_MAP.round]);

      batch.push({
        player1_id:        p1,
        player2_id:        p2,
        winner_id:         winnerId,
        tournament:        `${name} ${year}`,
        round:             isNaN(roundId) ? null : (roundLabels.get(roundId) ?? null),
        score:             f[FIELD_MAP.score] ? String(f[FIELD_MAP.score]) : null,
        surface,
        match_date:        normaliseDate(f[FIELD_MAP.date]),
        // Namespace by tour — MatchStat match ids are unique only WITHIN a tour;
        // ATP & WTA id ranges overlap (e.g. WTA 2026 ≈ ATP 2021), so a bare id
        // as the unique api_event_key collides across tours and silently
        // overwrites the other tour's match. See docs/match-data-validation.
        api_event_key:     `${tour}-${eventKey}`,
        tournament_season: parseInt(year) || null,
        tournament_tier:   "masters_1000",
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
    console.log(`  ✓ ${name} ${year} ${tour}: ${batch.length} matches upserted` + (skipped ? `, ${skipped} skipped (missing players)` : ""));
  }

  console.log("\n  Done. Next: npx tsx scripts/validate-slam-draws.ts\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
