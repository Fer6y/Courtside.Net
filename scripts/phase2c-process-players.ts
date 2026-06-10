/**
 * phase2c-process-players.ts
 *
 * 1. Reads all staged fixture responses
 * 2. Collects every unique player ID referenced
 * 3. Fetches player profiles from MatchStat
 * 4. Upserts into the `players` table using api_player_key as conflict key
 *
 * Run: npm run migrate:phase2c
 *
 * ⚠️  FIELD MAP — verify these against Phase 0 sample output and docs,
 *     then update the FIELD_MAP object below if they differ:
 *
 *   Fixture fields:
 *     player1_id_field   — field name holding player 1's ID in a fixture row
 *     player2_id_field   — field name holding player 2's ID in a fixture row
 *
 *   Player profile fields:
 *     id_field           — unique player ID  (e.g. "id" or "player_id")
 *     name_field         — full name          (e.g. "name" or "player_name")
 *     country_field      — full country name  (e.g. "country" or "nationality")
 *     dob_field          — date of birth      (e.g. "dob" — format may vary)
 *     photo_field        — photo URL          (e.g. "photo" or "player_logo")
 *     tour_field         — "ATP" / "WTA"      (e.g. "tour")
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Confirmed from Phase 0 output.
const FIELD_MAP = {
  // In fixture rows (confirmed camelCase):
  player1_id:  "player1Id",
  player2_id:  "player2Id",
  // In player profile rows:
  id:          "id",
  name:        "name",
  country:     "country",
  dob:         "dob",          // format unknown — log and normalise below
  photo:       "photo",        // may be null for lower-ranked players
  tour:        "tour",
};

// ── DOB normalisation ─────────────────────────────────────────────────────────
// MatchStat may return DOB in various formats. We store as YYYY-MM-DD for
// use in the Phase 3 crosswalk (DOB is the primary matching key).

function normaliseDob(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                    // already ISO
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {                          // DD.MM.YYYY
    const [d, m, y] = s.split(".");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {                          // MM/DD/YYYY
    const [m, d, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  console.warn(`  [phase2c] Unknown DOB format: "${s}" — stored as null`);
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

async function main() {
  console.log("\nPhase 2c — Processing players from staged fixtures\n");

  // ── Collect unique player IDs from staged fixtures ─────────────────────────
  const { data: stagingRows } = await supabase
    .from("api_raw_staging")
    .select("params, response")
    .eq("method", "get_fixtures");

  const playerIds = new Set<string>();
  // Maps each player ID to the tour they were found in ("atp" | "wta")
  const playerTourMap = new Map<string, "atp" | "wta">();

  for (const row of stagingRows ?? []) {
    // phase2b stores fixtures under response.singles
    const fixtures: Record<string, unknown>[] = row.response?.singles ?? row.response?.data ?? [];
    // Determine tour from staging params (ATP or WTA, case-insensitive)
    const paramTour = String((row.params as Record<string, unknown>)?.tour ?? "ATP").toLowerCase();
    const tour: "atp" | "wta" = paramTour === "wta" ? "wta" : "atp";

    for (const f of fixtures) {
      const p1 = String(f[FIELD_MAP.player1_id] ?? "").trim();
      const p2 = String(f[FIELD_MAP.player2_id] ?? "").trim();
      if (p1) { playerIds.add(p1); playerTourMap.set(p1, tour); }
      if (p2) { playerIds.add(p2); playerTourMap.set(p2, tour); }
    }
  }

  console.log(`  Found ${playerIds.size} unique player IDs across all staged fixtures.`);

  // ── Skip players already in DB ─────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("players")
    .select("api_player_key")
    .not("api_player_key", "is", null);

  const alreadyInDb = new Set((existing ?? []).map((p) => String(p.api_player_key)));
  const toFetch = [...playerIds].filter((id) => !alreadyInDb.has(id));

  console.log(`  ${alreadyInDb.size} already in DB — fetching ${toFetch.length} new.\n`);

  let done = 0;
  let errors = 0;
  const toUpsert: object[] = [];

  for (const playerId of toFetch) {
    try {
      // Use the tour the player was found in; fall back to "atp" if unknown
      const stagingTour = playerTourMap.get(playerId) ?? "atp";
      const profile = await matchstat<Record<string, unknown>>(`${stagingTour}/player/profile/${playerId}`, {
        include: "ranking,country",
      });

      // Log first result so we can confirm field names
      if (done === 0) {
        console.log("  First player profile (verify field names against FIELD_MAP):");
        console.log("  ", JSON.stringify(profile, null, 2).split("\n").slice(0, 15).join("\n  "), "\n");
      }

      const dobIso = normaliseDob(profile[FIELD_MAP.dob]);

      // Use staging tour to set career_stats.tour — profile[FIELD_MAP.tour] is often null
      const tourLabel = stagingTour === "wta" ? "WTA" : "ATP";

      toUpsert.push({
        name:            profile[FIELD_MAP.name]    ?? "Unknown",
        country:         profile[FIELD_MAP.country]  ?? null,
        age:             dobToAge(dobIso),
        photo_url:       profile[FIELD_MAP.photo]    ?? null,
        api_player_key:  String(profile[FIELD_MAP.id] ?? playerId),
        career_stats: {
          tour:         tourLabel,
          dob:          dobIso,
          country_full: profile[FIELD_MAP.country] ?? null,
        },
      });

      // Also stage the raw profile for crosswalk use in Phase 3
      await supabase.from("api_raw_staging").insert({
        method:   "get_players",
        params:   { player_id: playerId },
        response: { data: profile },
      });

      const name = String(profile[FIELD_MAP.name] ?? playerId);
      console.log(`  [${++done}/${toFetch.length}]  ${name}`);
    } catch (err) {
      console.error(`  [${++done}/${toFetch.length}]  ERROR id=${playerId} — ${(err as Error).message}`);
      errors++;
    }

    // Batch upsert every 50
    if (toUpsert.length >= 50) {
      const { error } = await supabase
        .from("players")
        .upsert(toUpsert, { onConflict: "api_player_key" });
      if (error) console.error("  Batch upsert error:", error.message);
      toUpsert.length = 0;
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("players")
      .upsert(toUpsert, { onConflict: "api_player_key" });
    if (error) console.error("  Final batch error:", error.message);
  }

  console.log(`\n  ✓  Players done. ${toFetch.length - errors} upserted, ${errors} errors.`);
  console.log("  Next: npm run migrate:phase2d\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
