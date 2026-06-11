import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  // Check a few WTA players in api_raw_staging to see what photo the API gave us
  const { data: players } = await supabase
    .from("players")
    .select("name, api_player_key, photo_url, career_stats")
    .filter("career_stats->>tour", "eq", "WTA")
    .not("api_player_key", "is", null)
    .order("current_rank", { ascending: true, nullsFirst: false })
    .limit(5);

  for (const p of players ?? []) {
    const { data: staged } = await supabase
      .from("api_raw_staging")
      .select("response")
      .eq("method", "get_players")
      .eq("params->>player_id", p.api_player_key)
      .single();

    const apiPhoto = (staged?.response as Record<string, unknown>)?.data?.photo ?? null;
    console.log(`\n${p.name}`);
    console.log(`  current photo_url: ${p.photo_url}`);
    console.log(`  api_raw photo:     ${apiPhoto}`);
  }
}

main().catch(console.error);
