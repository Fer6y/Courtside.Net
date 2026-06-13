/**
 * apply-slam-wins.ts — backfills players.career_stats.slam_wins from a
 * hand-verified map of Grand Slam SINGLES champions (career totals, through
 * Jan 2026), so every major winner shows their honours decal on The Field /
 * profiles — not just the few originally seeded.
 *
 *   - ADD    champions with no slam_wins
 *   - FIX    champions whose stored count differs from verified
 *   - CLEAR  rows that hold slam_wins but belong to a non-champion
 *            (lost finals had been miscredited as titles)
 *
 * slam_wins is MERGED into career_stats (tour/dob/country_full preserved).
 * Matches by accent-insensitive name. Run: npx tsx scripts/apply-slam-wins.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Verified career Grand Slam SINGLES titles, per slam. Keys = API slam names.
const CHAMPIONS: Record<string, Record<string, number>> = {
  "Novak Djokovic":        { "Australian Open": 10, "Roland Garros": 3, "Wimbledon": 7, "US Open": 4 },
  "Rafael Nadal":          { "Australian Open": 2, "Roland Garros": 14, "Wimbledon": 2, "US Open": 4 },
  "Roger Federer":         { "Australian Open": 6, "Roland Garros": 1, "Wimbledon": 8, "US Open": 5 },
  "Carlos Alcaraz":        { "Roland Garros": 2, "Wimbledon": 2, "US Open": 1 },
  "Jannik Sinner":         { "Australian Open": 2, "Wimbledon": 1, "US Open": 1 },
  "Andy Murray":           { "Wimbledon": 2, "US Open": 1 },
  "Stan Wawrinka":         { "Australian Open": 1, "Roland Garros": 1, "US Open": 1 },
  "Stanislas Wawrinka":    { "Australian Open": 1, "Roland Garros": 1, "US Open": 1 },
  "Daniil Medvedev":       { "US Open": 1 },
  "Dominic Thiem":         { "US Open": 1 },
  "Marin Cilic":           { "US Open": 1 },
  "Juan Martin Del Potro": { "US Open": 1 },

  "Serena Williams":       { "Australian Open": 7, "Roland Garros": 3, "Wimbledon": 7, "US Open": 6 },
  "Venus Williams":        { "Wimbledon": 5, "US Open": 2 },
  "Iga Swiatek":           { "Roland Garros": 4, "Wimbledon": 1, "US Open": 1 },
  "Aryna Sabalenka":       { "Australian Open": 2, "US Open": 1 },
  "Naomi Osaka":           { "Australian Open": 2, "US Open": 2 },
  "Ashleigh Barty":        { "Australian Open": 1, "Roland Garros": 1, "Wimbledon": 1 },
  "Simona Halep":          { "Roland Garros": 1, "Wimbledon": 1 },
  "Angelique Kerber":      { "Australian Open": 1, "Wimbledon": 1, "US Open": 1 },
  "Svetlana Kuznetsova":   { "Roland Garros": 1, "US Open": 1 },
  "Garbine Muguruza":      { "Roland Garros": 1, "Wimbledon": 1 },
  "Petra Kvitova":         { "Wimbledon": 2 },
  "Victoria Azarenka":     { "Australian Open": 2 },
  "Coco Gauff":            { "Roland Garros": 1, "US Open": 1 },
  "Barbora Krejcikova":    { "Roland Garros": 1, "Wimbledon": 1 },
  "Elena Rybakina":        { "Wimbledon": 1 },
  "Emma Raducanu":         { "US Open": 1 },
  "Bianca Andreescu":      { "US Open": 1 },
  "Sofia Kenin":           { "Australian Open": 1 },
  "Sloane Stephens":       { "US Open": 1 },
  "Jelena Ostapenko":      { "Roland Garros": 1 },
  "Marketa Vondrousova":   { "Wimbledon": 1 },
  "Madison Keys":          { "Australian Open": 1 },
  "Caroline Wozniacki":    { "Australian Open": 1 },
  "Samantha Stosur":       { "US Open": 1 },
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const champByNorm = new Map<string, Record<string, number>>();
for (const [name, wins] of Object.entries(CHAMPIONS)) champByNorm.set(norm(name), wins);

const total = (w: Record<string, number> | null | undefined) => w ? Object.values(w).reduce((a, b) => a + (b || 0), 0) : 0;
const eq = (a: Record<string, number> | null | undefined, b: Record<string, number>) => {
  const ae = Object.entries(a ?? {}).filter(([, v]) => v > 0).sort();
  const be = Object.entries(b).filter(([, v]) => v > 0).sort();
  return JSON.stringify(ae) === JSON.stringify(be);
};

(async () => {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("players")
      .select("id, name, career_stats")
      .not("api_player_key", "is", null)
      .range(from, from + 999);
    if (error) { console.error(error); return; }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  console.log(`Scanned ${rows.length} players\n`);

  let added = 0, fixed = 0, cleared = 0, errors = 0;

  for (const p of rows) {
    const champ = champByNorm.get(norm(p.name));
    const cs = (p.career_stats ?? {}) as Record<string, unknown>;
    const cur = cs.slam_wins as Record<string, number> | undefined;

    let next: Record<string, unknown> | null = null;
    let tag = "";

    if (champ) {
      if (!eq(cur, champ)) {
        next = { ...cs, slam_wins: champ };
        tag = total(cur) === 0 ? "ADD " : "FIX ";
      }
    } else if (total(cur) > 0) {
      // Non-champion holding slam_wins — strip the key entirely.
      const { slam_wins, ...rest } = cs;
      next = rest;
      tag = "CLR ";
    }

    if (!next) continue;

    const { error } = await db.from("players").update({ career_stats: next }).eq("id", p.id);
    if (error) { console.error(`  ERR ${p.name}: ${error.message}`); errors++; continue; }
    if (tag === "ADD ") added++; else if (tag === "FIX ") fixed++; else cleared++;
    console.log(`  ${tag}${p.name}  →  ${tag === "CLR " ? "(cleared)" : JSON.stringify(champ)}`);
  }

  console.log(`\nDone. Added ${added}, fixed ${fixed}, cleared ${cleared}, errors ${errors}.`);
})();
