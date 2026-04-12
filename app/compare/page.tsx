import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Player } from "@/types";
import Link from "next/link";
import ComparePlayerPicker from "@/components/ComparePlayerPicker";
import CompareView from "@/components/CompareView";

export const metadata = { title: "Compare Players — Courtside" };

type SearchParams = Promise<{ p1?: string; p2?: string }>;

const SKILL_KEYS = [
  "focus", "clutch", "resilience",
  "serve", "forehand", "backhand",
  "net_play", "touch", "return_play", "reaction_time",
  "speed", "court_coverage", "positioning",
] as const;

async function fetchPlayerWithRatings(id: string) {
  const supabase = getSupabase();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: player } = await supabase
    .from("players")
    .select("id, name, country, current_rank, career_stats")
    .eq("id", id)
    .single();

  if (!player) return null;

  const { data: skillRows } = await admin
    .from("skill_ratings")
    .select(SKILL_KEYS.join(","))
    .eq("player_id", id);

  const ratings: Record<string, number> = {};
  const ratingCount = skillRows?.length ?? 0;

  if (ratingCount > 0) {
    for (const key of SKILL_KEYS) {
      const vals = (skillRows ?? [])
        .map((r) => Number((r as unknown as Record<string, unknown>)[key]))
        .filter((v) => !isNaN(v) && v > 0);
      if (vals.length > 0) {
        ratings[key] =
          Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
      }
    }
  }

  return { ...(player as Player), ratings, ratingCount };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { p1: p1Id, p2: p2Id } = await searchParams;

  // No player selected — entry point
  if (!p1Id) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="font-mono text-3xl font-bold text-text-primary mb-4">
          Compare Players
        </h1>
        <p className="font-sans text-text-dim mb-6">
          Visit a player profile and click{" "}
          <span className="text-primary">Compare Player</span> to start.
        </p>
        <Link
          href="/players"
          className="font-mono text-sm text-primary hover:opacity-80 transition-opacity"
        >
          → Browse Players
        </Link>
      </main>
    );
  }

  const p1 = await fetchPlayerWithRatings(p1Id);
  if (!p1) notFound();

  const tour = (p1.career_stats?.tour as string | undefined) ?? "ATP";
  const supabase = getSupabase();

  // Fetch similar players for the picker (same tour, ±25 rank)
  const rank = p1.current_rank;
  let simQuery = supabase
    .from("players")
    .select("id, name, country, current_rank")
    .filter("career_stats->>tour", "eq", tour)
    .neq("id", p1Id);

  if (rank) {
    simQuery = simQuery
      .gte("current_rank", Math.max(1, rank - 25))
      .lte("current_rank", rank + 25);
  }

  const { data: similar } = await simQuery
    .order("current_rank", { ascending: true, nullsFirst: false })
    .limit(9);

  // P1 selected, P2 not yet — show picker
  if (!p2Id) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <Link
          href={`/players/${p1Id}`}
          className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
        >
          ← {p1.name}
        </Link>

        <div className="mb-8">
          <h1 className="font-mono text-3xl font-bold text-text-primary mb-1">
            Compare
          </h1>
          <p className="font-sans text-text-mid">
            <span className="text-primary">{p1.name}</span> vs ...
          </p>
        </div>

        <ComparePlayerPicker
          p1Id={p1Id}
          p1Tour={tour}
          similarPlayers={
            (similar ?? []) as Array<{
              id: string;
              name: string;
              country: string | null;
              current_rank: number | null;
            }>
          }
        />
      </main>
    );
  }

  // Both players — fetch p2 + H2H
  const [p2, { data: h2hMatches }] = await Promise.all([
    fetchPlayerWithRatings(p2Id),
    supabase
      .from("matches")
      .select(
        "id, winner_id, player1_id, player2_id, match_date, tournament, surface, score"
      )
      .or(
        `and(player1_id.eq.${p1Id},player2_id.eq.${p2Id}),and(player1_id.eq.${p2Id},player2_id.eq.${p1Id})`
      )
      .order("match_date", { ascending: false })
      .limit(20),
  ]);

  if (!p2) notFound();

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href={`/compare?p1=${p1Id}`}
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
      >
        ← Change comparison
      </Link>

      <CompareView
        p1={{
          id: p1.id,
          name: p1.name,
          country: p1.country,
          current_rank: p1.current_rank,
          ratings: p1.ratings,
          ratingCount: p1.ratingCount,
        }}
        p2={{
          id: p2.id,
          name: p2.name,
          country: p2.country,
          current_rank: p2.current_rank,
          ratings: p2.ratings,
          ratingCount: p2.ratingCount,
        }}
        h2hMatches={h2hMatches ?? []}
      />
    </main>
  );
}
