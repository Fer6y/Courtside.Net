/**
 * merge-punctuation-alias-dupes.ts
 *
 * Second pass after merge-ranking-profile-dupes.ts. Catches the same
 * ranking-record / profile-record duplication where the two rows differ ONLY
 * by spaces or hyphens in the name, e.g.:
 *   "Jan Lennard Struff"  vs  "Jan-Lennard Struff"
 *   "Xin Yu Wang"         vs  "Xinyu Wang"
 *   "Pierre Hugues Herbert" vs "Pierre-Hugues Herbert"
 *
 * Matching key = name lowercased, accents stripped, ALL non-letters removed
 * (so spaces and hyphens collapse). This is deliberately strict: it will NOT
 * match middle-name variants ("Danielle Collins" vs "Danielle Rose Collins"),
 * spelling variants ("Coco Gauff" vs "Cori Gauff"), or unrelated same-surname
 * players ("Pedro Martinez" vs "Mario Vilella Martinez") — those are left for
 * manual review.
 *
 * Guards (a group is SKIPPED unless all hold):
 *   - exactly one record without api_player_key (the orphan)
 *   - exactly one record with api_player_key + photo_url (the canonical)
 *   - the orphan has ZERO references in matches or skill_ratings
 *
 * The orphan carries the live ranking, so its rank is preferred. Then the
 * orphan is deleted.
 *
 * Dry-run by default. Pass --execute to apply.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EXECUTE = process.argv.includes("--execute");

// Letters only — collapses spaces AND hyphens, strips accents.
const key = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

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

  const matchRefs = new Map<string, number>();
  for (const m of matches) for (const id of [m.player1_id, m.player2_id, m.winner_id])
    if (id) matchRefs.set(id, (matchRefs.get(id) ?? 0) + 1);
  const skillRefs = new Map<string, number>();
  for (const s of skills) if (s.player_id) skillRefs.set(s.player_id, (skillRefs.get(s.player_id) ?? 0) + 1);

  const byKey = new Map<string, any[]>();
  for (const p of players) { const k = key(p.name || ""); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k)!.push(p); }
  const groups = [...byKey.values()].filter(a => a.length > 1);

  let merged = 0, skipped = 0;
  for (const g of groups) {
    const noApi = g.filter(p => !p.api_player_key);
    const canon = g.filter(p => p.api_player_key && p.photo_url);
    const names = g.map(p => `"${p.name}"`).join(" / ");
    if (noApi.length !== 1 || canon.length !== 1) {
      console.log(`SKIP (shape: ${g.length} rows, ${noApi.length} no-api, ${canon.length} canon) ${names}`); skipped++; continue;
    }
    const orphan = noApi[0];
    const canonical = canon[0];
    if (orphan.id === canonical.id) { console.log(`SKIP (same row) ${names}`); skipped++; continue; }

    const refs = (matchRefs.get(orphan.id) ?? 0) + (skillRefs.get(orphan.id) ?? 0);
    if (refs > 0) { console.log(`SKIP (orphan has ${refs} refs) ${names}`); skipped++; continue; }

    const newRank = orphan.current_rank ?? canonical.current_rank;   // ranking record wins
    const newCountry = canonical.country ?? orphan.country;
    const patch: Record<string, unknown> = {};
    if (newRank !== canonical.current_rank) patch.current_rank = newRank;
    if (newCountry !== canonical.country) patch.country = newCountry;

    console.log(
      `MERGE keep "${canonical.name}" ${canonical.id.slice(0, 8)} (rank ${canonical.current_rank ?? "-"}->${newRank ?? "-"})  ` +
      `delete "${orphan.name}" ${orphan.id.slice(0, 8)} (rank ${orphan.current_rank ?? "-"})`
    );

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
