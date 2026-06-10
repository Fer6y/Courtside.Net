/**
 * probe-player-profile.ts
 *
 * Fetches one player profile from MatchStat and logs every field returned.
 * Used to identify the correct photo_url field name before writing backfill.
 *
 * Run: npx tsx scripts/probe-player-profile.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { matchstat } from "../lib/matchstat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get a few known player API keys from the DB
  const { data: players } = await supabase
    .from("players")
    .select("name, api_player_key")
    .not("api_player_key", "is", null)
    .order("current_rank", { ascending: true, nullsFirst: false })
    .limit(3);

  if (!players || players.length === 0) {
    console.log("No API players found in DB.");
    return;
  }

  for (const p of players) {
    const id = String(p.api_player_key);
    console.log(`\n─── ${p.name} (api_player_key: ${id}) ───`);

    try {
      const profile = await matchstat<Record<string, unknown>>(
        `atp/player/profile/${id}`,
        { include: "ranking,country" }
      );

      // Print all top-level keys and their values (truncated)
      console.log("All fields returned:");
      for (const [key, val] of Object.entries(profile)) {
        const display =
          typeof val === "object" && val !== null
            ? JSON.stringify(val).slice(0, 120)
            : String(val).slice(0, 120);
        console.log(`  ${key.padEnd(20)} = ${display}`);
      }
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message}`);
    }
  }
}

main().catch(console.error);
