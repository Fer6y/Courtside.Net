/**
 * phase2f-fetch-photos.ts
 *
 * Extracts the player code/ID from each player's MatchStat profile
 * (stored in information.twitter as the tour overview URL), then
 * constructs the official headshot CDN URL and stores it as photo_url.
 *
 * ATP headshot URL pattern:
 *   https://www.atptour.com/-/media/alias/player-headshot/{CODE}
 * where CODE is the 4-char code embedded in the ATP player URL, e.g.:
 *   https://www.atptour.com/en/players/jannik-sinner/s0ag/overview → S0AG
 *
 * WTA headshot URL pattern:
 *   https://www.wtatennis.com/-/media/alias/player-headshot/{PLAYER_ID}
 * where PLAYER_ID is the numeric ID in the WTA Tour URL, e.g.:
 *   https://www.wtatennis.com/players/123456/iga-swiatek/overview → 123456
 *
 * Strategy:
 *   1. Check api_raw_staging for already-fetched profiles (no API calls)
 *   2. For players not in staging, fetch fresh from MatchStat
 *   3. Tour is determined from career_stats.tour in the players table
 *
 * Note: Add www.wtatennis.com to next.config.ts remotePatterns for WTA photos.
 *
 * Run: npm run migrate:phase2f
 * Re-run with --force to overwrite existing photos.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FORCE = process.argv.includes("--force");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extract the 4-char ATP player code from an ATP Tour URL */
function extractAtpCode(url: string | null | undefined): string | null {
  if (!url) return null;
  // Matches /players/{slug}/{code}/overview — code is exactly 4 alphanumeric chars
  const match = url.match(/\/players\/[^/]+\/([a-z0-9]{4})\/overview/i);
  return match ? match[1].toUpperCase() : null;
}

/** Build the official ATP headshot URL from a player code */
function atpHeadshotUrl(code: string): string {
  return `https://www.atptour.com/-/media/alias/player-headshot/${code}`;
}

/** Get ATP code from a MatchStat profile object */
function getCodeFromProfile(profile: Record<string, unknown>): string | null {
  const info = profile.information as Record<string, unknown> | null;
  if (!info) return null;
  // The 'twitter' field stores the ATP Tour overview URL (yes, mislabelled)
  return extractAtpCode(info.twitter as string);
}

/**
 * Extract the numeric WTA player ID from a WTA Tour URL.
 * e.g. https://www.wtatennis.com/players/123456/iga-swiatek/overview → "123456"
 */
function extractWtaId(url: string | null | undefined): string | null {
  if (!url) return null;
  // Matches /players/{numeric-id}/{slug}/... — ID is purely numeric
  const match = url.match(/\/players\/(\d+)\//) ?? url.match(/\/player-profile\/(\d+)/);
  return match ? match[1] : null;
}

/** Build the official WTA headshot URL from a numeric player ID */
function wtaHeadshotUrl(playerId: string): string {
  return `https://www.wtatennis.com/-/media/alias/player-headshot/${playerId}`;
}

/** Get WTA numeric ID from a MatchStat profile object */
function getWtaIdFromProfile(profile: Record<string, unknown>): string | null {
  const info = profile.information as Record<string, unknown> | null;
  if (!info) return null;
  // The 'twitter' field stores the WTA Tour overview URL (same mislabelling as ATP)
  return extractWtaId(info.twitter as string);
}

async function main() {
  console.log(
    `\nPhase 2f — Building player photo URLs (ATP + WTA)${FORCE ? " (--force)" : ""}\n`
  );

  // ── Load players to update ─────────────────────────────────────────────────
  const baseQuery = supabase
    .from("players")
    .select("id, name, api_player_key, photo_url, career_stats")
    .not("api_player_key", "is", null)
    .order("current_rank", { ascending: true, nullsFirst: false });

  const { data: players, error } = FORCE
    ? await baseQuery
    : await baseQuery.is("photo_url", null);

  if (error) { console.error("DB error:", error.message); process.exit(1); }
  if (!players || players.length === 0) {
    console.log("  All players already have photos. Use --force to overwrite.\n");
    return;
  }
  console.log(`  ${players.length} players to process.\n`);

  // ── Load already-staged profiles (free — no API calls) ────────────────────
  const { data: staged } = await supabase
    .from("api_raw_staging")
    .select("params, response")
    .eq("method", "get_players");

  const stagedMap = new Map<string, Record<string, unknown>>();
  for (const row of staged ?? []) {
    const playerId = String((row.params as Record<string, unknown>)?.player_id ?? "");
    const profile  = (row.response as Record<string, unknown>)?.data as Record<string, unknown>;
    if (playerId && profile) stagedMap.set(playerId, profile);
  }
  console.log(`  ${stagedMap.size} profiles found in staging cache.\n`);

  let found   = 0;
  let missing = 0;
  let apiCalls = 0;

  for (let i = 0; i < players.length; i++) {
    const p      = players[i];
    const apiKey = String(p.api_player_key);

    // Determine tour from career_stats
    const careerStats = (p as unknown as { career_stats: Record<string, unknown> | null }).career_stats;
    const playerTour  = String(careerStats?.tour ?? "ATP").toUpperCase();
    const isWta       = playerTour === "WTA";
    const tourPrefix  = isWta ? "wta" : "atp";

    // Try staging cache first
    let profile = stagedMap.get(apiKey) ?? null;

    // Fall back to live API fetch
    if (!profile) {
      try {
        profile = await matchstat<Record<string, unknown>>(
          `${tourPrefix}/player/profile/${apiKey}`,
          { include: "ranking,country" }
        );
        apiCalls++;
        // Cache it for future re-runs
        await supabase.from("api_raw_staging").insert({
          method:   "get_players",
          params:   { player_id: apiKey },
          response: { data: profile },
        });
        await sleep(1200);
      } catch (err) {
        console.error(`  [${i + 1}/${players.length}]  ERROR fetching ${p.name}: ${(err as Error).message}`);
        missing++;
        continue;
      }
    }

    if (isWta) {
      // WTA: extract numeric ID from WTA Tour URL in information.twitter
      const wtaId = getWtaIdFromProfile(profile);
      if (wtaId) {
        const photoUrl = wtaHeadshotUrl(wtaId);
        const { error: updateErr } = await supabase
          .from("players")
          .update({ photo_url: photoUrl })
          .eq("id", p.id);

        if (updateErr) {
          console.error(`  [${i + 1}/${players.length}]  ERROR saving ${p.name}: ${updateErr.message}`);
          missing++;
        } else {
          console.log(`  [${i + 1}/${players.length}]  ✓  ${p.name}  WTA id=${wtaId}`);
          found++;
        }
      } else {
        console.log(`  [${i + 1}/${players.length}]  —  ${p.name}  (no WTA ID in profile)`);
        missing++;
      }
    } else {
      // ATP: extract 4-char code from ATP Tour URL in information.twitter
      const code = getCodeFromProfile(profile);
      if (code) {
        const photoUrl = atpHeadshotUrl(code);
        const { error: updateErr } = await supabase
          .from("players")
          .update({ photo_url: photoUrl })
          .eq("id", p.id);

        if (updateErr) {
          console.error(`  [${i + 1}/${players.length}]  ERROR saving ${p.name}: ${updateErr.message}`);
          missing++;
        } else {
          console.log(`  [${i + 1}/${players.length}]  ✓  ${p.name}  ATP code=${code}`);
          found++;
        }
      } else {
        console.log(`  [${i + 1}/${players.length}]  —  ${p.name}  (no ATP code)`);
        missing++;
      }
    }
  }

  console.log(`\n  ✓  Done. ${found} photos saved, ${missing} not found. ${apiCalls} API calls made.\n`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
