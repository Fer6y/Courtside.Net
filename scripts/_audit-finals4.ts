/**
 * _audit-finals4.ts — read-only. For each polluted slam group:
 *  - count reviews / watched_matches attached to its rows
 *  - sample the date range (to identify which real tournament it actually is)
 *
 * Run: npx tsx scripts/_audit-finals4.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The 18 suspect (tournament, tour) groups flagged as partial
const SUSPECTS: [string, string][] = [
  ["Australian Open 2020", "ATP"],
  ["Australian Open 2020", "WTA"],
  ["Roland Garros 2020", "ATP"],
  ["US Open 2020", "ATP"],
  ["Australian Open 2021", "ATP"],
  ["Roland Garros 2021", "ATP"],
  ["Wimbledon 2021", "ATP"],
  ["US Open 2021", "ATP"],
  ["Australian Open 2022", "ATP"],
  ["Roland Garros 2023", "ATP"],
  ["Roland Garros 2023", "WTA"],
  ["Wimbledon 2023", "ATP"],
  ["Australian Open 2024", "ATP"],
  ["Australian Open 2024", "WTA"],
  ["US Open 2024", "ATP"],
  ["Wimbledon 2024", "ATP"],
  ["Australian Open 2025", "ATP"],
  ["Roland Garros 2025", "WTA"],
  ["Australian Open 2026", "WTA"],
];

async function main() {
  for (const [tournament, tour] of SUSPECTS) {
    const { data: rows, error } = await supabase
      .from("matches")
      .select("id, match_date, round")
      .eq("tournament", tournament)
      .eq("tour", tour)
      .limit(500);
    if (error) throw error;
    const ids = rows.map((r) => r.id);
    const dates = rows.map((r) => r.match_date).filter(Boolean).sort();

    const { count: reviewCount } = await supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .in("match_id", ids);
    const { count: watchedCount } = await supabase
      .from("watched_matches")
      .select("id", { count: "exact", head: true })
      .in("match_id", ids);

    console.log(
      `${tournament} ${tour}: ${rows.length} rows, dates ${dates[0] ?? "?"} → ${dates[dates.length - 1] ?? "?"}, ` +
        `reviews=${reviewCount ?? 0}, watched=${watchedCount ?? 0}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
