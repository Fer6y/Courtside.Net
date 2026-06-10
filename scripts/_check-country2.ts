import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Check ALL distinct country values and their types
  const { data } = await sb.from("players").select("id, country").not("api_player_key", "is", null).limit(500);
  
  const types = new Map<string, number>();
  for (const p of data ?? []) {
    const t = typeof p.country + (p.country && typeof p.country === "string" && p.country.startsWith("{") ? "(json-string)" : "");
    types.set(t, (types.get(t) ?? 0) + 1);
    if (p.country && typeof p.country === "string" && p.country.startsWith("{")) {
      console.log("JSON-string example:", p.country.slice(0, 60));
    }
  }
  console.log("Type counts:", Object.fromEntries(types));
  console.log("Total rows:", data?.length);
}
main().catch(console.error);
