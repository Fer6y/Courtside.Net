/**
 * sync-live-rankings.ts
 *
 * Refreshes players.current_rank from the LIVE tour rankings (MatchStat API),
 * not from our match catalogue.
 *
 * Why this exists
 * ---------------
 * current_rank used to be set by import-players.ts to a player's rank *as
 * recorded at their most recent Slam/Masters match*. That is not a live rank:
 * it freezes the moment a player stops appearing in our (Slam + Masters only)
 * data. Roger Federer was stuck at No. 8 — his rank at Wimbledon 2021, his last
 * match — long after he retired, so he showed up in the active "Field". Two
 * players could also share a rank because the snapshots came from different
 * tournaments.
 *
 * What this does
 * --------------
 * The live endpoint (getRankings) returns the current top ~101 per tour, keyed
 * by the same id we store in api_player_key. For every player we:
 *   - SET current_rank to the live position if they are in the live list, else
 *   - NULL current_rank if they currently claim a top-of-the-list rank but are
 *     NOT in the live list (a stale occupier — retired, or fallen out of the
 *     top 101). We can only null these, not correct them, because the live feed
 *     doesn't cover ranks beyond the list.
 *   - LEAVE everyone else untouched (rank already beyond the live list, or no
 *     live data) — we have nothing more trustworthy to say about them.
 *
 * Usage
 * -----
 *   npx tsx scripts/sync-live-rankings.ts          # dry run (no writes)
 *   npx tsx scripts/sync-live-rankings.ts --apply   # write changes to the DB
 */

import { getRankings } from "../lib/matchstat";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Tour = "ATP" | "WTA";

interface PlayerRow {
  id: string;
  name: string;
  current_rank: number | null;
  api_player_key: string | null;
  career_stats: { tour?: string } | null;
}

// Supabase caps an unbounded select at 1000 rows — paginate so we see everyone.
async function fetchAllPlayers(): Promise<PlayerRow[]> {
  const rows: PlayerRow[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await db
      .from("players")
      .select("id, name, current_rank, api_player_key, career_stats")
      .not("api_player_key", "is", null)
      .range(from, from + size - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as PlayerRow[]));
    if (data.length < size) break;
  }
  return rows;
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (writing to DB)\n" : "MODE: DRY RUN (no writes)\n");

  // ── Live rankings: api_player_key -> position, per tour ──────────────────
  const live: Record<Tour, Map<string, number>> = { ATP: new Map(), WTA: new Map() };
  let liveMax = 0;
  for (const tour of ["ATP", "WTA"] as Tour[]) {
    const arr = (await getRankings(tour)) as Array<{ position: number; player?: { id: number } }>;
    for (const e of arr) {
      if (e.player?.id == null) continue;
      live[tour].set(String(e.player.id), e.position);
      if (e.position > liveMax) liveMax = e.position;
    }
    console.log(`Live ${tour}: ${live[tour].size} ranked players`);
  }
  console.log(`Live list covers ranks 1–${liveMax}\n`);

  // ── Decide each player's new rank ────────────────────────────────────────
  const players = await fetchAllPlayers();
  console.log(`Players with api_player_key: ${players.length}\n`);

  const updates: { id: string; name: string; from: number | null; to: number | null }[] = [];

  for (const p of players) {
    const tour = p.career_stats?.tour as Tour | undefined;
    if (tour !== "ATP" && tour !== "WTA") continue;

    const livePos = live[tour].get(String(p.api_player_key));
    const cur = p.current_rank;

    let next: number | null | undefined;
    if (livePos != null) {
      next = livePos;                                  // in the live list → true rank
    } else if (cur != null && cur <= liveMax) {
      next = null;                                     // stale occupier of a top rank → clear it
    } else {
      next = undefined;                                // nothing trustworthy to change
    }

    if (next !== undefined && next !== cur) {
      updates.push({ id: p.id, name: p.name, from: cur, to: next });
    }
  }

  const corrected = updates.filter((u) => u.to !== null);
  const nulled = updates.filter((u) => u.to === null);

  console.log(`Rank corrections: ${corrected.length}`);
  console.log(`Stale ranks to clear (null): ${nulled.length}\n`);

  console.log("--- Cleared (stale top-rank occupiers) ---");
  nulled.sort((a, b) => a.name.localeCompare(b.name))
    .forEach((u) => console.log(`  ${u.name}: ${u.from} -> null`));

  console.log("\n--- Corrected ranks ---");
  corrected.sort((a, b) => (a.to ?? 0) - (b.to ?? 0))
    .forEach((u) => console.log(`  ${u.name}: ${u.from ?? "—"} -> ${u.to}`));

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to write these changes.");
    return;
  }

  // ── Apply ────────────────────────────────────────────────────────────────
  console.log(`\nApplying ${updates.length} updates...`);
  let ok = 0, fail = 0;
  for (const u of updates) {
    const { error } = await db
      .from("players")
      .update({ current_rank: u.to })
      .eq("id", u.id);
    if (error) { fail++; console.error(`  FAILED ${u.name}: ${error.message}`); }
    else ok++;
  }
  console.log(`Done. ${ok} updated, ${fail} failed.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
