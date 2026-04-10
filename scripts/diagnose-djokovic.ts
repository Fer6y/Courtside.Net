/**
 * diagnose-djokovic.ts
 *
 * Checks what happened to Djokovic's match data in the import.
 * Scans source CSVs for his matches, generates the api_match_ids,
 * then checks what's in Supabase for each one.
 */

import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DATA_ROOT = path.join(process.cwd(), "data/sackmann");
const YEARS = [2020, 2021, 2022, 2023, 2024];
const DJOKOVIC_ID = "104925";

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: Confirm Djokovic's row in Supabase
  const { data: djokovic } = await supabase
    .from("players")
    .select("id, name, api_id, current_rank")
    .eq("api_id", DJOKOVIC_ID)
    .single();

  console.log("Djokovic in Supabase:", djokovic);
  console.log("");

  if (!djokovic) {
    console.error("ERROR: No player row found with api_id = 104925!");
    return;
  }

  // Step 2: Collect all api_match_ids for Djokovic's source matches
  const djokovicMatchIds: string[] = [];
  const djokovicMatchMeta: { id: string; tourney: string; surface: string; year: number }[] = [];

  for (const year of YEARS) {
    const filePath = path.join(DATA_ROOT, "atp", `atp_matches_${year}.csv`);
    if (!fs.existsSync(filePath)) continue;

    const rows = parseCSV(filePath);
    const grandSlams = rows.filter((r) => r.tourney_level === "G");

    for (const row of grandSlams) {
      if (row.winner_id === DJOKOVIC_ID || row.loser_id === DJOKOVIC_ID) {
        const matchId = `atp_${row.tourney_id}_${row.match_num}`;
        djokovicMatchIds.push(matchId);
        djokovicMatchMeta.push({
          id: matchId,
          tourney: row.tourney_name,
          surface: row.surface,
          year,
        });
      }
    }
  }

  console.log(`Source CSVs: found ${djokovicMatchIds.length} Djokovic Grand Slam matches\n`);

  // Step 3: Look up these api_match_ids in Supabase
  const { data: dbMatches, error } = await supabase
    .from("matches")
    .select("id, player1_id, player2_id, winner_id, tournament, surface, api_match_id")
    .in("api_match_id", djokovicMatchIds);

  if (error) {
    console.error("Query error:", error.message);
    return;
  }

  console.log(`DB: found ${dbMatches?.length ?? 0} of those matches in Supabase\n`);

  // Step 4: For each found match, check if Djokovic's UUID is in it
  const djUUID = djokovic.id;
  let correct = 0;
  let wrongUUID = 0;
  let missing = 0;

  const foundIds = new Set((dbMatches ?? []).map((m) => m.api_match_id));

  for (const meta of djokovicMatchMeta) {
    const match = (dbMatches ?? []).find((m) => m.api_match_id === meta.id);

    if (!match) {
      missing++;
      if (missing <= 5) console.log(`  MISSING: ${meta.id} | ${meta.tourney} ${meta.surface} ${meta.year}`);
      continue;
    }

    const hasDjUUID = match.player1_id === djUUID || match.player2_id === djUUID || match.winner_id === djUUID;

    if (hasDjUUID) {
      correct++;
    } else {
      wrongUUID++;
      if (wrongUUID <= 10) {
        console.log(`  WRONG UUID: ${meta.id} | ${meta.tourney} ${meta.surface} ${meta.year}`);
        console.log(`    DB player1: ${match.player1_id}`);
        console.log(`    DB player2: ${match.player2_id}`);
        console.log(`    Expected:   ${djUUID}`);
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  ✓ Correct (Djokovic UUID in match):    ${correct}`);
  console.log(`  ✗ Wrong UUID (match exists, wrong player): ${wrongUUID}`);
  console.log(`  ✗ Missing (match not in DB at all):        ${missing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
