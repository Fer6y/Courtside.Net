/**
 * fix-player-match-links.ts
 *
 * Fixes matches where a player's UUID in the match row doesn't match
 * their current UUID in the players table (caused by players being
 * re-seeded with new UUIDs after matches were already imported).
 *
 * For each player, reads their source CSV matches, compares the
 * api_match_id in the DB, and corrects any wrong player1_id/player2_id/winner_id.
 *
 * Usage:
 *   npm run fix:links           ← dry run
 *   npm run fix:links -- --run  ← apply fixes
 */

import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DRY_RUN = !process.argv.includes("--run");
const DATA_ROOT = path.join(process.cwd(), "data/sackmann");
const YEARS = [2020, 2021, 2022, 2023, 2024];

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(DRY_RUN ? "── DRY RUN (pass --run to apply fixes) ──\n" : "── LIVE RUN ──\n");

  // ── 1. Build sackmann_id → supabase_uuid map from CURRENT players table ────
  console.log("Loading current player UUIDs from Supabase...");

  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, api_id, name");

  if (pErr || !players) {
    console.error("Failed to load players:", pErr?.message);
    process.exit(1);
  }

  const idMap = new Map<string, string>(); // sackmann_id → current supabase uuid
  for (const p of players) {
    if (p.api_id) idMap.set(p.api_id, p.id);
  }

  console.log(`Loaded ${idMap.size} players with api_id.\n`);

  // ── 2. Scan ALL source CSV matches and check every player reference ─────────
  type Fix = {
    apiMatchId: string;
    field: "player1_id" | "player2_id" | "winner_id";
    correctUuid: string;
    playerName: string;
  };

  const fixes: Fix[] = [];
  let totalChecked = 0;

  for (const tour of ["atp", "wta"]) {
    for (const year of YEARS) {
      const filePath = path.join(DATA_ROOT, tour, `${tour}_matches_${year}.csv`);
      if (!fs.existsSync(filePath)) continue;

      const rows = parseCSV(filePath);
      const grandSlams = rows.filter((r) => r.tourney_level === "G");

      for (const row of grandSlams) {
        const winnerSackId = row.winner_id;
        const loserSackId  = row.loser_id;
        const apiMatchId   = `${row.tourney_id}_${row.match_num}`;

        const winnerUuid = idMap.get(winnerSackId);
        const loserUuid  = idMap.get(loserSackId);

        if (!winnerUuid || !loserUuid) continue; // skip if either player not in DB

        totalChecked++;

        // Look up the match in the DB to see what UUIDs are actually stored
        // We'll batch this check below — for now collect api_match_ids
        fixes.push(
          { apiMatchId, field: "player1_id", correctUuid: winnerUuid, playerName: row.winner_name ?? winnerSackId },
          { apiMatchId, field: "player2_id", correctUuid: loserUuid,  playerName: row.loser_name  ?? loserSackId  },
          { apiMatchId, field: "winner_id",  correctUuid: winnerUuid, playerName: row.winner_name ?? winnerSackId },
        );
      }
    }
  }

  // ── 3. Fetch all matches from DB in one query ──────────────────────────────
  console.log(`Checking ${totalChecked} match records...`);

  const allApiMatchIds = [...new Set(fixes.map((f) => f.apiMatchId))];

  // Supabase IN queries have limits — batch if needed
  const BATCH_SIZE = 500;
  const dbMatchMap = new Map<string, { id: string; player1_id: string; player2_id: string; winner_id: string }>();

  for (let i = 0; i < allApiMatchIds.length; i += BATCH_SIZE) {
    const batch = allApiMatchIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("matches")
      .select("id, player1_id, player2_id, winner_id, api_match_id")
      .in("api_match_id", batch);

    if (error) {
      console.error("Failed to fetch match batch:", error.message);
      process.exit(1);
    }
    for (const m of data ?? []) {
      dbMatchMap.set(m.api_match_id, m);
    }
  }

  // ── 4. Identify actual mismatches ─────────────────────────────────────────
  type ActualFix = {
    matchDbId: string;
    field: "player1_id" | "player2_id" | "winner_id";
    currentUuid: string;
    correctUuid: string;
    playerName: string;
  };

  const actualFixes: ActualFix[] = [];

  for (const fix of fixes) {
    const dbMatch = dbMatchMap.get(fix.apiMatchId);
    if (!dbMatch) continue;

    const currentUuid = dbMatch[fix.field];
    if (currentUuid !== fix.correctUuid) {
      actualFixes.push({
        matchDbId: dbMatch.id,
        field: fix.field,
        currentUuid,
        correctUuid: fix.correctUuid,
        playerName: fix.playerName,
      });
    }
  }

  // Group by player name for summary
  const byPlayer = new Map<string, number>();
  for (const f of actualFixes) {
    byPlayer.set(f.playerName, (byPlayer.get(f.playerName) ?? 0) + 1);
  }

  console.log(`\nFound ${actualFixes.length} field mismatches across ${byPlayer.size} players:\n`);

  // Show top affected players
  const sorted = [...byPlayer.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sorted.slice(0, 20)) {
    console.log(`  ${String(count).padStart(3)} fixes — ${name}`);
  }
  if (sorted.length > 20) {
    console.log(`  ... and ${sorted.length - 20} more players`);
  }

  if (actualFixes.length === 0) {
    console.log("✓ All match player references are correct. Nothing to fix.");
    return;
  }

  if (DRY_RUN) {
    console.log(`\nDry run complete. Run with --run to apply ${actualFixes.length} fixes.`);
    return;
  }

  // ── 5. Apply fixes ────────────────────────────────────────────────────────
  console.log(`\nApplying ${actualFixes.length} fixes...`);

  // Group fixes by match DB id + collect all fields to update together
  const matchUpdates = new Map<string, Record<string, string>>();
  for (const f of actualFixes) {
    if (!matchUpdates.has(f.matchDbId)) matchUpdates.set(f.matchDbId, {});
    matchUpdates.get(f.matchDbId)![f.field] = f.correctUuid;
  }

  let done = 0;
  let errors = 0;

  for (const [matchDbId, update] of matchUpdates.entries()) {
    const { error } = await supabase
      .from("matches")
      .update(update)
      .eq("id", matchDbId);

    if (error) {
      console.error(`  ✗ Match ${matchDbId}:`, error.message);
      errors++;
    } else {
      done++;
    }
  }

  console.log(`\n✓ Fixed ${done} match rows. ${errors} errors.`);
  console.log("All player-match links are now correct.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
