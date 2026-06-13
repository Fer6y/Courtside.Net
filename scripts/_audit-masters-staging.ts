/**
 * _audit-masters-staging.ts — read-only.
 * Dumps every get_fixtures staging row tagged masters_1000: slam_name, year,
 * tour, seasonId, singles count + a peek at the first singles match's date.
 * Lets us see which seasonId fed each Masters group and spot wrong ones / gaps.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("api_raw_staging")
      .select("params, response")
      .eq("method", "get_fixtures")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const masters = rows.filter((r) => r.params?.tournament_tier === "masters_1000");
  masters.sort((a, b) =>
    `${a.params.slam_name} ${a.params.year} ${a.params.tour}`.localeCompare(
      `${b.params.slam_name} ${b.params.year} ${b.params.tour}`
    )
  );
  console.log(`get_fixtures rows: ${rows.length}, masters-tagged: ${masters.length}\n`);
  for (const r of masters) {
    const singles = r.response?.singles ?? [];
    const d0 = singles[0]?.date?.slice(0, 10) ?? "?";
    const dN = singles[singles.length - 1]?.date?.slice(0, 10) ?? "?";
    console.log(
      `  ${(r.params.slam_name + " " + r.params.year).padEnd(34)} ${r.params.tour}  season ${String(r.params.seasonId).padEnd(7)} singles=${String(singles.length).padStart(3)}  ${d0}…${dN}`
    );
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
