import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check photo coverage
  const { data: photoStats } = await supabase
    .from("players")
    .select("photo_url")
    .not("api_player_key", "is", null);

  const total = photoStats?.length ?? 0;
  const withPhoto = (photoStats ?? []).filter((p) => p.photo_url).length;
  console.log(`Photos: ${withPhoto}/${total} API players have photo_url`);

  // Sample a few
  const { data: samples } = await supabase
    .from("players")
    .select("name, country, photo_url")
    .not("api_player_key", "is", null)
    .not("photo_url", "is", null)
    .limit(3);

  console.log("\nSample photo URLs:");
  for (const p of samples ?? []) {
    console.log(`  ${p.name} (${p.country}): ${p.photo_url}`);
  }
}

main().catch(console.error);
