import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  // total matches in table
  const { count } = await db.from("matches").select("*", { count: "exact", head: true });
  console.log("total matches in table:", count);

  // any player whose name contains federer (broad)
  const { data: ps } = await db.from("players").select("id, name, current_rank, api_player_key").ilike("name", "%feder%");
  console.log("name~feder players:", ps);

  // For the ATP top-30 list, replicate the players-page query and show what stat each would render
  const { data: top } = await db.from("players")
    .select("id, name, current_rank, api_player_key, career_stats")
    .filter("career_stats->>tour", "eq", "ATP")
    .not("api_player_key", "is", null)
    .lte("current_rank", 30)
    .not("current_rank", "is", null)
    .order("current_rank", { ascending: true });
  console.log("\nATP top-30 count:", top?.length);
  console.log(top?.map((p) => `#${p.current_rank} ${p.name}`).join("\n"));
}
main().then(() => process.exit(0));
