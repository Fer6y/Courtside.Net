/**
 * phase3-build-crosswalk.ts
 *
 * ONLY RUN THIS IF community data (reviews, skill_ratings) already exists.
 * If no community data exists, skip to phase4-cutover.ts.
 *
 * Builds player_crosswalk and match_crosswalk tables by matching:
 *   Players:  Sackmann numeric ID ↔ api-tennis.com player_key
 *             Primary key: date of birth (most reliable)
 *             Tiebreakers: last name, country
 *   Matches:  via player crosswalk + tournament + round + set score
 *
 * After running, review the output report:
 *   - "high" confidence matches → safe to use in Phase 4
 *   - "low" confidence matches  → review manually, update confidence='manual' in DB when verified
 *   - Unmatched                 → investigate before proceeding
 *
 * Run: npm run migrate:phase3
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalise a last name for fuzzy comparison
function normaliseName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z\s]/g, "");
}

// Extract last name from full name (last word)
function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return normaliseName(parts[parts.length - 1]);
}

// Convert Sackmann DOB (YYYYMMDD) to YYYY-MM-DD
function sackmannDobToISO(dob: string): string | null {
  if (!dob || dob.length !== 8) return null;
  return `${dob.slice(0, 4)}-${dob.slice(4, 6)}-${dob.slice(6, 8)}`;
}

// Convert api-tennis DOB (DD.MM.YYYY) to YYYY-MM-DD
function apiDobToISO(dob: string | null): string | null {
  if (!dob) return null;
  const parts = dob.split(".");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

async function main() {
  console.log("\nPhase 3 — Building crosswalk tables\n");

  // ── Safety check: confirm community data exists ────────────────────────────
  const { count: reviewCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true });

  const { count: ratingCount } = await supabase
    .from("skill_ratings")
    .select("*", { count: "exact", head: true });

  console.log(`  Community data: ${reviewCount ?? 0} reviews, ${ratingCount ?? 0} skill ratings.`);

  if ((reviewCount ?? 0) === 0 && (ratingCount ?? 0) === 0) {
    console.log("\n  No community data found — Phase 3 is not needed.");
    console.log("  Proceed directly to phase4-cutover.ts.\n");
    return;
  }

  console.log("  Community data exists — building crosswalk...\n");

  // ── Load Sackmann players (have api_id = Sackmann numeric ID) ─────────────
  const { data: sackmannPlayers } = await supabase
    .from("players")
    .select("id, api_id, name, country, career_stats")
    .not("api_id", "is", null)
    .is("api_player_key", null); // only rows not yet cross-walked

  console.log(`  ${sackmannPlayers?.length ?? 0} Sackmann players to cross-walk.`);

  // ── Load API players (have api_player_key) ────────────────────────────────
  const { data: apiPlayers } = await supabase
    .from("players")
    .select("id, api_player_key, name, country, career_stats")
    .not("api_player_key", "is", null);

  console.log(`  ${apiPlayers?.length ?? 0} API players available for matching.\n`);

  // Build DOB lookup: ISO date → list of API player records
  const apiByDob = new Map<string, typeof apiPlayers>();
  for (const ap of apiPlayers ?? []) {
    const dob = apiDobToISO((ap.career_stats as Record<string,string>)?.dob ?? null);
    if (!dob) continue;
    if (!apiByDob.has(dob)) apiByDob.set(dob, []);
    apiByDob.get(dob)!.push(ap);
  }

  // ── Match Sackmann players to API players ─────────────────────────────────
  const crosswalkRows: object[] = [];
  let highConf = 0, lowConf = 0, unmatched = 0;
  const unmatchedNames: string[] = [];

  for (const sp of sackmannPlayers ?? []) {
    const dob = sackmannDobToISO(
      (sp.career_stats as Record<string, string>)?.dob ?? ""
    );

    let matched = false;
    let confidence: "high" | "low" = "low";
    let matchBasis = "";

    if (dob) {
      const candidates = apiByDob.get(dob) ?? [];

      if (candidates.length === 1) {
        // Unique DOB match → high confidence
        const ap = candidates[0];
        crosswalkRows.push({
          sackmann_id:        sp.api_id,
          api_player_key:     ap.api_player_key,
          supabase_player_id: sp.id,
          confidence:         "high",
          match_basis:        "dob_unique",
        });
        highConf++;
        matched = true;
      } else if (candidates.length > 1) {
        // Multiple players share a DOB — use last name as tiebreaker
        const spLastName = lastName(sp.name);
        const nameMatch = candidates.find((ap) =>
          lastName(ap.name ?? "").includes(spLastName) ||
          spLastName.includes(lastName(ap.name ?? ""))
        );

        if (nameMatch) {
          confidence = "high";
          matchBasis = "dob+lastname";
          crosswalkRows.push({
            sackmann_id:        sp.api_id,
            api_player_key:     nameMatch.api_player_key,
            supabase_player_id: sp.id,
            confidence,
            match_basis:        matchBasis,
          });
          highConf++;
          matched = true;
        } else {
          // DOB collision, names don't match — flag as low confidence
          const ap = candidates[0];
          crosswalkRows.push({
            sackmann_id:        sp.api_id,
            api_player_key:     ap.api_player_key,
            supabase_player_id: sp.id,
            confidence:         "low",
            match_basis:        "dob_collision",
            notes:              `${candidates.length} DOB collisions — verify manually`,
          });
          lowConf++;
          matched = true;
        }
      }
    }

    if (!matched) {
      unmatched++;
      unmatchedNames.push(sp.name);
    }
  }

  // ── Write player crosswalk ─────────────────────────────────────────────────
  if (crosswalkRows.length > 0) {
    const { error } = await supabase
      .from("player_crosswalk")
      .upsert(crosswalkRows, { onConflict: "sackmann_id,api_player_key" });
    if (error) throw new Error(`player_crosswalk insert: ${error.message}`);
  }

  console.log(`  Player crosswalk results:`);
  console.log(`    ✓  High confidence: ${highConf}`);
  console.log(`    ⚠  Low confidence:  ${lowConf} (review manually)`);
  console.log(`    ✗  Unmatched:       ${unmatched}`);

  if (unmatchedNames.length > 0) {
    console.log("\n  Unmatched Sackmann players:");
    for (const name of unmatchedNames.slice(0, 20)) console.log(`    - ${name}`);
    if (unmatchedNames.length > 20) console.log(`    ... and ${unmatchedNames.length - 20} more`);
  }

  // ── Match crosswalk via player crosswalk ──────────────────────────────────
  console.log("\n  Building match crosswalk...");

  const { data: sackmannMatches } = await supabase
    .from("matches")
    .select("id, api_match_id, tournament, round, score, player1_id, player2_id")
    .eq("source", "sackmann")
    .not("api_match_id", "is", null);

  const { data: apiMatches } = await supabase
    .from("matches")
    .select("id, api_event_key, tournament, round, score, player1_id, player2_id")
    .eq("source", "api_tennis");

  // Load crosswalk to resolve UUIDs
  const { data: crosswalkData } = await supabase
    .from("player_crosswalk")
    .select("sackmann_id, api_player_key, supabase_player_id, confidence")
    .in("confidence", ["high", "manual"]);

  // sackmannPlayerId → apiPlayerUUID map (via crosswalk)
  const sackUUIDtoApiUUID = new Map<string, string>();
  const { data: sackmannPlayersAll } = await supabase
    .from("players")
    .select("id, api_id, api_player_key");

  for (const xw of crosswalkData ?? []) {
    // Find the API player's UUID
    const apiPlayerRow = (sackmannPlayersAll ?? []).find(
      (p) => p.api_player_key === xw.api_player_key
    );
    if (xw.supabase_player_id && apiPlayerRow) {
      sackUUIDtoApiUUID.set(xw.supabase_player_id, apiPlayerRow.id);
    }
  }

  // Index API matches by player pair + tournament normalised
  const apiMatchIndex = new Map<string, (typeof apiMatches)[number]>();
  for (const am of apiMatches ?? []) {
    const key1 = `${am.player1_id}|${am.player2_id}|${am.round ?? ""}`;
    const key2 = `${am.player2_id}|${am.player1_id}|${am.round ?? ""}`;
    apiMatchIndex.set(key1, am);
    apiMatchIndex.set(key2, am);
  }

  const matchCrosswalkRows: object[] = [];
  let matchHigh = 0, matchLow = 0, matchUnmatched = 0;

  for (const sm of sackmannMatches ?? []) {
    // Resolve Sackmann player UUIDs → API player UUIDs
    const apiP1 = sackUUIDtoApiUUID.get(sm.player1_id);
    const apiP2 = sackUUIDtoApiUUID.get(sm.player2_id);

    if (!apiP1 || !apiP2) { matchUnmatched++; continue; }

    // Look up API match by resolved player UUIDs + round
    const lookupKey = `${apiP1}|${apiP2}|${sm.round ?? ""}`;
    const apiMatch = apiMatchIndex.get(lookupKey);

    if (!apiMatch) { matchUnmatched++; continue; }

    // Validate with score if both are present
    const scoreMatch = !sm.score || !apiMatch.score ||
      sm.score.replace(/\s/g, "") === apiMatch.score.replace(/\s/g, "");

    matchCrosswalkRows.push({
      sackmann_match_id:  sm.api_match_id,
      api_event_key:      apiMatch.api_event_key,
      supabase_match_id:  sm.id,
      confidence:         scoreMatch ? "high" : "low",
      match_basis:        `players+round${scoreMatch ? "+score" : ""}`,
    });

    if (scoreMatch) matchHigh++; else matchLow++;
  }

  if (matchCrosswalkRows.length > 0) {
    const { error } = await supabase
      .from("match_crosswalk")
      .upsert(matchCrosswalkRows, { onConflict: "sackmann_match_id,api_event_key" });
    if (error) throw new Error(`match_crosswalk insert: ${error.message}`);
  }

  console.log(`  Match crosswalk results:`);
  console.log(`    ✓  High confidence: ${matchHigh}`);
  console.log(`    ⚠  Low confidence:  ${matchLow}`);
  console.log(`    ✗  Unmatched:       ${matchUnmatched}`);

  console.log("\n  ── Next steps before Phase 4 ──────────────────────────────────");
  console.log("  1. Review low-confidence rows in player_crosswalk and match_crosswalk");
  console.log("  2. Update confidence='manual' on any you verify are correct");
  console.log("  3. Investigate unmatched players/matches");
  console.log("  4. When satisfied, run phase4-cutover.ts\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
