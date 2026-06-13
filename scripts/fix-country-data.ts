/**
 * fix-country-data.ts
 *
 * Normalizes the `players.country` column to a plain 3-letter code.
 * A batch of imports wrote the raw MatchStat shape — a stringified JSON
 * object `{"name":"Italy","acronym":"ITA"}` — instead of "ITA". That breaks
 * flag rendering (flagUrl can't parse it) and prints raw JSON anywhere the
 * column is shown as text.
 *
 * This rewrites every affected row to the bare acronym. Rows already storing
 * a clean code are left untouched. Idempotent — safe to re-run.
 *
 * Run: npx tsx scripts/fix-country-data.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { normalizeCountryCode } from "../lib/countryFlags";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Page through the whole table (Supabase caps selects at 1000 rows).
  const all: { id: string; country: unknown; name: string }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("players")
      .select("id, country, name")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`Scanned ${all.length} players.`);

  let fixed = 0;
  let unresolved = 0;
  for (const p of all) {
    const raw = p.country;
    // Only touch rows that aren't already a clean short code.
    const isCleanCode = typeof raw === "string" && !raw.startsWith("{") && raw.trim().length > 0 && raw.trim().length <= 4;
    if (isCleanCode) continue;
    if (raw == null) continue;

    const code = normalizeCountryCode(raw);
    if (!code) {
      unresolved++;
      console.log(`  ⚠ could not resolve: "${p.name}" -> ${JSON.stringify(raw)}`);
      continue;
    }
    const { error } = await sb.from("players").update({ country: code }).eq("id", p.id);
    if (error) {
      console.log(`  ✗ update failed for ${p.name}: ${error.message}`);
      continue;
    }
    fixed++;
    if (fixed % 50 === 0) process.stdout.write(`\r  Fixed ${fixed}...`);
  }
  console.log(`\nDone. Normalized ${fixed} rows. Unresolved: ${unresolved}.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
