/**
 * reimport-slams.ts
 *
 * Re-imports the Grand Slam draws affected by the wrong-seasonId bug, using
 * the verified IDs from probe-slam-seasonids.ts. Targeted version of the
 * phase2b → 2c → 2d pipeline: only touches the listed seasonIds, so existing
 * good data (other slams, Masters) is never reprocessed.
 *
 * Steps per edition:
 *   1. Stage fixtures (skip if already staged) — phase2b pattern
 *   2. Create any players we don't have yet (profile fetch) — phase2c pattern
 *   3. Upsert matches on api_event_key — phase2d pattern
 *
 * Also includes US Open 2021 ATP (seasonId 16934 — was always correct) to
 * fill its 15 missing matches and repair rows whose match_date was wrongly
 * backfilled to May 2026.
 *
 * Run: npx tsx scripts/reimport-slams.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { matchstat } from "../lib/matchstat";
import { getTournamentTier } from "../lib/tournamentTiers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Field map + normalisers (same as phase2d, confirmed field names) ─────────
const FIELD_MAP = {
  event_key:  "id",
  date:       "date",
  player1_id: "player1Id",
  player2_id: "player2Id",
  winner:     "match_winner",
  score:      "result",
  round:      "roundId",
} as const;

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

interface Edition { slam: string; year: number; tour: string; seasonId: string }

/** Fetch ALL players (Supabase caps a single select at 1000 rows). */
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
  const verified: Edition[] = JSON.parse(
    fs.readFileSync("scripts/_verified-slam-seasons.json", "utf8")
  );
  // USO 2021 ATP — correct seasonId all along; reprocess to fill gaps + fix dates
  const editions: Edition[] = [
    ...verified,
    { slam: "US Open", year: 2021, tour: "ATP", seasonId: "16934" },
  ];

  console.log(`\nRe-import — ${editions.length} slam editions\n`);

  // ── Step 1: stage fixtures ─────────────────────────────────────────────────
  for (const ed of editions) {
    const { data: existing } = await supabase
      .from("api_raw_staging")
      .select("id")
      .eq("method", "get_fixtures")
      .contains("params", { seasonId: ed.seasonId, tour: ed.tour })
      .maybeSingle();
    if (existing) {
      console.log(`  staged: ${ed.slam} ${ed.year} ${ed.tour} (skip fetch)`);
      continue;
    }
    const raw = await matchstat<Record<string, unknown>>(
      `${ed.tour.toLowerCase()}/tournament/results/${ed.seasonId}`
    );
    const singles = (raw.singles ?? (raw.data as any)?.singles ?? []) as unknown[];
    if (singles.length < 95) {
      throw new Error(`${ed.slam} ${ed.year} ${ed.tour}: only ${singles.length} fixtures — aborting`);
    }
    const { error } = await supabase.from("api_raw_staging").insert({
      method:   "get_fixtures",
      params:   { seasonId: ed.seasonId, tour: ed.tour, slam_name: ed.slam, year: String(ed.year) },
      response: { singles },
    });
    if (error) throw error;
    console.log(`  fetched: ${ed.slam} ${ed.year} ${ed.tour} — ${singles.length} fixtures`);
  }

  // ── Load the staging rows for our editions ─────────────────────────────────
  const stagingRows: { params: Record<string, string>; response: any }[] = [];
  for (const ed of editions) {
    const { data, error } = await supabase
      .from("api_raw_staging")
      .select("params, response")
      .eq("method", "get_fixtures")
      .contains("params", { seasonId: ed.seasonId, tour: ed.tour })
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No staging row for ${ed.slam} ${ed.year} ${ed.tour}`);
    stagingRows.push(data);
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

  const existingPlayers = await fetchAllPlayers();
  const known = new Set(existingPlayers.map((p) => String(p.api_player_key)));
  const missing = [...playerTour.keys()].filter((id) => !known.has(id));
  console.log(`\n  Players referenced: ${playerTour.size}, missing from DB: ${missing.length}\n`);

  let created = 0;
  for (const playerId of missing) {
    const tour = playerTour.get(playerId)!;
    try {
      const profile = await matchstat<Record<string, unknown>>(
        `${tour}/player/profile/${playerId}`,
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
            tour:         tour === "wta" ? "WTA" : "ATP",
            dob:          dobIso,
            country_full: profile.country ?? null,
          },
        },
        { onConflict: "api_player_key" }
      );
      if (error) throw new Error(error.message);
      await supabase.from("api_raw_staging").insert({
        method:   "get_players",
        params:   { player_id: playerId },
        response: { data: profile },
      });
      created++;
      process.stdout.write(`\r  Created ${created}/${missing.length} players...`);
    } catch (err) {
      console.error(`\n  ⚠️  player ${playerId}: ${(err as Error).message}`);
    }
  }
  if (missing.length > 0) console.log();

  // ── Step 3: upsert matches ─────────────────────────────────────────────────
  const playerRows = await fetchAllPlayers();
  const playerMap = new Map(playerRows.map((p) => [String(p.api_player_key), p.id]));

  for (const row of stagingRows) {
    const fixtures: Record<string, unknown>[] = row.response?.singles ?? [];
    const slamName = row.params.slam_name;
    const year     = row.params.year;
    const tour     = row.params.tour ?? "ATP";
    const surface =
      slamName.includes("Roland Garros") ? "Clay" :
      slamName.includes("Wimbledon")     ? "Grass" : "Hard";

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

      batch.push({
        player1_id:        p1,
        player2_id:        p2,
        winner_id:         winnerId,
        tournament:        `${slamName} ${year}`,
        round:             normaliseRound(f[FIELD_MAP.round]),
        score:             f[FIELD_MAP.score] ? String(f[FIELD_MAP.score]) : null,
        surface,
        match_date:        normaliseDate(f[FIELD_MAP.date]),
        api_event_key:     eventKey,
        tournament_season: parseInt(year) || null,
        tournament_tier:   getTournamentTier(slamName),
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
    console.log(
      `  ✓ ${slamName} ${year} ${tour}: ${batch.length} matches upserted` +
        (skipped ? `, ${skipped} skipped (missing players)` : "")
    );
  }

  console.log("\n  Done. Next: npx tsx scripts/validate-slam-draws.ts\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
