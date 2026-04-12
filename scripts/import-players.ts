/**
 * import-players.ts
 *
 * Reads all ATP and WTA match CSVs, collects every unique player who
 * appeared in a Grand Slam match between 2020–2024, looks them up in
 * the player master files, and upserts them into the Supabase players table.
 *
 * Run with: npm run import:players
 */

import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DATA_ROOT = path.join(process.cwd(), "data/sackmann");
const YEARS = [2020, 2021, 2022, 2023, 2024];

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

function dobToAge(dob: string): number | null {
  if (!dob || dob.length !== 8) return null;
  const year  = parseInt(dob.slice(0, 4));
  const month = parseInt(dob.slice(4, 6));
  const day   = parseInt(dob.slice(6, 8));
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) age--;
  return age;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Step 1: Find all unique player IDs from Grand Slam matches ─────────────
  console.log("Scanning match files for Grand Slam players...");

  // sackmann_player_id → { most_recent_rank, most_recent_date, tour }
  const playerRankMap = new Map<string, { rank: number | null; date: string; tour: string }>();

  for (const tour of ["atp", "wta"]) {
    for (const year of YEARS) {
      const filePath = path.join(DATA_ROOT, tour, `${tour}_matches_${year}.csv`);
      if (!fs.existsSync(filePath)) continue;

      const rows = parseCSV(filePath);
      // G = Grand Slam, M = ATP Masters 1000, PM = WTA Premier Mandatory (= WTA 1000)
      const majors = rows.filter((r) => r.tourney_level === "G" || r.tourney_level === "M" || r.tourney_level === "PM");

      for (const row of majors) {
        const date = row.tourney_date;

        for (const [idCol, rankCol] of [
          ["winner_id", "winner_rank"],
          ["loser_id",  "loser_rank"],
        ] as [string, string][]) {
          const id   = row[idCol];
          const rank = parseInt(row[rankCol]) || null;
          if (!id) continue;

          const existing = playerRankMap.get(id);
          if (!existing || date > existing.date) {
            playerRankMap.set(id, { rank, date, tour: tour.toUpperCase() });
          }
        }
      }
    }
  }

  console.log(`Found ${playerRankMap.size} unique players across Grand Slams 2020–2024.`);

  // ── Step 2: Load player master files (kept separate per tour) ───────────────
  console.log("Loading player master files...");

  // IMPORTANT: ATP and WTA player master files share overlapping numeric IDs.
  // Keep them in separate maps and look up using the correct tour.
  const atpMaster = new Map<string, Record<string, string>>();
  const wtaMaster = new Map<string, Record<string, string>>();

  for (const tour of ["atp", "wta"]) {
    const map = tour === "atp" ? atpMaster : wtaMaster;
    const filePath = path.join(DATA_ROOT, tour, `${tour}_players.csv`);
    const rows = parseCSV(filePath);
    for (const row of rows) {
      map.set(row.player_id, row);
    }
  }

  console.log(`Loaded ${atpMaster.size} ATP + ${wtaMaster.size} WTA players from master files.`);

  // ── Step 3: Build player records and upsert ─────────────────────────────────
  console.log("Building player records...");

  const toUpsert: object[] = [];

  for (const [sackmannId, { rank, tour }] of playerRankMap.entries()) {
    const masterMap = tour === "ATP" ? atpMaster : wtaMaster;
    const master    = masterMap.get(sackmannId);
    const firstName = master?.name_first ?? "";
    const lastName  = master?.name_last  ?? "";
    const name      = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (!name) continue;

    const country = master?.ioc ?? null;
    const dob     = master?.dob ?? null;
    const age     = dobToAge(dob ?? "");

    toUpsert.push({
      name,
      country,
      age,
      current_rank: rank,
      api_id:       sackmannId,
      career_stats: { tour },
    });
  }

  console.log(`Upserting ${toUpsert.length} players into Supabase...`);

  const BATCH = 100;
  let inserted = 0;

  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const batch = toUpsert.slice(i, i + BATCH);
    const { error } = await supabase
      .from("players")
      .upsert(batch, { onConflict: "api_id" });

    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  ${inserted}/${toUpsert.length} players upserted`);
  }

  console.log("✓ Players import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
