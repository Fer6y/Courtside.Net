/**
 * _audit-slam-wins.ts — DRY RUN. Reconciles players.career_stats.slam_wins
 * against a hand-verified map of Grand Slam SINGLES champions (career totals,
 * through Jan 2026). Writes nothing — just reports:
 *   MISSING   champion in DB with no/zero slam_wins
 *   WRONG     champion in DB whose slam_wins != verified
 *   OK        champion in DB whose slam_wins == verified
 *   PHANTOM   DB row has slam_wins but player is NOT a verified champion
 *   NOT-IN-DB champion not found in the players table
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Verified career Grand Slam SINGLES titles, per slam. Keys use API slam names.
const CHAMPIONS: Record<string, Record<string, number>> = {
  // ── Men ───────────────────────────────────────────────
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

  // ── Women ─────────────────────────────────────────────
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
const champByNorm = new Map<string, { name: string; wins: Record<string, number> }>();
for (const [name, wins] of Object.entries(CHAMPIONS)) champByNorm.set(norm(name), { name, wins });

const total = (w: Record<string, number> | null | undefined) => w ? Object.values(w).reduce((a, b) => a + (b || 0), 0) : 0;
const eq = (a: Record<string, number> | null | undefined, b: Record<string, number>) => {
  const ae = Object.entries(a ?? {}).filter(([, v]) => v > 0).sort();
  const be = Object.entries(b).filter(([, v]) => v > 0).sort();
  return JSON.stringify(ae) === JSON.stringify(be);
};

(async () => {
  // Paginate past the 1000-row cap.
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("players")
      .select("id, name, current_rank, career_stats")
      .not("api_player_key", "is", null)
      .range(from, from + 999);
    if (error) { console.error(error); return; }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  console.log(`Fetched ${rows.length} players\n`);

  const matchedNorms = new Set<string>();
  const missing: string[] = [], wrong: string[] = [], ok: string[] = [], phantom: string[] = [];

  for (const p of rows) {
    const champ = champByNorm.get(norm(p.name));
    const cur = p.career_stats?.slam_wins as Record<string, number> | undefined;
    if (champ) {
      matchedNorms.add(norm(p.name));
      if (total(cur) === 0) missing.push(`${p.name}  →  ${JSON.stringify(champ.wins)}`);
      else if (!eq(cur, champ.wins)) wrong.push(`${p.name}  DB:${JSON.stringify(cur)}  →  VERIFIED:${JSON.stringify(champ.wins)}`);
      else ok.push(`${p.name}  ${JSON.stringify(champ.wins)}`);
    } else if (total(cur) > 0) {
      phantom.push(`${p.name}  DB:${JSON.stringify(cur)}  (not a verified slam champion)`);
    }
  }

  const notInDb = [...champByNorm.entries()].filter(([n]) => !matchedNorms.has(n)).map(([, c]) => c.name);

  const sec = (t: string, a: string[]) => { console.log(`\n=== ${t} (${a.length}) ===`); a.sort().forEach(x => console.log("  " + x)); };
  sec("MISSING — champion in DB, no slam_wins (will ADD)", missing);
  sec("WRONG — champion in DB, slam_wins differ (will FIX)", wrong);
  sec("PHANTOM — DB has slam_wins but not a verified champion (will CLEAR)", phantom);
  sec("OK — already correct", ok);
  sec("NOT-IN-DB — champion not found in players table", notInDb);
})();
