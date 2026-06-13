/**
 * merge-fullname-twin-dupes.ts
 *
 * Final orphan pass: ranked players stored under a short broadcast name whose
 * photo-bearing twin lives under the full legal name (e.g. "Pedro Martinez" vs
 * "Pedro Martinez Portero"). Each pair below was confirmed by hand AND by a
 * same-country + token-subset check, so there is no risk of pairing different
 * players (the short name's tokens are a strict subset of the full name's).
 *
 * Keeps the photo/api record, renames it to the common display name, copies
 * the orphan's current_rank, deletes the orphan. Re-verifies at runtime that
 * the orphan has ZERO refs in matches/skill_ratings before deleting.
 *
 * Dry-run by default. Pass --execute to apply.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EXECUTE = process.argv.includes("--execute");

// [ orphan/short name (delete, keep its rank) , full-name twin (keep, has photo) , display name ]
const TRIPLES: [string, string, string][] = [
  ["Pedro Martinez", "Pedro Martinez Portero", "Pedro Martinez"],
  ["Jaume Munar", "Jaume Antoni Munar Clar", "Jaume Munar"],
  ["Paula Badosa", "Paula Badosa Gibert", "Paula Badosa"],
  ["Camila Osorio", "Maria Camila Osorio Serrano", "Camila Osorio"],
  ["Alison Riske Amritraj", "Alison Riske", "Alison Riske Amritraj"],
  ["Irene Burillo Escorihuela", "Irene Burillo", "Irene Burillo"],
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
  console.log(EXECUTE ? "=== EXECUTE ===\n" : "=== DRY RUN ===\n");

  const players = await pageAll("players", "id,name,country,current_rank,photo_url,api_player_key");
  const matches = await pageAll("matches", "id,player1_id,player2_id,winner_id");
  const skills = await pageAll("skill_ratings", "id,player_id");
  const refs = new Map<string, number>();
  for (const m of matches) for (const id of [m.player1_id, m.player2_id, m.winner_id]) if (id) refs.set(id, (refs.get(id) ?? 0) + 1);
  for (const s of skills) if (s.player_id) refs.set(s.player_id, (refs.get(s.player_id) ?? 0) + 1);
  const byName = new Map<string, any[]>();
  for (const p of players) { const k = (p.name || "").trim(); if (!byName.has(k)) byName.set(k, []); byName.get(k)!.push(p); }

  let merged = 0, skipped = 0;
  for (const [orphanName, twinName, display] of TRIPLES) {
    const os = byName.get(orphanName) ?? [], cs = byName.get(twinName) ?? [];
    if (os.length !== 1 || cs.length !== 1) { console.log(`SKIP "${orphanName}"/"${twinName}" (${os.length}/${cs.length})`); skipped++; continue; }
    const orphan = os[0], keep = cs[0];
    if (orphan.country !== keep.country) { console.log(`SKIP "${orphanName}" (country mismatch)`); skipped++; continue; }
    if (!keep.photo_url || !keep.api_player_key) { console.log(`SKIP "${orphanName}" (twin lacks photo/api)`); skipped++; continue; }
    const r = refs.get(orphan.id) ?? 0;
    if (r > 0) { console.log(`SKIP "${orphanName}" (orphan has ${r} refs)`); skipped++; continue; }

    console.log(`MERGE delete "${orphan.name}" (rank ${orphan.current_rank}) -> keep "${keep.name}" as "${display}" (photo ✓, rank ->${orphan.current_rank})`);
    if (EXECUTE) {
      const { error: uErr } = await sb.from("players").update({ name: display, current_rank: orphan.current_rank }).eq("id", keep.id);
      if (uErr) { console.log(`   ✗ update: ${uErr.message}`); skipped++; continue; }
      const { error: dErr } = await sb.from("players").delete().eq("id", orphan.id);
      if (dErr) { console.log(`   ✗ delete: ${dErr.message}`); skipped++; continue; }
    }
    merged++;
  }
  console.log(`\n${EXECUTE ? "Merged" : "Would merge"}: ${merged}.  Skipped: ${skipped}.`);
}
main().catch(e => { console.error(e); process.exit(1); });
