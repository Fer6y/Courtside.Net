/**
 * probe-player-info.ts
 * Prints the complete `information` object from a player profile response.
 * Run: npx tsx scripts/probe-player-info.ts
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
  const { data: players } = await supabase
    .from("players")
    .select("name, api_player_key")
    .not("api_player_key", "is", null)
    .order("current_rank", { ascending: true, nullsFirst: false })
    .limit(3);

  for (const p of players ?? []) {
    const profile = await matchstat<Record<string, unknown>>(
      `atp/player/profile/${p.api_player_key}`,
      { include: "ranking,country" }
    );
    console.log(`\n─── ${p.name} ───`);
    console.log("information:", JSON.stringify(profile.information, null, 2));
    console.log("ALL KEYS:", Object.keys(profile).join(", "));
  }
}

main().catch(console.error);
