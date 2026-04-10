/**
 * import-matches.ts
 *
 * Reads all ATP and WTA match CSVs, filters to Grand Slam matches only,
 * maps Sackmann player IDs to our Supabase UUIDs, and upserts into the
 * matches table.
 *
 * IMPORTANT: Run import-players.ts first.
 *
 * Run with: npm run import:matches
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

function formatDate(raw: string): string | null {
  if (!raw || raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function normaliseSurface(raw: string): "Hard" | "Clay" | "Grass" | "Carpet" | null {
  const map: Record<string, "Hard" | "Clay" | "Grass" | "Carpet"> = {
    hard:   "Hard",
    clay:   "Clay",
    grass:  "Grass",
    carpet: "Carpet",
  };
  return map[raw?.toLowerCase()] ?? null;
}

function expandRound(raw: string): string {
  const map: Record<string, string> = {
    F:    "Final",
    SF:   "Semifinal",
    QF:   "Quarterfinal",
    R16:  "Round of 16",
    R32:  "Round of 32",
    R64:  "Round of 64",
    R128: "Round of 128",
    RR:   "Round Robin",
  };
  return map[raw] ?? raw;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Step 1: Load player ID map from Supabase ──────────────────────────────
  console.log("Loading players from Supabase...");

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, api_id");

  if (playersError || !players) {
    console.error("Failed to load players:", playersError?.message);
    process.exit(1);
  }

  const idMap = new Map<string, string>(); // sackmann_id → supabase uuid
  for (const p of players) {
    if (p.api_id) idMap.set(p.api_id, p.id);
  }

  console.log(`Loaded ${idMap.size} players from Supabase.`);

  // ── Step 2: Parse match files ─────────────────────────────────────────────
  console.log("Parsing Grand Slam matches...");

  const toUpsert: object[] = [];
  let skipped = 0;

  for (const tour of ["atp", "wta"]) {
    for (const year of YEARS) {
      const filePath = path.join(DATA_ROOT, tour, `${tour}_matches_${year}.csv`);
      if (!fs.existsSync(filePath)) continue;

      const rows = parseCSV(filePath);
      // G = Grand Slam, M = ATP Masters 1000, PM = WTA Premier Mandatory (= WTA 1000)
      const grandSlams = rows.filter((r) => r.tourney_level === "G" || r.tourney_level === "M" || r.tourney_level === "PM");

      for (const row of grandSlams) {
        const player1Uuid = idMap.get(row.winner_id);
        const player2Uuid = idMap.get(row.loser_id);

        if (!player1Uuid || !player2Uuid) {
          skipped++;
          continue;
        }

        toUpsert.push({
          player1_id:   player1Uuid,
          player2_id:   player2Uuid,
          winner_id:    player1Uuid,
          tournament:   row.tourney_name,
          round:        expandRound(row.round),
          score:        row.score || null,
          surface:      normaliseSurface(row.surface),
          match_date:   formatDate(row.tourney_date),
          api_match_id: `${tour}_${row.tourney_id}_${row.match_num}`,
        });
      }
    }
  }

  console.log(`Built ${toUpsert.length} match records. Skipped ${skipped} (unresolved players).`);

  // ── Step 3: Upsert in batches ─────────────────────────────────────────────
  console.log("Upserting matches into Supabase...");

  const BATCH = 100;
  let inserted = 0;

  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const batch = toUpsert.slice(i, i + BATCH);
    const { error } = await supabase
      .from("matches")
      .upsert(batch, { onConflict: "api_match_id" });

    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  ${inserted}/${toUpsert.length} matches upserted`);
  }

  console.log("✓ Matches import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
