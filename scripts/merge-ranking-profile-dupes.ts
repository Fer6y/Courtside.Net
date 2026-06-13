/**
 * merge-ranking-profile-dupes.ts
 *
 * A batch import created two rows for many players: a "ranking record"
 * (has current_rank, but no photo / no api_player_key / no match links) and a
 * "profile record" (has photo + api_player_key + all match links, but
 * current_rank is null). The duplicate ranking rows surface on the rankings/
 * home pages with initials and no photo.
 *
 * For every exact-name pair where the non-API record has ZERO foreign-key
 * references (verified: no rows in matches or skill_ratings point to it), we:
 *   1. copy current_rank (and country if missing) onto the canonical
 *      API/photo record, then
 *   2. delete the orphan ranking record.
 *
 * Player rows are only referenced by matches (player1/2/winner_id) and
 * skill_ratings (player_id); h2h_cache and follows are empty; reviews key off
 * matches, not players. The script re-verifies the orphan has 0 refs at run
 * time and SKIPS (never deletes) anything that doesn't match the clean shape.
 *
 * Name matching normalizes case + apostrophes + accents so "Christopher
 * O'Connell" and "Christopher Oconnell" group together.
 *
 * Dry-run by default. Pass --execute to apply.
 *   npx tsx scripts/merge-ranking-profile-dupes.ts            # preview
 *   npx tsx scripts/merge-ranking-profile-dupes.ts --execute  # apply
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EXECUTE = process.argv.includes("--execute");

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

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

  const byName = new Map<string, any[]>();
  for (const p of players) { const k = norm(p.name || ""); if (!byName.has(k)) byName.set(k, []); byName.get(k)!.push(p); }
  const pairs = [...byName.values()].filter(a => a.length === 2);

  let merged = 0, skipped = 0;
  for (const g of pairs) {
    const canonical = g.find(p => p.api_player_key);
    const orphan = g.find(p => !p.api_player_key);
    // Must be exactly one API record and one non-API record.
    if (!canonical || !orphan || g.filter(p => p.api_player_key).length !== 1) {
      console.log(`SKIP (shape) "${g[0].name}"`); skipped++; continue;
    }
    // The record we delete must have no foreign-key references anywhere.
    const refs = (matchRefs.get(orphan.id) ?? 0) + (skillRefs.get(orphan.id) ?? 0);
    if (refs > 0) {
      console.log(`SKIP (orphan has ${refs} refs) "${g[0].name}"`); skipped++; continue;
    }

    const newRank = canonical.current_rank ?? orphan.current_rank;
    const newCountry = canonical.country ?? orphan.country;
    const patch: Record<string, unknown> = {};
    if (newRank !== canonical.current_rank) patch.current_rank = newRank;
    if (newCountry !== canonical.country) patch.country = newCountry;

    console.log(
      `MERGE "${canonical.name}"  keep=${canonical.id.slice(0, 8)} (rank ${canonical.current_rank ?? "-"}->${newRank ?? "-"})  ` +
      `delete=${orphan.id.slice(0, 8)} ("${orphan.name}", rank ${orphan.current_rank ?? "-"})`
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
