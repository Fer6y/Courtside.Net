import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await sb.from("players").select("id, country").not("api_player_key", "is", null).limit(3);
  for (const p of data ?? []) {
    console.log("type:", typeof p.country, "| value:", JSON.stringify(p.country));
  }
}
main().catch(console.error);
