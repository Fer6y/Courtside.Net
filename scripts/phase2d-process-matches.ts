/**
 * phase2d-process-matches.ts
 *
 * Reads staged fixture responses and upserts match records into `matches`
 * using api_event_key as the conflict key (source='api_tennis').
 *
 * Requires phase2c to have run so player records exist with api_player_key.
 *
 * Run: npm run migrate:phase2d
 *
 * ⚠️  FIELD MAP — verify against Phase 0 sample output, then update below:
 *
 *   event_key_field    — unique match ID  (e.g. "id" or "match_id")
 *   date_field         — match date       (e.g. "date" or "match_date")
 *   player1_id_field   — player 1 ID     (must match FIELD_MAP in phase2c)
 *   player2_id_field   — player 2 ID
 *   winner_field       — winner indicator (e.g. "winner", "result")
 *                        value format: "1"/"2", "player1"/"player2", name, etc.
 *   score_field        — score string    (e.g. "score" or "result")
 *   round_field        — round name      (e.g. "round" or "stage")
 *   tournament_field   — tournament name (e.g. "tournament" or "tournament_name")
 *   surface_field      — surface         (e.g. "surface" or "court")
 *   season_field       — year            (e.g. "season" or "year")
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getTournamentTier, getMastersSurface } from "../lib/tournamentTiers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Confirmed from Phase 0 output. Match row structure:
// { id, date, roundId, player1Id, player2Id, tournamentId,
//   match_winner (= player API id of winner), result (score), result_type,
//   player1: { id, name, countryAcr }, player2: { id, name, countryAcr } }
// No surface field present — stored as null; no standalone tournament name.
const FIELD_MAP = {
  event_key:   "id",
  date:        "date",
  player1_id:  "player1Id",   // camelCase confirmed
  player2_id:  "player2Id",
  winner:      "match_winner", // contains the winner's player API id (number)
  score:       "result",       // e.g. "6-3 6-3"
  round:       "roundId",      // numeric round id — stored as-is, normalised below
  tournament:  "tournamentId", // numeric id — we use slam_name from staging params
  surface:     null,           // not present in match rows
  season:      null,           // taken from staging params
};

// ── Normalisers ───────────────────────────────────────────────────────────────

function normaliseSurface(raw: unknown): "Hard" | "Clay" | "Grass" | "Carpet" | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase().replace(/[^a-z]/g, "");
  if (s.includes("hard") || s.includes("indoor")) return "Hard";
  if (s.includes("clay")) return "Clay";
  if (s.includes("grass")) return "Grass";
  if (s.includes("carpet")) return "Carpet";
  return null;
}

// roundId is numeric in MatchStat. Confirmed from AO 2026 draw (128-player):
// 4=R128(64), 5=R64(32), 6=R32(16), 7=R16(8), 9=QF(4), 10=SF(2), 12=Final(1)
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
  // Fall back to string normalisation for text-based round fields
  const map: Record<string, string> = {
    "final": "Final", "f": "Final", "semifinal": "Semifinal",
    "sf": "Semifinal", "quarterfinal": "Quarterfinal", "qf": "Quarterfinal",
    "r16": "Round of 16", "r32": "Round of 32", "r64": "Round of 64", "r128": "Round of 128",
    "roundrobin": "Round Robin",
  };
  const key = String(raw).toLowerCase().replace(/[^a-z0-9]/g, "");
  return map[key] ?? String(raw);
}

function normaliseDate(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split(".");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/**
 * match_winner contains the player's API id (number) of the winner.
 * Compare against player1Id and player2Id to determine which player won.
 */
function normaliseWinner(
  raw: unknown,
  p1Id: string,
  p2Id: string,
  p1ApiKey: string,
  p2ApiKey: string
): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (s === p1ApiKey) return p1Id;
  if (s === p2ApiKey) return p2Id;
  return null;
}

async function main() {
  console.log("\nPhase 2d — Processing matches from staged fixtures\n");

  // ── Build player map: api_player_key → UUID ───────────────────────────────
  console.log("  Loading player map...");
  const { data: playerRows } = await supabase
    .from("players")
    .select("id, api_player_key, photo_url")
    .not("api_player_key", "is", null);

  const playerMap = new Map<string, { id: string; photo_url: string | null }>();
  for (const p of playerRows ?? []) {
    playerMap.set(String(p.api_player_key), { id: p.id, photo_url: p.photo_url });
  }
  console.log(`  ${playerMap.size} API players in DB.\n`);

  // ── Process staged fixtures ───────────────────────────────────────────────
  const { data: stagingRows } = await supabase
    .from("api_raw_staging")
    .select("params, response")
    .eq("method", "get_fixtures");

  let totalProcessed = 0;
  let skipped = 0;
  const matchBatch: object[] = [];

  // Log first fixture for field name verification
  let firstLogged = false;

  for (const staging of stagingRows ?? []) {
    // phase2b stores fixtures under response.singles (see phase2b-fetch-fixtures.ts)
    const fixtures: Record<string, unknown>[] = staging.response?.singles ?? staging.response?.data ?? [];
    const params = staging.params as Record<string, string>;
    const slamName  = params.slam_name ?? "Unknown";
    const season    = params.year ?? params.season ?? "?";
    const tourValue = params.tour ?? "ATP";

    // tournament_tier: prefer explicit value in staging params, otherwise derive
    const storedTier = params.tournament_tier as string | undefined;
    const resolvedTier =
      storedTier === "grand_slam" || storedTier === "masters_1000" || storedTier === "other"
        ? storedTier
        : getTournamentTier(slamName);

    // Surface: prefer explicit param (Masters), then name-based derivation (Grand Slams)
    const explicitSurface = params.surface as string | undefined;
    const slamSurface: "Hard" | "Clay" | "Grass" | null =
      explicitSurface === "Hard" || explicitSurface === "Clay" || explicitSurface === "Grass"
        ? explicitSurface
        : slamName.includes("Roland Garros") ? "Clay"
        : slamName.includes("Wimbledon")     ? "Grass"
        : slamName.includes("Australian")    ? "Hard"
        : slamName.includes("US Open")       ? "Hard"
        : getMastersSurface(slamName);

    for (const f of fixtures) {
      if (!firstLogged) {
        console.log("  First fixture row (verify FIELD_MAP):");
        console.log("  ", JSON.stringify(f, null, 2).split("\n").slice(0, 25).join("\n  "), "\n");
        firstLogged = true;
      }

      const eventKey  = String(f[FIELD_MAP.event_key] ?? "").trim();
      const p1ApiKey  = String(f[FIELD_MAP.player1_id] ?? "").trim();
      const p2ApiKey  = String(f[FIELD_MAP.player2_id] ?? "").trim();

      if (!eventKey || !p1ApiKey || !p2ApiKey) { skipped++; continue; }

      const p1 = playerMap.get(p1ApiKey);
      const p2 = playerMap.get(p2ApiKey);

      if (!p1 || !p2) { skipped++; continue; }

      const winnerId = normaliseWinner(f[FIELD_MAP.winner], p1.id, p2.id, p1ApiKey, p2ApiKey);
      const yr = season;
      const tournamentWithYear = `${slamName} ${yr}`;

      matchBatch.push({
        player1_id:        p1.id,
        player2_id:        p2.id,
        winner_id:         winnerId,
        tournament:        tournamentWithYear,
        round:             normaliseRound(f[FIELD_MAP.round]),
        score:             f[FIELD_MAP.score] ? String(f[FIELD_MAP.score]) : null,
        surface:           slamSurface,
        match_date:        normaliseDate(f[FIELD_MAP.date]),
        api_event_key:     eventKey,
        tournament_season: parseInt(yr) || null,
        tournament_tier:   resolvedTier,
        source:            "api_tennis",
        tour:              tourValue,
      });

      totalProcessed++;
    }

    // Flush batch
    if (matchBatch.length >= 100) {
      const { error } = await supabase
        .from("matches")
        .upsert(matchBatch, { onConflict: "api_event_key" });
      if (error) console.error("  Batch error:", error.message);
      matchBatch.length = 0;
      process.stdout.write(`\r  Processed ${totalProcessed} matches...`);
    }
  }

  if (matchBatch.length > 0) {
    const { error } = await supabase
      .from("matches")
      .upsert(matchBatch, { onConflict: "api_event_key" });
    if (error) console.error("\n  Final batch error:", error.message);
  }

  console.log(`\n\n  ✓  ${totalProcessed} matches processed. ${skipped} skipped (missing player keys).`);
  console.log("  Next: npm run migrate:phase2e\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
