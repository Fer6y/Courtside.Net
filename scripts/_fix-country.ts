import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await sb.from("players").select("id, country").not("api_player_key", "is", null);
  if (error) { console.error(error.message); return; }
  
  let fixed = 0;
  for (const p of data ?? []) {
    let acronym: string | null = null;

    if (typeof p.country === "object" && p.country !== null) {
      acronym = (p.country as Record<string, string>).acronym ?? null;
    } else if (typeof p.country === "string" && p.country.startsWith("{")) {
      try {
        const parsed = JSON.parse(p.country);
        acronym = parsed.acronym ?? null;
      } catch { continue; }
    } else {
      continue; // already a clean code
    }

    if (!acronym) continue;
    await sb.from("players").update({ country: acronym }).eq("id", p.id);
    fixed++;
    if (fixed % 50 === 0) process.stdout.write(`\r  Fixed ${fixed}...`);
  }
  console.log(`\nFixed ${fixed} players`);
}
main().catch(console.error);
