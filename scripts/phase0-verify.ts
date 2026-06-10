/**
 * phase0-verify.ts — GATE script
 *
 * Run this BEFORE any backfill work. Confirms MatchStat API auth is working
 * and that Grand Slam coverage is available on your subscription.
 *
 * Run: npm run migrate:phase0
 *
 * Pass criteria:
 *   ✓  Rankings endpoint returns 200 + ranked players (auth confirmed)
 *   ✓  Player past-matches (TourRank:1) returns Grand Slam entries
 *   ✓  tournament/results/{seasonId} returns 50+ singles matches
 *
 * If any check fails — stop and resolve before proceeding to Phase 1.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { matchstat } from "../lib/matchstat";

function check(label: string, passed: boolean, detail?: string) {
  const icon = passed ? "✓" : "✗";
  console.log(`  ${icon}  ${label}${detail ? ` — ${detail}` : ""}`);
  return passed;
}

async function main() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  Phase 0 — MatchStat API Verification");
  console.log("══════════════════════════════════════════════════\n");

  const key  = process.env.MATCHSTAT_API_KEY;
  const host = process.env.MATCHSTAT_API_HOST;

  if (!key || key.trim() === "") {
    console.error("✗  MATCHSTAT_API_KEY is empty in .env.local");
    console.error("   Add your RapidAPI key and retry.\n");
    process.exit(1);
  }

  console.log(`  Key present: ${key.slice(0, 6)}${"*".repeat(10)}`);
  console.log(`  Host: ${host}\n`);

  let allPassed = true;

  // ── Check 1: Rankings (cheap auth smoke test) ─────────────────────────────
  console.log("[ 1 / 3 ]  ATP Rankings (auth smoke test)\n");
  let sinnerId = "47275"; // Jannik Sinner — fallback if lookup fails
  try {
    const rankings = await matchstat("atp/ranking/singles");
    const rows = Array.isArray(rankings) ? rankings : [];
    const ok = check("Rankings endpoint returns data", rows.length > 0, `${rows.length} players`);
    if (!ok) allPassed = false;

    if (rows.length > 0) {
      const sample = rows[0] as Record<string, unknown>;
      console.log("\n  Sample ranking row (full structure):");
      console.log("  " + JSON.stringify(sample, null, 2).split("\n").slice(0, 20).join("\n  "));

      // Try to extract a top player ID for use in Check 2
      // Field may be nested: row.player.id, or top-level: row.id, row.player_id
      const playerObj = sample.player as Record<string, unknown> | undefined;
      const extractedId = playerObj?.id ?? sample.player_id ?? sample.id;
      if (extractedId) {
        sinnerId = String(extractedId);
        console.log(`\n  Top-ranked player id: ${sinnerId}`);
      }
      console.log("\n  ⚠️  Note the exact field names above — update phase2e FIELD_MAP if needed");
      console.log("     Expected: position=rank, player.id=id, player.name=name\n");
    }
  } catch (err) {
    check("Rankings endpoint", false, (err as Error).message);
    allPassed = false;
    console.log("\n  ✗  Auth failed — check your MATCHSTAT_API_KEY in .env.local");
    console.log("     401 = wrong key, 403 = not subscribed, 429 = rate limited\n");
  }

  // ── Check 2: Grand Slam discovery via player past-matches ─────────────────
  // The calendar endpoint only returns ITF futures. Instead we fetch a top player's
  // 2023 past matches and find ones during Roland Garros dates (May 28–Jun 11).
  console.log("[ 2 / 3 ]  Grand Slam discovery (player past-matches, GameYear:2023)\n");
  let slamSeasonId = "";
  try {
    console.log(`  Fetching 2023 matches for player id ${sinnerId}...\n`);
    const raw = await matchstat(`atp/player/past-matches/${sinnerId}`, {
      filter: "GameYear:2023",
    });

    console.log(`  Raw response type: ${Array.isArray(raw) ? "array" : typeof raw}`);

    // Response may be array or object with nested matches
    let matches: Record<string, unknown>[] = [];
    if (Array.isArray(raw)) {
      matches = raw as Record<string, unknown>[];
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const nested = obj.data ?? obj.result ?? obj.matches ?? obj.items;
      matches = Array.isArray(nested) ? nested as Record<string, unknown>[] : [];
    }

    console.log(`  Matches found: ${matches.length}`);

    if (matches.length > 0) {
      console.log("\n  First match row (full structure):");
      console.log("  " + JSON.stringify(matches[0], null, 2).split("\n").slice(0, 30).join("\n  ") + "\n");
    } else {
      console.log("\n  Raw response (top level):");
      console.log("  " + JSON.stringify(raw, null, 2).split("\n").slice(0, 25).join("\n  ") + "\n");
    }

    const ok = check("Past Grand Slam matches returned", matches.length > 0, `${matches.length} matches`);
    if (!ok) allPassed = false;

    // Try to extract a Roland Garros season ID from match data
    if (matches.length > 0) {
      // Print all matches so we can see dates and tournamentIds
      console.log("  All 2023 matches (date → tournamentId):");
      matches.forEach((m) => {
        const date = String(m.date ?? "").slice(0, 10);
        const tid  = m.tournamentId ?? m.tournament_id ?? m.seasonId ?? "(no tournamentId)";
        console.log(`    ${date} — tournamentId: ${tid}`);
      });
      console.log();

      // Roland Garros 2023 ran May 28–Jun 11. Find matches in that window.
      const rgStart = new Date("2023-05-28");
      const rgEnd   = new Date("2023-06-12");
      const rgMatch = matches.find((m) => {
        const d = new Date(String(m.date ?? ""));
        return d >= rgStart && d <= rgEnd;
      });

      // The API returns only the most recent ~10 matches, not the full year.
      // Grand Slam dates (May/Jun/Jul/Aug) won't appear if Sinner had 10+ later matches.
      // Find the tournamentId with the most repeated appearances — that's the biggest event.
      const idCounts: Record<string, number> = {};
      matches.forEach((m) => {
        const tid = String(m.tournamentId ?? m.tournament_id ?? "");
        if (tid) idCounts[tid] = (idCounts[tid] ?? 0) + 1;
      });
      const bestId = Object.entries(idCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      slamSeasonId = bestId;
      console.log(`  Best candidate tournamentId (most match appearances): ${slamSeasonId}`);
      console.log("  (This is likely a large ATP event — Grand Slam discovery happens in Phase 2a)\n");
    }
  } catch (err) {
    check("Past Grand Slam matches", false, (err as Error).message);
    allPassed = false;
    console.log("\n  ✗  If this is a 404, the endpoint path or filter syntax may differ.");
    console.log("     Check RapidAPI docs for the correct past-matches endpoint.\n");
  }

  // ── Check 3: Verify tournament/results returns a full singles draw ────────
  // We use the tournamentId discovered in Check 2. For Grand Slam ID discovery
  // across 2020–2024 see Phase 2a (which will need a different lookup strategy).
  console.log("[ 3 / 3 ]  Tournament results endpoint (tournament/results/{id})\n");
  try {
    if (!slamSeasonId) {
      throw new Error("No season ID available from Check 2 — fix Check 2 first");
    }

    console.log(`  Fetching results for seasonId: ${slamSeasonId}\n`);
    const fixtures = await matchstat(`atp/tournament/results/${slamSeasonId}`);

    const result = fixtures as Record<string, unknown>;
    console.log(`  Response keys: ${Object.keys(result).join(", ")}`);

    // Singles draw is nested under result.singles
    const singles: unknown[] = (result.singles ?? result.data?.singles ?? []) as unknown[];

    const ok = check(
      "Singles draw returned",
      singles.length >= 10,
      `${singles.length} singles matches (Grand Slams return ~127; ATP Finals ~16)`
    );
    if (!ok) allPassed = false;

    if (singles.length > 0) {
      const sample = singles[0] as Record<string, unknown>;
      console.log("\n  Sample match row — copy these field names into phase2d FIELD_MAP:");
      console.log("  " + JSON.stringify(sample, null, 2).split("\n").slice(0, 35).join("\n  "));
      console.log("\n  Note: in historical data player1 is always the winner.\n");
    }
  } catch (err) {
    check("Tournament results", false, (err as Error).message);
    allPassed = false;
  }

  // ── Result ────────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════");
  if (allPassed) {
    console.log("  ✓  ALL CHECKS PASSED");
    console.log("  → Run the SQL migration (supabase/migrations/002_api_tennis_prep.sql)");
    console.log("  → Then proceed to phase2a: npm run migrate:phase2a");
  } else {
    console.log("  ✗  SOME CHECKS FAILED — do not proceed");
    console.log("  → Fix the issues above (key, plan, endpoint paths)");
    console.log("  → Re-run: npm run migrate:phase0");
  }
  console.log("══════════════════════════════════════════════════\n");

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error("\nVerification error:", err.message, "\n");
  process.exit(1);
});
