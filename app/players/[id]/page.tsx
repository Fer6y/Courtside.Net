import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Player, MatchWithPlayers } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import RadarChart from "@/components/radar/RadarChart";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("players")
    .select("name")
    .eq("id", id)
    .single();
  return { title: data ? `${data.name} — Courtside` : "Player — Courtside" };
}

function avg(vals: number[]): number {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export default async function PlayerPage({ params }: Props) {
  const { userId } = await auth();
  const { id } = await params;
  const supabase = getSupabase();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch player
  const { data: player, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !player) notFound();

  // Fetch all community skill ratings and average them in JS
  const SKILL_KEYS = [
    "focus","clutch","resilience","serve","forehand","backhand",
    "net_play","touch","return_play","reaction_time",
    "speed","court_coverage","positioning",
  ] as const;

  const { data: skillRows } = await supabase
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
        ratings[key] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
      }
    }
  }

  // Fetch their matches with both player names joined
  const { data: matches } = await supabase
    .from("matches")
    .select(`
      *,
      player1:player1_id ( id, name, country, current_rank ),
      player2:player2_id ( id, name, country, current_rank )
    `)
    .or(`player1_id.eq.${id},player2_id.eq.${id}`)
    .order("match_date", { ascending: false })
    .limit(50);

  // Fetch community reviews for this player's matches
  const matchIds = (matches ?? []).map((m) => m.id);
  let avgPerformance = 0;
  let avgMatchQuality = 0;
  let reviewCount = 0;
  let reviewedMatchCount = 0;

  if (matchIds.length > 0) {
    const { data: reviewRows } = await admin
      .from("reviews")
      .select("match_id, player1_rating, player2_rating, match_rating")
      .in("match_id", matchIds);

    if (reviewRows && reviewRows.length > 0) {
      // Map match_id → which position this player occupies
      const roleMap = new Map<string, "player1" | "player2">();
      for (const m of matches as MatchWithPlayers[]) {
        roleMap.set(m.id, m.player1_id === id ? "player1" : "player2");
      }

      const perfRatings: number[] = [];
      const matchQualityRatings: number[] = [];
      const reviewedMatchIds = new Set<string>();

      for (const r of reviewRows) {
        const role = roleMap.get(r.match_id);
        const perf = role === "player1" ? r.player1_rating : r.player2_rating;
        if (perf != null) perfRatings.push(perf);
        if (r.match_rating != null) matchQualityRatings.push(r.match_rating);
        reviewedMatchIds.add(r.match_id);
      }

      avgPerformance  = avg(perfRatings);
      avgMatchQuality = avg(matchQualityRatings);
      reviewCount     = reviewRows.length;
      reviewedMatchCount = reviewedMatchIds.size;
    }
  }

  const p = player as Player;
  const tour = p.career_stats?.tour as string | undefined;

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      {/* Back */}
      <Link
        href="/players"
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
      >
        ← All Players
      </Link>

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-mono text-4xl font-bold text-text-primary">
              {p.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              {p.country && (
                <span className="font-mono text-sm text-text-mid">{p.country}</span>
              )}
              {tour && (
                <span className="font-mono text-xs text-text-dim uppercase tracking-widest">
                  {tour}
                </span>
              )}
              {p.age && (
                <span className="font-sans text-sm text-text-dim">
                  Age {p.age}
                </span>
              )}
            </div>
          </div>

          {/* Rank + Rate button */}
          <div className="flex flex-col items-end gap-3">
            {p.current_rank && (
              <div className="text-right">
                <div className="font-mono text-4xl font-bold text-primary">
                  #{p.current_rank}
                </div>
                <div className="font-sans text-xs text-text-dim mt-1">
                  World Ranking
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Link
                href={`/compare?p1=${id}`}
                className="font-mono text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-150 border border-white/10 text-text-dim hover:text-text-primary hover:border-white/20"
              >
                Compare
              </Link>
              <Link
                href={userId ? `/players/${id}/rate` : "/sign-in"}
                className="font-mono text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-150"
                style={{ background: "#22d68a", color: "#0e1116" }}
              >
                Rate Player
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Radar chart */}
      <div className="mb-10 flex justify-center">
        <RadarChart
          ratings={ratings}
          playerColor="#22d68a"
          playerName={p.name}
          ratingCount={ratingCount > 0 ? ratingCount : undefined}
        />
      </div>

      {/* Community Rating */}
      {reviewCount > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-text-dim">
              Community Rating
            </h2>
            <span className="font-mono text-xs text-text-dim">
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"} · {reviewedMatchCount} {reviewedMatchCount === 1 ? "match" : "matches"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Performance */}
            <div className="text-center">
              <div
                className="font-mono text-4xl font-bold mb-1"
                style={{ color: "#22d68a" }}
              >
                {avgPerformance.toFixed(1)}
              </div>
              <div className="font-mono text-xs text-text-dim mb-3">Performance</div>
              <RatingBar value={avgPerformance} color="#22d68a" />
            </div>

            {/* Match Quality */}
            <div className="text-center">
              <div
                className="font-mono text-4xl font-bold mb-1"
                style={{ color: "#f5c518" }}
              >
                {avgMatchQuality.toFixed(1)}
              </div>
              <div className="font-mono text-xs text-text-dim mb-3">Match Quality</div>
              <RatingBar value={avgMatchQuality} color="#f5c518" />
            </div>
          </div>
        </div>
      )}

      {/* Match history */}
      <section>
        <h2 className="font-mono text-lg font-semibold text-text-mid uppercase tracking-widest mb-4">
          Match History
        </h2>

        {!matches || matches.length === 0 ? (
          <p className="font-sans text-text-dim">No matches found.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {(matches as MatchWithPlayers[]).map((match) => (
              <MatchRow key={match.id} match={match} playerId={id} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function RatingBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="w-full h-1 rounded-full overflow-hidden mx-auto"
      style={{ background: "rgba(255,255,255,0.06)", maxWidth: 80 }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${(value / 10) * 100}%`, background: color, opacity: 0.7 }}
      />
    </div>
  );
}

function MatchRow({
  match,
  playerId,
}: {
  match: MatchWithPlayers;
  playerId: string;
}) {
  const won = match.winner_id === playerId;
  const opponent =
    match.player1_id === playerId ? match.player2 : match.player1;

  const surfaceColor: Record<string, string> = {
    Hard:  "text-court-hard",
    Clay:  "text-court-clay",
    Grass: "text-court-grass",
  };

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
    >
      <div className="flex items-center gap-4">
        {/* W/L */}
        <span
          className={`font-mono text-xs font-bold w-5 ${won ? "text-primary" : "text-loss"}`}
        >
          {won ? "W" : "L"}
        </span>

        {/* Opponent */}
        <span className="font-sans text-text-primary group-hover:text-primary transition-colors duration-150">
          {opponent?.name ?? "Unknown"}
        </span>
      </div>

      <div className="flex items-center gap-4 text-right">
        {/* Score */}
        {match.score && (
          <span className="font-mono text-sm text-text-dim hidden sm:block">
            {match.score}
          </span>
        )}

        {/* Surface */}
        {match.surface && (
          <span
            className={`font-mono text-xs ${surfaceColor[match.surface] ?? "text-text-dim"}`}
          >
            {match.surface}
          </span>
        )}

        {/* Tournament + round */}
        <span className="font-sans text-xs text-text-dim hidden md:block">
          {match.tournament} · {match.round}
        </span>

        {/* Date */}
        {match.match_date && (
          <span className="font-mono text-xs text-text-dim">
            {match.match_date.slice(0, 4)}
          </span>
        )}
      </div>
    </Link>
  );
}
