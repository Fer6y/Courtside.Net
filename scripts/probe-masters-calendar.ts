/**
 * scripts/probe-masters-calendar.ts
 *
 * Probes the TourRank:2 filter on player past-matches to find Masters 1000
 * tournament IDs. Uses the top 3 ATP + WTA ranked players for 2024.
 *
 * Run: npm run probe:masters-calendar
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { matchstat } from "../lib/matchstat";

async function probe(tour: "ATP" | "WTA") {
  console.log(`\n── ${tour} 2024 — TourRank:2 (Masters/Premier) probe ──────────────\n`);

  // Get top ranked players
  const rankings = await matchstat<Record<string, unknown>[]>(`${tour.toLowerCase()}/ranking/singles`);
  if (!Array.isArray(rankings) || rankings.length === 0) {
    console.log("  No rankings returned.");
    return;
  }

  const topPlayers = rankings.slice(0, 3).map((row) => {
    const p = (row.player ?? row) as Record<string, unknown>;
    return { id: String(p.id ?? ""), name: String(p.name ?? p.fullName ?? "?") };
  });

  console.log(`  Probing top 3 players: ${topPlayers.map((p) => p.name).join(", ")}\n`);

  const seen = new Map<string, { date: string; name?: string }>();

  for (const player of topPlayers) {
    if (!player.id) continue;
    try {
      const matches = await matchstat<Record<string, unknown>[]>(
        `${tour.toLowerCase()}/player/past-matches/${player.id}`,
        { filter: "GameYear:2024;TourRank:2" }
      );

      if (!Array.isArray(matches) || matches.length === 0) {
        console.log(`  ${player.name}: 0 matches returned`);
        continue;
      }

      console.log(`  ${player.name}: ${matches.length} matches`);

      // Show first match in full so we can see all field names
      if (seen.size === 0) {
        console.log(`\n  First match row (full):\n  ${JSON.stringify(matches[0], null, 2).split("\n").join("\n  ")}\n`);
      }

      for (const m of matches) {
        const tid  = String(m.tournamentId ?? m.tournament_id ?? m.seasonId ?? "");
        const date = String(m.date ?? m.match_date ?? "").slice(0, 10);
        const tname = String(m.tournamentName ?? m.tournament ?? m.name ?? "");
        if (tid && !seen.has(tid)) seen.set(tid, { date, name: tname });
      }
    } catch (err) {
      console.log(`  ${player.name}: ERROR — ${(err as Error).message}`);
    }
  }

  console.log(`\n  Unique tournament IDs found (${seen.size}):`);
  for (const [tid, { date, name }] of [...seen.entries()].sort((a, b) => a[1].date.localeCompare(b[1].date))) {
    console.log(`    tournamentId=${tid}  date=${date}  name=${name || "—"}`);
  }
}

async function main() {
  await probe("ATP");
  await probe("WTA");
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
