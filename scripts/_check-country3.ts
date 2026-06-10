import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, count } = await sb.from("players")
    .select("id, country, api_player_key", { count: "exact" })
    .not("api_player_key", "is", null);
  
  console.log("Total API players:", count);
  
  // Find any with non 3-letter country
  const weird = (data ?? []).filter(p => 
    p.country && (typeof p.country !== "string" || p.country.length !== 3)
  );
  console.log("Non 3-letter country count:", weird.length);
  if (weird.length > 0) console.log("Examples:", weird.slice(0, 3).map(p => p.country));
}
main().catch(console.error);
