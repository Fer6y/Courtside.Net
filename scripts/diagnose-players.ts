/**
 * diagnose-players.ts
 *
 * Full diagnostic on the players table to detect:
 * 1. Total player counts vs what the source CSVs contain
 * 2. ATP/WTA api_id collisions (same numeric ID → wrong player in DB)
 * 3. Missing known top players
 * 4. How many players in the DB are actually the wrong tour
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

// Known top players we can use to sanity-check (name → Sackmann api_id)
const KNOWN_ATP: Record<string, string> = {
  "Novak Djokovic":     "104925",
  "Carlos Alcaraz":     "207989",
  "Jannik Sinner":      "206173",
  "Daniil Medvedev":    "106421",
  "Alexander Zverev":   "100644",
  "Andrey Rublev":      "126094",
  "Casper Ruud":        "126203",
  "Taylor Fritz":       "126207",
  "Stefanos Tsitsipas": "126774",
  "Roger Federer":      "103819",
  "Rafael Nadal":       "104745",
  "Holger Rune":        "208029",
  "Hubert Hurkacz":     "126869",
};

const KNOWN_WTA: Record<string, string> = {
  "Iga Swiatek":        "233494",
  "Aryna Sabalenka":    "222843",
  "Coco Gauff":         "230220",
  "Elena Rybakina":     "222946",
  "Jessica Pegula":     "221456",
  "Marketa Vondrousova":"219222",
  "Jasmine Paolini":    "221167",
  "Emma Navarro":       "230748",
};

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("═══════════════════════════════════════════════════");
  console.log("  PLAYER DATABASE DIAGNOSTIC");
  console.log("═══════════════════════════════════════════════════\n");

  // ── 1. Load all players from DB ─────────────────────────────────────────────
  const { data: dbPlayers, error } = await supabase
    .from("players")
    .select("id, name, api_id, current_rank, career_stats");

  if (error || !dbPlayers) {
    console.error("Failed to load players:", error?.message);
    process.exit(1);
  }

  console.log(`DB total: ${dbPlayers.length} players\n`);

  const dbByApiId = new Map<string, typeof dbPlayers[0]>();
  for (const p of dbPlayers) {
    if (p.api_id) dbByApiId.set(p.api_id, p);
  }

  // ── 2. Build unique player sets from source CSVs ─────────────────────────
  const atpPlayers = new Map<string, string>(); // api_id → name
  const wtaPlayers = new Map<string, string>(); // api_id → name

  for (const tour of ["atp", "wta"] as const) {
    const map = tour === "atp" ? atpPlayers : wtaPlayers;
    for (const year of YEARS) {
      const filePath = path.join(DATA_ROOT, tour, `${tour}_matches_${year}.csv`);
      if (!fs.existsSync(filePath)) continue;
      const rows = parseCSV(filePath);
      const relevant = rows.filter(
        (r) => r.tourney_level === "G" || r.tourney_level === "M" || r.tourney_level === "PM"
      );
      for (const row of relevant) {
        if (row.winner_id && row.winner_name) map.set(row.winner_id, row.winner_name);
        if (row.loser_id && row.loser_name)   map.set(row.loser_id,  row.loser_name);
      }
    }
  }

  console.log(`Source CSVs (Grand Slams + Masters only):`);
  console.log(`  ATP unique players: ${atpPlayers.size}`);
  console.log(`  WTA unique players: ${wtaPlayers.size}`);

  // ── 3. Find api_id collisions (same numeric ID in both tours) ─────────────
  const collisions: { apiId: string; atpName: string; wtaName: string; inDb?: string }[] = [];
  for (const [apiId, atpName] of atpPlayers) {
    if (wtaPlayers.has(apiId)) {
      const dbEntry = dbByApiId.get(apiId);
      collisions.push({
        apiId,
        atpName,
        wtaName: wtaPlayers.get(apiId)!,
        inDb: dbEntry?.name,
      });
    }
  }

  console.log(`\n─── Collision Analysis ─────────────────────────────`);
  console.log(`  ATP/WTA api_id collisions found: ${collisions.length}`);
  if (collisions.length > 0) {
    console.log(`  (Sample — first 15):`);
    for (const c of collisions.slice(0, 15)) {
      const stored = c.inDb ?? "NOT IN DB";
      const correct = stored === c.atpName ? "✓ ATP" : stored === c.wtaName ? "✗ WTA displaced ATP" : `✗ Unknown (${stored})`;
      console.log(`    ID ${c.apiId}: ATP="${c.atpName}" | WTA="${c.wtaName}" | DB="${stored}" → ${correct}`);
    }
    if (collisions.length > 15) console.log(`    ... and ${collisions.length - 15} more`);
  }

  // ── 4. Count how many DB entries are wrong-tour ──────────────────────────
  let atpDisplacedByWta = 0;
  const wtaDisplacedByAtp = 0;
  let correctAtp = 0;
  let correctWta = 0;
  let unknown = 0;

  for (const [apiId, dbPlayer] of dbByApiId) {
    const isAtp = atpPlayers.has(apiId);
    const isWta = wtaPlayers.has(apiId);
    if (isAtp && !isWta) {
      if (dbPlayer.name === atpPlayers.get(apiId)) correctAtp++;
      else unknown++;
    } else if (isWta && !isAtp) {
      if (dbPlayer.name === wtaPlayers.get(apiId)) correctWta++;
      else unknown++;
    } else if (isAtp && isWta) {
      // Collision — which one is in DB?
      if (dbPlayer.name === atpPlayers.get(apiId)) correctAtp++;
      else if (dbPlayer.name === wtaPlayers.get(apiId)) { atpDisplacedByWta++; }
      else unknown++;
    } else {
      unknown++;
    }
  }

  console.log(`\n─── DB Entry Accuracy ──────────────────────────────`);
  console.log(`  Correct ATP players:              ${correctAtp}`);
  console.log(`  Correct WTA players:              ${correctWta}`);
  console.log(`  ATP players displaced by WTA:     ${atpDisplacedByWta}`);
  console.log(`  WTA players displaced by ATP:     ${wtaDisplacedByAtp}`);
  console.log(`  Unknown / unmatched:              ${unknown}`);

  // ── 5. Known player sanity check ────────────────────────────────────────
  console.log(`\n─── Known ATP Top Players ──────────────────────────`);
  for (const [name, apiId] of Object.entries(KNOWN_ATP)) {
    const dbEntry = dbByApiId.get(apiId);
    if (!dbEntry) {
      console.log(`  ✗ MISSING:  ${name} (api_id ${apiId})`);
    } else if (dbEntry.name === name) {
      console.log(`  ✓ OK:       ${name} → ${dbEntry.id}`);
    } else {
      console.log(`  ✗ WRONG:    Expected "${name}", DB has "${dbEntry.name}" (api_id ${apiId})`);
    }
  }

  console.log(`\n─── Known WTA Top Players ──────────────────────────`);
  for (const [name, apiId] of Object.entries(KNOWN_WTA)) {
    const dbEntry = dbByApiId.get(apiId);
    if (!dbEntry) {
      console.log(`  ✗ MISSING:  ${name} (api_id ${apiId})`);
    } else if (dbEntry.name === name) {
      console.log(`  ✓ OK:       ${name} → ${dbEntry.id}`);
    } else {
      console.log(`  ✗ WRONG:    Expected "${name}", DB has "${dbEntry.name}" (api_id ${apiId})`);
    }
  }

  // ── 6. Players in source CSVs but completely missing from DB ────────────
  let atpMissing = 0;
  let wtaMissing = 0;

  for (const [apiId] of atpPlayers) {
    if (!dbByApiId.has(apiId)) atpMissing++;
  }
  for (const [apiId] of wtaPlayers) {
    if (!dbByApiId.has(apiId)) wtaMissing++;
  }

  console.log(`\n─── Players in CSVs but not in DB ──────────────────`);
  console.log(`  ATP players missing entirely: ${atpMissing}`);
  console.log(`  WTA players missing entirely: ${wtaMissing}`);

  // ── 7. Summary & recommendation ─────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  SUMMARY`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  Total api_id collisions: ${collisions.length}`);
  console.log(`  ATP players with wrong data in DB: ${atpDisplacedByWta}`);
  console.log(`  This means ~${atpDisplacedByWta} player profiles are broken`);
  console.log(`\n  Fix: prefix api_id with tour (atp_XXXXX / wta_XXXXX)`);
  console.log(`  then TRUNCATE players CASCADE + re-import everything.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
