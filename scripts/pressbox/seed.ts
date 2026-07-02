/**
 * seed.ts — populate Courtside with the Press Box's catalogue.
 *
 * What it does, in order:
 *   1. Ensures the ten persona profiles exist (clerk_user_id = "bot_<slug>",
 *      which is what the PRESS BOX tag in the UI keys off).
 *   2. Builds a match pool: slams 2024+ (R16 through Final), Masters 1000
 *      semis/finals 2025+, and every completed Wimbledon 2026 match.
 *   3. Each persona picks matches by taste (favourites, surface, drama,
 *      upsets, recency — Wimbledon 2026 is heavily boosted because it's on
 *      right now) and rates them with a persona-flavoured model driven by
 *      the actual scoreline. Hand-written texts from review-texts.ts are
 *      attached where they exist; everything else is a sliders-only log,
 *      which is what most real activity looks like anyway.
 *   4. Skill-rates players from the scouting book (skill-archetypes.ts)
 *      with per-persona jitter and emphasis.
 *   5. Awards achievements through the same lib the app uses.
 *
 * Determinism: all randomness is seeded from (persona, match/player), and
 * reviews/skill ratings upsert on their natural keys — so re-running the
 * script converges instead of duplicating. Remove everything with wipe.ts.
 *
 * Run:  npx tsx scripts/pressbox/seed.ts [--dry-run]
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { PERSONAS, BOT_PREFIX, type Persona } from "./personas";
import { SKILL_ARCHETYPES, AXES } from "./skill-archetypes";
import { REVIEW_TEXTS } from "./review-texts";
import { checkAndAwardAchievements } from "../../lib/checkAchievements";

const DRY_RUN = process.argv.includes("--dry-run");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Seeded randomness ─────────────────────────────────────────────────────────
// FNV-1a hash → mulberry32. Same inputs, same outputs, every run.
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function rng(seedStr: string): () => number {
  let a = hash32(seedStr) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const snapHalf = (v: number) => Math.round(v * 2) / 2;

// ── Score parsing ─────────────────────────────────────────────────────────────
type ScoreFeatures = {
  sets: number;
  tiebreaks: number;
  retired: boolean;
  wentDistance: boolean;   // decider played (3rd in bo3, 5th in bo5)
  finalSetTiebreak: boolean;
  tightSets: number;       // sets decided by ≤2 games (7-5, 7-6)
  closeness: number;       // 0–1, loser games / winner games
  blowout: boolean;
  loserSets: number;
};

function parseScore(score: string | null): ScoreFeatures | null {
  if (!score) return null;
  const retired = /ret/i.test(score);
  const setTokens = score.match(/\d+-\d+(\(\d+\))?/g) ?? [];
  if (setTokens.length === 0) return null;

  let winnerSets = 0, loserSets = 0, winnerGames = 0, loserGames = 0;
  let tiebreaks = 0, tightSets = 0, lastSetTb = false;

  for (const tok of setTokens) {
    const tb = /\(\d+\)/.test(tok);
    if (tb) tiebreaks++;
    lastSetTb = tb;
    const [a, b] = tok.replace(/\(\d+\)/, "").split("-").map(Number);
    winnerGames += a; loserGames += b;
    if (a > b) winnerSets++; else loserSets++;
    if (Math.abs(a - b) <= 2 && Math.max(a, b) >= 6) tightSets++;
  }

  const bestOf = winnerSets >= 3 ? 5 : 3;
  const wentDistance = !retired && loserSets === Math.floor(bestOf / 2) && winnerSets + loserSets === bestOf;
  const closeness = winnerGames > 0 ? clamp(loserGames / winnerGames, 0, 1) : 0;
  const blowout = !retired && (closeness < 0.45 || (loserGames <= 5 && setTokens.length >= 2));

  return {
    sets: setTokens.length, tiebreaks, retired, wentDistance,
    finalSetTiebreak: wentDistance && lastSetTb,
    tightSets, closeness, blowout, loserSets,
  };
}

// ── Pool types ────────────────────────────────────────────────────────────────
type PoolMatch = {
  id: string;
  tournament: string;
  round: string | null;
  score: string | null;
  surface: string | null;
  match_date: string | null;
  tournament_season: number | null;
  tournament_tier: string | null;
  winner_id: string | null;
  player1_id: string;
  player2_id: string;
  player1: { name: string; current_rank: number | null } | null;
  player2: { name: string; current_rank: number | null } | null;
};

const POOL_SELECT = `
  id, tournament, round, score, surface, match_date, tournament_season,
  tournament_tier, winner_id, player1_id, player2_id,
  player1:player1_id ( name, current_rank ),
  player2:player2_id ( name, current_rank )
`;

async function fetchPool(): Promise<PoolMatch[]> {
  const [slams, masters, wimbledon] = await Promise.all([
    supabase.from("matches").select(POOL_SELECT)
      .eq("tournament_tier", "grand_slam").gte("tournament_season", 2024)
      .in("round", ["Round of 16", "Quarterfinal", "Semifinal", "Final"])
      .not("winner_id", "is", null).limit(1000),
    supabase.from("matches").select(POOL_SELECT)
      .eq("tournament_tier", "masters_1000").gte("tournament_season", 2025)
      .in("round", ["Semifinal", "Final"])
      .not("winner_id", "is", null).limit(1000),
    supabase.from("matches").select(POOL_SELECT)
      .ilike("tournament", "%Wimbledon 2026%")
      .not("winner_id", "is", null).limit(1000),
  ]);
  for (const r of [slams, masters, wimbledon]) {
    if (r.error) throw new Error(r.error.message);
  }
  const byId = new Map<string, PoolMatch>();
  for (const row of [...(slams.data ?? []), ...(masters.data ?? []), ...(wimbledon.data ?? [])]) {
    byId.set((row as { id: string }).id, row as unknown as PoolMatch);
  }
  return [...byId.values()].filter((m) => m.player1?.name && m.player2?.name && m.score);
}

const matchKey = (m: PoolMatch) => `${m.tournament}::${m.round}::${m.player1!.name} v ${m.player2!.name}`;

// ── Persona scoring model ─────────────────────────────────────────────────────
const ROUND_WEIGHT: Record<string, number> = {
  "Final": 0.8, "Semifinal": 0.5, "Quarterfinal": 0.3, "Round of 16": 0.15,
};

function dramaScore(f: ScoreFeatures): number {
  return 0.25 * f.tiebreaks + (f.wentDistance ? 0.5 : 0) + (f.finalSetTiebreak ? 0.35 : 0) + (f.sets >= 5 ? 0.4 : 0);
}

function isUpset(m: PoolMatch): boolean {
  const winner = m.winner_id === m.player1_id ? m.player1 : m.player2;
  const loser  = m.winner_id === m.player1_id ? m.player2 : m.player1;
  if (!winner?.current_rank || !loser?.current_rank) return false;
  return winner.current_rank > loser.current_rank + 10;
}

function selectionScore(p: Persona, m: PoolMatch, f: ScoreFeatures): number {
  const r = rng(`sel|${p.slug}|${m.id}`);
  const names = [m.player1!.name, m.player2!.name];
  let s = 0;
  s += (ROUND_WEIGHT[m.round ?? ""] ?? 0) * (1 + p.weights.final);
  if (m.tournament_tier === "grand_slam") s += p.weights.slam;
  if (names.some((n) => p.favorites.includes(n))) s += 1.5;
  s += (p.surfaces[m.surface as "Hard" | "Clay" | "Grass"] ?? 0) * 1.2;
  s += dramaScore(f) * p.weights.drama * 0.8;
  if (isUpset(m)) s += p.weights.upset;
  s += ((m.tournament_season ?? 2024) - 2023) * 0.35;
  if (m.tournament.includes("Wimbledon 2026")) s += 2.2; // it's on right now
  s += r() * 1.4;
  return s;
}

function matchRating(p: Persona, m: PoolMatch, f: ScoreFeatures): number {
  const r = rng(`rate|${p.slug}|${m.id}`);
  const names = [m.player1!.name, m.player2!.name];
  let v = 6.0 + p.weights.generosity;
  v += dramaScore(f) * p.weights.drama;
  v += (f.tightSets * 0.15 + f.closeness * 0.6) * p.weights.quality;
  v += (ROUND_WEIGHT[m.round ?? ""] ?? 0) * p.weights.final;
  if (m.tournament_tier === "grand_slam") v += p.weights.slam * 0.5;
  if (names.some((n) => p.favorites.includes(n))) v += 0.3;
  v += (p.surfaces[m.surface as "Hard" | "Clay" | "Grass"] ?? 0) * 0.6;
  if (isUpset(m)) v += p.weights.upset * 0.4;
  if (f.blowout) v -= p.weights.blowoutPenalty;
  if (f.retired) v -= 1.6;
  v += (r() - 0.5) * 0.9;
  return round1(clamp(v, 2.5, 10));
}

function playerRatings(p: Persona, m: PoolMatch, f: ScoreFeatures): { p1: number; p2: number } {
  const r = rng(`plr|${p.slug}|${m.id}`);
  const winnerIsP1 = m.winner_id === m.player1_id;
  const winnerName = winnerIsP1 ? m.player1!.name : m.player2!.name;
  const loserName  = winnerIsP1 ? m.player2!.name : m.player1!.name;

  const dominance = 1 - f.closeness; // 0 tight → 1 rout
  // A close match means BOTH played well — the winner earns credit for the
  // quality of the contest as well as for dominance, otherwise five-set
  // epics rate the champion below the runner-up.
  let w = 6.6 + dominance * 1.4 + f.closeness * 1.0 + dramaScore(f) * 0.15 + (r() - 0.5) * 0.7;
  if (p.favorites.includes(winnerName)) w += 0.4;

  let l = 5.4 + f.closeness * 1.8 + (f.wentDistance ? 0.5 : 0) + (r() - 0.5) * 0.7;
  if (f.blowout) l -= 1.2;
  if (f.retired) l -= 1.0;
  if (p.favorites.includes(loserName)) l += 0.3;

  w = round1(clamp(w, 4, 10));
  l = round1(clamp(l, 1.5, 9));
  // Winner premium: they did, after all, win.
  if (l > w - 0.1) l = round1(Math.max(1.5, w - 0.1 - r() * 0.5));
  return winnerIsP1 ? { p1: w, p2: l } : { p1: l, p2: w };
}

// Review timestamp: a seeded few hours-to-days after the match, never in the future.
function reviewTimestamp(p: Persona, m: PoolMatch): string {
  const h = hash32(`ts|${p.slug}|${m.id}`);
  const base = m.match_date ? new Date(`${m.match_date}T12:00:00Z`).getTime() : Date.now() - 90 * 864e5;
  let t = base + (6 + (h % 90)) * 3600_000; // +6h to ~4 days
  const latest = Date.now() - (1 + (h % 16)) * 3600_000;
  if (t > latest) t = Math.max(base + 2 * 3600_000, latest);
  return new Date(Math.min(t, Date.now() - 30 * 60_000)).toISOString();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function ensureProfiles(): Promise<Map<string, string>> {
  const clerkIds = PERSONAS.map((p) => `${BOT_PREFIX}${p.slug}`);
  const { data: existing, error } = await supabase
    .from("profiles").select("id, clerk_user_id").in("clerk_user_id", clerkIds);
  if (error) throw new Error(error.message);

  const byClerk = new Map((existing ?? []).map((r) => [r.clerk_user_id as string, r.id as string]));
  const ids = new Map<string, string>(); // slug → profile id

  for (const p of PERSONAS) {
    const clerkId = `${BOT_PREFIX}${p.slug}`;
    const have = byClerk.get(clerkId);
    if (have) {
      ids.set(p.slug, have);
      continue;
    }
    if (DRY_RUN) { console.log(`[dry-run] would create profile @${p.username}`); continue; }
    const { data, error: insErr } = await supabase
      .from("profiles")
      .insert({
        clerk_user_id: clerkId,
        username: p.username,
        display_name: p.displayName,
        bio: p.bio,
        avatar_config: p.avatar,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`profile ${p.username}: ${insErr.message}`);
    ids.set(p.slug, data.id);
    console.log(`created profile @${p.username}`);
  }
  return ids;
}

async function chunkedUpsert(table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 200), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function main() {
  console.log(`Press Box seeder ${DRY_RUN ? "(dry run)" : ""}\n`);

  const profileIds = await ensureProfiles();
  const pool = await fetchPool();
  console.log(`match pool: ${pool.length} completed matches`);

  const poolByKey = new Map(pool.map((m) => [matchKey(m), m]));
  const textsByPersona = new Map<string, Map<string, string>>();
  let unresolvedTexts = 0;
  for (const t of REVIEW_TEXTS) {
    if (!poolByKey.has(t.matchKey)) {
      unresolvedTexts++;
      console.warn(`  ! no pool match for text: ${t.matchKey}`);
      continue;
    }
    if (!textsByPersona.has(t.persona)) textsByPersona.set(t.persona, new Map());
    textsByPersona.get(t.persona)!.set(t.matchKey, t.comment);
  }
  console.log(`review texts: ${REVIEW_TEXTS.length - unresolvedTexts}/${REVIEW_TEXTS.length} resolved\n`);

  // Player ids for the scouting book
  const archNames = Object.keys(SKILL_ARCHETYPES);
  const { data: archPlayers, error: archErr } = await supabase
    .from("players").select("id, name").in("name", archNames);
  if (archErr) throw new Error(archErr.message);
  const playerIdByName = new Map((archPlayers ?? []).map((r) => [r.name as string, r.id as string]));
  for (const n of archNames) if (!playerIdByName.has(n)) console.warn(`  ! scouting book player not in DB: ${n}`);

  let totalReviews = 0, totalTexts = 0, totalSkills = 0;

  for (const p of PERSONAS) {
    const profileId = profileIds.get(p.slug);
    if (!profileId && !DRY_RUN) throw new Error(`missing profile for ${p.slug}`);

    // ── Select matches ───────────────────────────────────────────────────
    const scored = pool
      .map((m) => ({ m, f: parseScore(m.score) }))
      .filter((x): x is { m: PoolMatch; f: ScoreFeatures } => x.f !== null)
      .map((x) => ({ ...x, s: selectionScore(p, x.m, x.f) }))
      .sort((a, b) => b.s - a.s);

    const myTexts = textsByPersona.get(p.slug) ?? new Map<string, string>();
    const picked = new Map<string, { m: PoolMatch; f: ScoreFeatures }>();
    // texted matches are mandatory viewing
    for (const key of myTexts.keys()) {
      const m = poolByKey.get(key)!;
      const f = parseScore(m.score);
      if (f) picked.set(m.id, { m, f });
    }
    for (const x of scored) {
      if (picked.size >= p.reviewTarget) break;
      picked.set(x.m.id, { m: x.m, f: x.f });
    }

    // ── Build review rows ────────────────────────────────────────────────
    const reviewRows: Record<string, unknown>[] = [];
    const watchedRows: Record<string, unknown>[] = [];
    for (const { m, f } of picked.values()) {
      const rating = matchRating(p, m, f);
      const { p1, p2 } = playerRatings(p, m, f);
      const comment = myTexts.get(matchKey(m)) ?? null;
      const ts = reviewTimestamp(p, m);
      if (comment) totalTexts++;
      reviewRows.push({
        user_id: profileId, match_id: m.id,
        match_rating: rating, player1_rating: p1, player2_rating: p2,
        comment,
        is_favorited: rating >= 9.2 && hash32(`fav|${p.slug}|${m.id}`) % 3 !== 0,
        created_at: ts, updated_at: ts,
      });
      watchedRows.push({ user_id: profileId, match_id: m.id, watched_at: ts });
    }

    // ── Build skill-rating rows ──────────────────────────────────────────
    const skillRows: Record<string, unknown>[] = [];
    for (const name of p.skillPlayers) {
      const playerId = playerIdByName.get(name);
      const archetype = SKILL_ARCHETYPES[name];
      if (!playerId || !archetype) continue;
      const r = rng(`skill|${p.slug}|${name}`);
      const row: Record<string, unknown> = { user_id: profileId, player_id: playerId };
      let bestAxis = AXES[0]; let bestVal = -1; let bestEmph = AXES[0]; let bestEmphVal = -1;
      for (const axis of AXES) {
        let v = archetype[axis] + (r() - 0.5) * 1.2;
        if (p.skillEmphasis.includes(axis)) v += 0.3;
        v = clamp(snapHalf(v), 1, 5);
        row[axis] = v;
        if (v > bestVal) { bestVal = v; bestAxis = axis; }
        if (p.skillEmphasis.includes(axis) && v > bestEmphVal) { bestEmphVal = v; bestEmph = axis; }
      }
      row.highlighted_skill = bestEmphVal >= bestVal - 0.5 ? bestEmph : bestAxis;
      const h = hash32(`skillts|${p.slug}|${name}`);
      const ts = new Date(Date.now() - (2 + (h % (45 * 24))) * 3600_000).toISOString();
      row.created_at = ts; row.updated_at = ts;
      skillRows.push(row);
    }

    console.log(
      `@${p.username.padEnd(18)} reviews: ${String(reviewRows.length).padStart(3)}` +
      ` (texts ${[...myTexts.keys()].length}) | skill ratings: ${skillRows.length}`
    );
    totalReviews += reviewRows.length;
    totalSkills += skillRows.length;

    if (DRY_RUN) continue;
    await chunkedUpsert("reviews", reviewRows, "user_id,match_id");
    await chunkedUpsert("watched_matches", watchedRows, "user_id,match_id");
    await chunkedUpsert("skill_ratings", skillRows, "user_id,player_id");
    const earned = await checkAndAwardAchievements(profileId!).catch(() => [] as string[]);
    if (earned.length) console.log(`   ↳ achievements: ${earned.join(", ")}`);
  }

  console.log(`\ndone${DRY_RUN ? " (dry run — nothing written)" : ""}:`);
  console.log(`  reviews:       ${totalReviews} (${totalTexts} with written comments)`);
  console.log(`  skill ratings: ${totalSkills}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
