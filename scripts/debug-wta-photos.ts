import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  const { data } = await supabase
    .from("players")
    .select("name, photo_url, career_stats")
    .filter("career_stats->>tour", "eq", "WTA")
    .not("api_player_key", "is", null)
    .not("photo_url", "is", null)
    .order("current_rank", { ascending: true, nullsFirst: false })
    .limit(10);

  for (const p of data ?? []) {
    console.log(`${p.name}: ${p.photo_url}`);
  }
}

main().catch(console.error);
