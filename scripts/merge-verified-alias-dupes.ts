/**
 * merge-verified-alias-dupes.ts
 *
 * Final duplicate pass for known same-player name variants that differ by a
 * middle name or spelling (so the strict letters-only matcher can't pair them).
 * Each pair below was verified BY HAND as the same real player — this is an
 * explicit allowlist, NOT a fuzzy rule, so there is no risk of merging two
 * different people (e.g. Pedro Martinez vs Mario Vilella Martinez, or
 * Eduardo Nava vs Emilio Nava, which are deliberately absent).
 *
 * For each pair: the orphan (left, the ranking record with no photo/api) is
 * deleted and its current_rank copied onto the canonical (right, the record
 * that has photo + api_player_key + match links). The script re-verifies at
 * runtime that the orphan has ZERO references in matches/skill_ratings and
 * SKIPS it otherwise.
 *
 * Dry-run by default. Pass --execute to apply.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EXECUTE = process.argv.includes("--execute");

// [ orphan name (delete, keep its rank) , canonical name (keep, has photo) ]
const PAIRS: [string, string][] = [
  ["Coco Gauff", "Cori Gauff"],
  ["Danielle Collins", "Danielle Rose Collins"],
  ["Leylah Fernandez", "Leylah Annie Fernandez"],
  ["Thiago Monteiro", "Thiago Moura Monteiro"],
  ["Anna Karolina Schmiedlova", "Anna Schmiedlova"],
  ["Greet Minnen", "Greetje Minnen"],
  ["Lesia Tsurenko", "Lesya Tsurenko"],
  ["Jodie Burrage", "Jodie Anna Burrage"],
  ["Jason Kubler", "Jason Murray Kubler"],
  ["Irina Bara", "Irina Maria Bara"],
  ["Nastasja Schunk", "Nastasja Mariana Schunk"],
  ["Bianca Andreescu", "Bianca Vanessa Andreescu"],
  ["Thai Son Kwiatkowski", "Thai Kwiatkowski"],
  ["Santiago Fa Rodriguez Taverna", "Santiago Rodriguez Taverna"],
  ["Diego Schwartzman", "Diego Sebastian Schwartzman"],
  ["Coleman Wong", "Chak Lam Coleman Wong"],
];

async function pageAll(table: string, cols: string) {
  const out: any[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(f, f + 999);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  console.log(EXECUTE ? "=== EXECUTE MODE ===\n" : "=== DRY RUN (pass --execute to apply) ===\n");

  const players = await pageAll("players", "id,name,country,current_rank,photo_url,api_player_key");
  const matches = await pageAll("matches", "id,player1_id,player2_id,winner_id");
  const skills = await pageAll("skill_ratings", "id,player_id");
  const refs = new Map<string, number>();
  for (const m of matches) for (const id of [m.player1_id, m.player2_id, m.winner_id]) if (id) refs.set(id, (refs.get(id) ?? 0) + 1);
  for (const s of skills) if (s.player_id) refs.set(s.player_id, (refs.get(s.player_id) ?? 0) + 1);
  const byName = new Map<string, any[]>();
  for (const p of players) { const k = (p.name || "").trim(); if (!byName.has(k)) byName.set(k, []); byName.get(k)!.push(p); }

  let merged = 0, skipped = 0;
  for (const [orphanName, canonName] of PAIRS) {
    const os = byName.get(orphanName) ?? [];
    const cs = byName.get(canonName) ?? [];
    if (os.length !== 1 || cs.length !== 1) {
      console.log(`SKIP "${orphanName}"->"${canonName}" (found ${os.length}/${cs.length} rows)`); skipped++; continue;
    }
    const orphan = os[0], canonical = cs[0];
    if (canonical.api_player_key == null || canonical.photo_url == null) {
      console.log(`SKIP "${orphanName}" (canonical missing photo/api)`); skipped++; continue;
    }
    const r = refs.get(orphan.id) ?? 0;
    if (r > 0) { console.log(`SKIP "${orphanName}" (orphan has ${r} refs)`); skipped++; continue; }

    const newRank = orphan.current_rank ?? canonical.current_rank;
    const patch: Record<string, unknown> = {};
    if (newRank !== canonical.current_rank) patch.current_rank = newRank;
    if (canonical.country == null && orphan.country != null) patch.country = orphan.country;

    console.log(`MERGE delete "${orphan.name}" ${orphan.id.slice(0, 8)} (rank ${orphan.current_rank ?? "-"})  -> keep "${canonical.name}" ${canonical.id.slice(0, 8)} (rank ${canonical.current_rank ?? "-"}->${newRank ?? "-"}, photo ✓)`);

    if (EXECUTE) {
      if (Object.keys(patch).length) {
        const { error } = await sb.from("players").update(patch).eq("id", canonical.id);
        if (error) { console.log(`   ✗ update failed: ${error.message}`); skipped++; continue; }
      }
      const { error: delErr } = await sb.from("players").delete().eq("id", orphan.id);
      if (delErr) { console.log(`   ✗ delete failed: ${delErr.message}`); skipped++; continue; }
    }
    merged++;
  }
  console.log(`\n${EXECUTE ? "Merged" : "Would merge"}: ${merged}.  Skipped: ${skipped}.`);
}
main().catch(e => { console.error(e); process.exit(1); });
