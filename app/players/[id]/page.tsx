import React from "react";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Player, MatchWithPlayers } from "@/types";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import RadarChart from "@/components/radar/RadarChart";
import MatchFilterBar, { type MatchFilters } from "@/components/MatchFilterBar";
import CountryFlag from "@/components/CountryFlag";
import MatchHistoryList from "@/components/MatchHistoryList";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ round?: string; surface?: string; year?: string }>;
};

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

function rankFrameStyle(rank: number | null | undefined): React.CSSProperties {
  if (!rank) return { border: "2px solid rgba(34,214,138,0.2)" };
  if (rank <= 10) return {
    background: "linear-gradient(135deg, #f5c518, #e0a800, #f5c518)",
    boxShadow: "0 0 14px rgba(245,197,24,0.5), 0 0 28px rgba(245,197,24,0.2)",
    padding: "2px",
  };
  if (rank <= 50) return {
    background: "linear-gradient(135deg, #c0c0c0, #e8e8e8, #a8a8a8)",
    boxShadow: "0 0 10px rgba(192,192,192,0.4)",
    padding: "2px",
  };
  if (rank <= 100) return {
    background: "linear-gradient(135deg, #4a9eff, #6ab4ff, #3a8ef0)",
    boxShadow: "0 0 8px rgba(74,158,255,0.35)",
    padding: "2px",
  };
  return { border: "2px solid rgba(34,214,138,0.2)" };
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { userId } = await auth();
  const { id } = await params;
  const { round, surface, year } = await searchParams;
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

  // Fetch filter options for this player's matches
  const { data: playerMatchOptions } = await supabase
    .from("matches")
    .select("surface, match_date")
    .or(`player1_id.eq.${id},player2_id.eq.${id}`)
    .not("match_date", "is", null)
    .limit(500);

  const playerSurfaces = [...new Set((playerMatchOptions ?? []).map((r) => r.surface).filter(Boolean))].sort() as string[];
  const playerYears = [
    ...new Set((playerMatchOptions ?? []).map((r) => r.match_date?.slice(0, 4)).filter(Boolean)),
  ].sort((a, b) => Number(b) - Number(a)) as string[];

  // Fetch their matches with filters applied
  let matchQuery = supabase
    .from("matches")
    .select(`
      *,
      player1:player1_id ( id, name, country, current_rank ),
      player2:player2_id ( id, name, country, current_rank )
    `)
    .or(`player1_id.eq.${id},player2_id.eq.${id}`)
    .order("match_date", { ascending: false, nullsFirst: false })
    .limit(200);

  if (round)   matchQuery = matchQuery.eq("round", round);
  if (surface) matchQuery = matchQuery.eq("surface", surface);
  if (year)    matchQuery = matchQuery.gte("match_date", `${year}-01-01`).lte("match_date", `${year}-12-31`);

  const { data: matches } = await matchQuery;

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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-5">
            {/* Player photo or initials avatar with ranking frame */}
            {(p.photo_url || p.image_url) ? (
              <div
                className="w-20 h-20 rounded-full shrink-0 p-0.5"
                style={rankFrameStyle(p.current_rank)}
              >
                <Image
                  src={p.photo_url ?? p.image_url ?? ""}
                  alt={p.name}
                  width={80}
                  height={80}
                  className="w-full h-full rounded-full object-cover object-top"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center font-mono text-2xl font-bold shrink-0"
                style={{ background: "rgba(34,214,138,0.1)", color: "#22d68a", border: "2px solid rgba(34,214,138,0.2)" }}
              >
                {p.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
            )}
          <div>
            <h1 className="font-mono text-4xl font-bold text-text-primary">
              {p.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              {p.country && (
                <span className="flex items-center gap-1.5">
                  <CountryFlag code={p.country} size={20} />
                  <span className="font-mono text-sm text-text-mid">{p.country}</span>
                </span>
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
          </div>

          {/* Rank + Rate button */}
          <div className="flex flex-col items-start sm:items-end gap-3">
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
      {reviewCount === 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 mb-10 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">Community Rating</p>
          <p className="font-sans text-sm text-text-dim mb-4">No one has reviewed a match featuring {p.name} yet.</p>
          <Link
            href="/matches"
            className="font-mono text-xs text-primary hover:text-primary/80 transition-colors duration-150"
          >
            Browse matches →
          </Link>
        </div>
      )}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

        <div className="mb-4">
          <MatchFilterBar
            filters={{ round, surface, year }}
            options={{ tournaments: [], surfaces: playerSurfaces, years: playerYears }}
            basePath={`/players/${id}`}
            hidePlayer
          />
        </div>

        {!matches || matches.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 text-center">
            <p className="font-mono text-text-dim text-sm mb-1">No matches found</p>
            {(round || surface || year) && (
              <p className="font-sans text-text-dim text-xs">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <MatchHistoryList matches={matches as MatchWithPlayers[]} playerId={id} />
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

