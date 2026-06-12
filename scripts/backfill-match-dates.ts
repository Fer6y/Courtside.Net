/**
 * scripts/backfill-match-dates.ts
 *
 * One-time backfill: populates matches.match_date from the raw API fixture
 * data already staged in the api_raw_staging table — zero API calls.
 *
 * Why: the original import's normaliseDate() didn't recognise the ISO
 * timestamp format the API returns ("2020-01-26T00:00:00.000Z"), so every
 * match_date was silently stored as NULL. The raw responses kept the dates.
 *
 * How it works:
 *   1. Page through all get_fixtures rows in api_raw_staging
 *   2. Build a map: fixture id (= matches.api_event_key) → date (YYYY-MM-DD)
 *   3. Page through matches missing a date
 *   4. Group them by date and update each group in one query
 *
 * Safe to re-run: only touches rows where match_date IS NULL.
 *
 * Run with: npx tsx scripts/backfill-match-dates.ts
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Load env from .env.local (same pattern as other scripts)
const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

type Fixture = { id?: unknown; date?: unknown };

function toDateOnly(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

async function main() {
  // ── 1. Collect fixture id → date from staging ────────────────────────────
  console.log("Reading staged fixture data…");
  const dateByEventKey = new Map<string, string>();

  let from = 0;
  const PAGE = 20; // staging payloads are large — small pages
  while (true) {
    const { data, error } = await supabase
      .from("api_raw_staging")
      .select("response")
      .eq("method", "get_fixtures")
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`staging read failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const singles = (row.response as { singles?: Fixture[] })?.singles ?? [];
      for (const f of singles) {
        const key  = String(f.id ?? "").trim();
        const date = toDateOnly(f.date);
        if (key && date) dateByEventKey.set(key, date);
      }
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`  ${dateByEventKey.size} fixture dates found in staging`);

  // ── 2. Fetch matches missing a date ──────────────────────────────────────
  console.log("Reading matches with NULL match_date…");
  const missing: { id: string; api_event_key: string | null }[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select("id, api_event_key")
      .is("match_date", null)
      .range(from, from + 999);

    if (error) throw new Error(`matches read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    missing.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`  ${missing.length} matches missing a date`);

  // ── 3. Group by date, update each group in one query ─────────────────────
  const idsByDate = new Map<string, string[]>();
  let unmatched = 0;
  for (const m of missing) {
    const date = m.api_event_key ? dateByEventKey.get(m.api_event_key) : undefined;
    if (!date) { unmatched++; continue; }
    if (!idsByDate.has(date)) idsByDate.set(date, []);
    idsByDate.get(date)!.push(m.id);
  }

  console.log(`Updating ${missing.length - unmatched} matches across ${idsByDate.size} distinct dates…`);
  let updated = 0;
  for (const [date, ids] of idsByDate) {
    // Chunk so the request URL stays a safe size
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await supabase
        .from("matches")
        .update({ match_date: date })
        .in("id", chunk);
      if (error) throw new Error(`update failed for ${date}: ${error.message}`);
      updated += chunk.length;
    }
  }

  console.log(`\n✓ Backfilled ${updated} match dates`);
  if (unmatched > 0) {
    console.log(`⚠️  ${unmatched} matches had no staged fixture date (no api_event_key match)`);
  }

  // Final coverage check
  const { count: stillNull } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .is("match_date", null);
  const { count: total } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });
  console.log(`Coverage: ${(total ?? 0) - (stillNull ?? 0)}/${total} matches now have a date`);
}

main().catch((e) => {
  console.error("BACKFILL FAILED:", e.message);
  process.exit(1);
});
