import React from "react";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Player, MatchWithPlayers } from "@/types";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import RadarChart from "@/components/radar/RadarChart";
import MatchFilterBar from "@/components/MatchFilterBar";
import CountryFlag from "@/components/CountryFlag";
import MatchHistoryList from "@/components/MatchHistoryList";
import { SLAM_TROPHIES, MastersTrophy } from "@/components/trophies/TrophyDecals";

const SKILL_LABELS: Record<string, string> = {
  focus: "Focus", clutch: "Clutch", resilience: "Resilience", processing_time: "Processing time",
  serve: "Serve", forehand: "Forehand", backhand: "Backhand", shot_variety: "Shot variety",
  net_play: "Net play", touch: "Touch", return_play: "Return", reaction_time: "Reaction time",
  deception: "Deception", speed: "Speed", court_coverage: "Court coverage",
  positioning: "Positioning", anticipation: "Anticipation",
};

// Calendar order for the honours row
const SLAM_DISPLAY_ORDER = ["Australian Open", "French Open", "Roland Garros", "Wimbledon", "US Open"];

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

// Portrait ring carries rank tier in programme materials:
// top 10 gold, top 50 silver, everyone else a cream hairline
function portraitRing(rank: number | null | undefined): string {
  if (rank && rank <= 10) return "2px solid rgba(201,169,106,0.85)";
  if (rank && rank <= 50) return "2px solid rgba(192,192,192,0.55)";
  return "2px solid rgba(236,229,216,0.2)";
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
    "focus","clutch","resilience","processing_time",
    "serve","forehand","backhand","shot_variety",
    "net_play","touch","return_play","reaction_time","deception",
    "speed","court_coverage","positioning","anticipation",
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

  const { data: rawMatches } = await matchQuery;

  // Secondary sort: within the same match_date, show Finals/Semis before early rounds
  const ROUND_PRIORITY: Record<string, number> = {
    "Final": 10, "Semifinal": 9, "Quarterfinal": 8,
    "Round of 16": 7, "Round of 32": 6, "Round of 64": 5, "Round of 128": 4,
  };
  const matches = (rawMatches ?? []).sort((a, b) => {
    const dateDiff = (b.match_date ?? "").localeCompare(a.match_date ?? "");
    if (dateDiff !== 0) return dateDiff;
    return (ROUND_PRIORITY[b.round ?? ""] ?? 0) - (ROUND_PRIORITY[a.round ?? ""] ?? 0);
  });

  // Fetch community reviews for this player's matches
  const matchIds = matches.map((m) => m.id);
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
      for (const m of matches as unknown as MatchWithPlayers[]) {
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

  // Honours — slam titles from the API's verified slam_wins; Masters
  // titles counted from finals won in our catalogue (scoped label)
  const { data: finalsWon } = await supabase
    .from("matches")
    .select("tournament_tier")
    .eq("winner_id", id)
    .eq("round", "Final");
  const mastersTitles = (finalsWon ?? []).filter((f) => f.tournament_tier === "masters_1000").length;

  const p = player as Player;
  const tour = p.career_stats?.tour as string | undefined;
  const slamWins = (p.career_stats?.slam_wins ?? null) as Record<string, number> | null;
  const slamEntries = slamWins
    ? SLAM_DISPLAY_ORDER.filter((s) => (slamWins[s] ?? 0) > 0).map((s) => [s, slamWins[s]!] as const)
    : [];
  const countryFull = (p.career_stats?.country_full as { name?: string } | undefined)?.name ?? p.country;

  // The community's verdict
  const axisEntries = Object.entries(ratings);
  const overallSkill = axisEntries.length ? avg(axisEntries.map(([, v]) => v)) : 0;
  const strongest = [...axisEntries].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const hasVerdict = ratingCount > 0 || reviewCount > 0;
  const lastName = p.name.split(" ").pop();

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      {/* Back */}
      <Link
        href="/players"
        className="eyebrow mb-8 inline-block transition-colors duration-150"
        style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}
      >
        ← All Players
      </Link>

      {/* ── The bill — portrait, name, honours ───────────────────── */}
      <div className="mb-12 flex items-center gap-6 flex-wrap">
        {/* Portrait with flag mounted on the frame */}
        <div className="relative shrink-0">
          <div
            className="w-[104px] h-[104px] rounded-full overflow-hidden flex items-center justify-center"
            style={{ border: portraitRing(p.current_rank), background: "rgba(236,229,216,0.05)" }}
          >
            {(p.photo_url || p.image_url) ? (
              <Image
                src={p.photo_url ?? p.image_url ?? ""}
                alt={p.name}
                width={104}
                height={104}
                className="w-full h-full object-cover object-top"
                unoptimized
              />
            ) : (
              <span className="bill-name" style={{ fontSize: 32, color: "rgba(236,229,216,0.45)" }}>
                {p.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            )}
          </div>
          {p.country && (
            <div
              className="absolute flex items-center gap-1 rounded px-1.5 py-0.5"
              style={{
                bottom: -2,
                right: -8,
                background: "var(--court-bg, #0d1a11)",
                border: "1px solid rgba(236,229,216,0.25)",
              }}
            >
              <CountryFlag code={p.country} size={20} />
              <span className="font-mono" style={{ fontSize: 11, color: "#ece5d8", letterSpacing: "0.05em" }}>
                {p.country}
              </span>
            </div>
          )}
        </div>

        {/* Name + honours */}
        <div className="flex-1 min-w-[230px]">
          <div className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.5)" }}>
            {p.current_rank && <>World No. {p.current_rank} · </>}
            {countryFull}
            {p.age && <> · Age {p.age}</>}
            {tour && <> · {tour}</>}
          </div>
          <h1 className="bill-name mt-1" style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.15 }}>
            {p.name}
          </h1>

          {/* Honours row — verified slam decals + scoped Masters count */}
          {(slamEntries.length > 0 || mastersTitles > 0) && (
            <div className="flex items-end gap-4 flex-wrap mt-3">
              {slamEntries.map(([slam, count]) => {
                const Trophy = SLAM_TROPHIES[slam];
                if (!Trophy) return null;
                return (
                  <span key={slam} className="inline-flex items-end gap-1" style={{ color: "#c9a96a" }} title={`${slam} ×${count}`}>
                    <Trophy size={22} title={`${slam} ×${count}`} />
                    <span className="font-mono font-semibold" style={{ fontSize: 13 }}>×{count}</span>
                  </span>
                );
              })}
              {mastersTitles > 0 && (
                <span
                  className="inline-flex items-center gap-2"
                  style={
                    slamEntries.length > 0
                      ? { borderLeft: "1px solid rgba(236,229,216,0.15)", paddingLeft: 16 }
                      : undefined
                  }
                >
                  <span className="inline-flex items-end gap-1" style={{ color: "rgba(201,169,106,0.8)" }}>
                    <MastersTrophy size={17} title={`Masters 1000 titles ×${mastersTitles}`} />
                    <span className="font-mono font-semibold" style={{ fontSize: 12 }}>×{mastersTitles}</span>
                  </span>
                  <span className="eyebrow" style={{ fontSize: 8, color: "rgba(236,229,216,0.4)" }}>
                    Masters · since 2020
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/h2h/${id}`}
            className="eyebrow rounded-md px-4 py-2.5 transition-colors duration-150"
            style={{
              fontSize: 10,
              border: "1px solid var(--hairline)",
              color: "rgba(236,229,216,0.55)",
            }}
          >
            H2H
          </Link>
          <Link
            href={userId ? `/players/${id}/rate` : "/sign-in"}
            className="eyebrow rounded-md px-4 py-2.5 font-semibold transition-all duration-150"
            style={{ fontSize: 10, background: "#22d68a", color: "#0d1a11" }}
          >
            Rate Player
          </Link>
        </div>
      </div>

      {/* ── The community's verdict ──────────────────────────────── */}
      <div className="mb-12">
        <div className="rule-divider mb-5">
          <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>
            The community&apos;s verdict
            {hasVerdict && (
              <>
                {" — "}
                {ratingCount > 0 && <>{ratingCount} {ratingCount === 1 ? "rater" : "raters"}</>}
                {ratingCount > 0 && reviewCount > 0 && " · "}
                {reviewCount > 0 && <>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</>}
              </>
            )}
          </span>
        </div>

        {!hasVerdict ? (
          <div className="text-center py-4">
            <p className="bill-name italic text-sm mb-3" style={{ fontWeight: 300, color: "rgba(236,229,216,0.5)" }}>
              No verdicts yet — be the first to rate {lastName}.
            </p>
            <Link
              href={userId ? `/players/${id}/rate` : "/sign-in"}
              className="eyebrow transition-colors duration-150"
              style={{ fontSize: 10, color: "#c9a96a" }}
            >
              Rate {lastName} →
            </Link>
          </div>
        ) : (
          <div className="mx-auto" style={{ maxWidth: 420 }}>
            {ratingCount > 0 && (
              <VerdictRow label="Overall skill rating" value={`${overallSkill.toFixed(1)}`} suffix="/ 5" gold />
            )}
            {strongest[0] && (
              <VerdictRow label={`Strongest — ${SKILL_LABELS[strongest[0][0]] ?? strongest[0][0]}`} value={strongest[0][1].toFixed(1)} />
            )}
            {strongest[1] && (
              <VerdictRow label={`Then — ${SKILL_LABELS[strongest[1][0]] ?? strongest[1][0]}`} value={strongest[1][1].toFixed(1)} />
            )}
            {reviewCount > 0 && (
              <>
                <VerdictRow label="Avg. match performance" value={avgPerformance.toFixed(1)} suffix="/ 10" />
                <VerdictRow label="Match quality when featured" value={avgMatchQuality.toFixed(1)} suffix="/ 10" />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Radar chart ──────────────────────────────────────────── */}
      <div className="mb-12 flex justify-center">
        <RadarChart
          ratings={ratings}
          playerColor="#22d68a"
          playerName={p.name}
          ratingCount={ratingCount > 0 ? ratingCount : undefined}
        />
      </div>

      {/* ── Recent form ──────────────────────────────────────────── */}
      <section>
        <div className="rule-divider mb-5">
          <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>
            Recent form — Slams &amp; Masters since 2020
          </span>
        </div>

        <div className="mb-4">
          <MatchFilterBar
            filters={{ round, surface, year }}
            options={{ tournaments: [], surfaces: playerSurfaces, years: playerYears }}
            basePath={`/players/${id}`}
            hidePlayer
          />
        </div>

        {!matches || matches.length === 0 ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{ border: "1px solid var(--hairline-soft)", background: "rgba(236,229,216,0.02)" }}
          >
            <p className="bill-name italic text-sm" style={{ fontWeight: 300, color: "rgba(236,229,216,0.5)" }}>
              Nothing on record.
            </p>
            {(round || surface || year) && (
              <p className="font-sans text-xs mt-2" style={{ color: "rgba(236,229,216,0.35)" }}>
                Try adjusting your filters
              </p>
            )}
          </div>
        ) : (
          <MatchHistoryList matches={matches as unknown as MatchWithPlayers[]} playerId={id} />
        )}
      </section>

      {/* ── Colophon ─────────────────────────────────────────────── */}
      <div className="text-center mt-16">
        <span className="eyebrow" style={{ fontSize: 10, color: "rgba(201,169,106,0.6)" }}>
          — Courtside · {p.name} —
        </span>
      </div>
    </main>
  );
}

function VerdictRow({
  label,
  value,
  suffix,
  gold = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  gold?: boolean;
}) {
  return (
    <div className="dot-leader py-1.5">
      <span className="bill-name" style={{ fontSize: 15 }}>{label}</span>
      <span className="dot-leader-dots" />
      <span
        className="font-mono font-semibold"
        style={{ fontSize: 15, color: gold ? "#c9a96a" : "#ece5d8" }}
      >
        {value}
        {suffix && (
          <span style={{ color: "rgba(236,229,216,0.4)", fontWeight: 400 }}> {suffix}</span>
        )}
      </span>
    </div>
  );
}

