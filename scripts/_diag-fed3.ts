import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FED = "01ea247d-e31b-449c-a2cf-6228b609e4cd";
async function main() {
  const { data: sample } = await db.from("matches").select("id, player1_id, player2_id, winner_id, surface, tour").limit(3);
  console.log("sample match rows:", JSON.stringify(sample, null, 2));

  const { count: asP1 } = await db.from("matches").select("*", { count: "exact", head: true }).eq("player1_id", FED);
  const { count: asP2 } = await db.from("matches").select("*", { count: "exact", head: true }).eq("player2_id", FED);
  console.log(`Federer UUID as player1: ${asP1}, as player2: ${asP2}`);

  // by api_player_key just in case
  const { count: byKey1 } = await db.from("matches").select("*", { count: "exact", head: true }).eq("player1_id", "19");
  console.log(`api_key '19' as player1: ${byKey1}`);
}
main().then(() => process.exit(0));
