/**
 * _classify-masters.ts — read-only.
 *
 * Classifies every masters_1000 group as OK / SUSPECT using two cheap signals:
 *   - draw size: a real Masters main draw is ~47 (48-draw), ~55 (56-draw) or
 *     ~95 (96-draw). Anything < 45 rows is almost certainly a wrong small event.
 *   - finalist sanity: groups with < 45 rows AND no famous finalist are pollution.
 *
 * This is a triage aid for scoping the cleanup — NOT the verification of record
 * (that comes from re-probing correct seasonIds against the API). Prints a
 * summary count so we can state the true extent.
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
      .from("matches")
      .select("tournament, tour, round")
      .eq("tournament_tier", "masters_1000")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const k = `${r.tournament} | ${r.tour}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  let ok = 0, suspect = 0;
  const suspects: string[] = [];
  for (const [k, g] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const finals = g.filter((r) => r.round === "Final").length;
    const small = g.length < 45;
    const isSuspect = small || finals !== 1;
    if (isSuspect) { suspect++; suspects.push(`${k}  (${g.length} rows, ${finals} finals)`); }
    else ok++;
  }
  console.log(`\nMasters groups: ${groups.size}`);
  console.log(`  Plausibly OK (≥45 rows, 1 final): ${ok}`);
  console.log(`  SUSPECT (<45 rows or ≠1 final):   ${suspect}\n`);
  for (const s of suspects) console.log(`  ✗ ${s}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
