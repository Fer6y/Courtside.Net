import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, country")
    .not("api_player_key", "is", null)
    .limit(10);

  if (error) { console.error(error); process.exit(1); }

  for (const p of data ?? []) {
    console.log(`name=${p.name}  country=${JSON.stringify(p.country)}  type=${typeof p.country}`);
  }

  // Also check how many have non-3-letter (or non-string) country
  const { data: all } = await supabase
    .from("players")
    .select("id, name, country")
    .not("api_player_key", "is", null);

  let nonStandard = 0;
  for (const p of all ?? []) {
    if (typeof p.country !== "string" || p.country.length !== 3) {
      nonStandard++;
      console.log(`  NON-STD: name=${p.name}  country=${JSON.stringify(p.country)}`);
    }
  }
  console.log(`\nTotal: ${all?.length}, Non-standard: ${nonStandard}`);
}

main().catch(console.error);
