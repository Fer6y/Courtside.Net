import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await db.from("players").select("id, name, current_rank, career_stats").ilike("name", "%federer%");
  console.log(JSON.stringify(data, null, 2));
}
main().then(() => process.exit(0));
