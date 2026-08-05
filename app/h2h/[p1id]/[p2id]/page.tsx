import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Player } from "@/types";
import Link from "next/link";
import Image from "next/image";
import CompareView from "@/components/CompareView";

type Props = { params: Promise<{ p1id: string; p2id: string }> };

export async function generateMetadata({ params }: Props) {
  const { p1id, p2id } = await params;
  const supabase = getSupabase();
  const [{ data: p1 }, { data: p2 }] = await Promise.all([
    supabase.from("players").select("name").eq("id", p1id).single(),
    supabase.from("players").select("name").eq("id", p2id).single(),
  ]);
  if (!p1 || !p2) return { title: "H2H — Courtside" };
  return { title: `${p1.name} vs ${p2.name} — Courtside` };
}

const SURFACE_COLORS: Record<string, string> = {
  Hard:  "#4a90d9",
  Clay:  "#d4734e",
  Grass: "#5cb85c",
};

const ROUND_PRIORITY: Record<string, number> = {
  Final: 10, Semifinal: 9, Quarterfinal: 8,
  "Round of 16": 7, "Round of 32": 6, "Round of 64": 5, "Round of 128": 4,
};

const SKILL_KEYS = [
  "focus", "clutch", "resilience", "processing_time",
  "serve", "forehand", "backhand", "shot_variety",
  "net_play", "touch", "return_play", "reaction_time", "deception",
  "speed", "court_coverage", "positioning", "anticipation",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRatings(id: string, admin: any) {
  const { data: skillRows } = await admin
    .from("skill_ratings")
    .select(SKILL_KEYS.join(","))
    .eq("player_id", id);

  const ratings: Record<string, number> = {};
  const ratingCount = skillRows?.length ?? 0;

  if (ratingCount > 0) {
    for (const key of SKILL_KEYS) {
      const vals = (skillRows ?? [])
        .map((r: unknown) => Number((r as Record<string, unknown>)[key]))
        .filter((v: number) => !isNaN(v) && v > 0);
      if (vals.length > 0) {
        ratings[key] = Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10;
      }
    }
  }

  return { ratings, ratingCount };
}

export default async function H2HPage({ params }: Props) {
  const { p1id, p2id } = await params;
  const supabase = getSupabase();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch both players, all H2H matches, and skill ratings in parallel
  const [
    { data: p1 },
    { data: p2 },
    { data: rawMatches },
    p1RatingsData,
    p2RatingsData,
  ] = await Promise.all([
    supabase.from("players").select("*").eq("id", p1id).single(),
    supabase.from("players").select("*").eq("id", p2id).single(),
    supabase
      .from("matches")
      .select("id, tournament, round, surface, score, winner_id, player1_id, player2_id, match_date, tournament_season")
      .or(`and(player1_id.eq.${p1id},player2_id.eq.${p2id}),and(player1_id.eq.${p2id},player2_id.eq.${p1id})`)
      .order("match_date", { ascending: false, nullsFirst: false })
      .limit(100),
    fetchRatings(p1id, admin),
    fetchRatings(p2id, admin),
  ]);

  if (!p1 || !p2) notFound();

  const player1 = p1 as Player;
  const player2 = p2 as Player;

  // Sort by date desc, Finals first within same date
  const matches = (rawMatches ?? []).sort((a, b) => {
    const d = (b.match_date ?? "").localeCompare(a.match_date ?? "");
    if (d !== 0) return d;
    return (ROUND_PRIORITY[b.round ?? ""] ?? 0) - (ROUND_PRIORITY[a.round ?? ""] ?? 0);
  });

  // ── Aggregate stats ────────────────────────────────────────────────────────
  let p1Wins = 0, p2Wins = 0;
  const surfaceMap: Record<string, { p1: number; p2: number }> = {};
  const slamWins = { p1: 0, p2: 0 };

  const SLAM_NAMES = ["Australian Open", "Roland Garros", "Wimbledon", "US Open"];

  for (const m of matches) {
    const p1Won = m.winner_id === p1id;
    const p2Won = m.winner_id === p2id;

    if (p1Won) p1Wins++;
    else if (p2Won) p2Wins++;

    const s = m.surface ?? "Unknown";
    if (!surfaceMap[s]) surfaceMap[s] = { p1: 0, p2: 0 };
    if (p1Won) surfaceMap[s].p1++;
    else if (p2Won) surfaceMap[s].p2++;

    const isSlam = SLAM_NAMES.some((name) => m.tournament?.includes(name));
    if (isSlam && m.round === "Final") {
      if (p1Won) slamWins.p1++;
      else if (p2Won) slamWins.p2++;
    }
  }

  const total = p1Wins + p2Wins;

  const leader =
    p1Wins > p2Wins ? player1.name
    : p2Wins > p1Wins ? player2.name
    : null;

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-12">

      {/* Back */}
      <div className="flex gap-4 mb-8">
        <Link href={`/players/${p1id}`} className="eyebrow transition-colors duration-150" style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}>
          ← {player1.name}
        </Link>
        <Link href={`/h2h/${p1id}`} className="eyebrow transition-colors duration-150" style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}>
          Change opponent
        </Link>
      </div>

      {/* ── The Rivalry — bill ──────────────────────────────────────────────── */}
      <div className="text-center mb-12">
        <div className="eyebrow" style={{ fontSize: 10, color: "#c9a96a" }}>The Rivalry</div>

        <div className="flex items-center justify-center gap-6 mt-5 flex-wrap">
          <div className="flex flex-col items-center gap-2">
            <PlayerAvatar player={player1} isLeader={p1Wins > p2Wins} />
          </div>
          <div className="flex flex-col items-center shrink-0">
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono font-bold" style={{ fontSize: 44, color: p1Wins > p2Wins ? "#c9a96a" : "rgba(236,229,216,0.45)" }}>{p1Wins}</span>
              <span className="font-mono" style={{ fontSize: 20, color: "rgba(236,229,216,0.35)" }}>–</span>
              <span className="font-mono font-bold" style={{ fontSize: 44, color: p2Wins > p1Wins ? "#c9a96a" : "rgba(236,229,216,0.45)" }}>{p2Wins}</span>
            </div>
            <span className="eyebrow mt-1" style={{ fontSize: 9, color: "rgba(236,229,216,0.45)" }}>
              {total} {total === 1 ? "meeting" : "meetings"}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <PlayerAvatar player={player2} isLeader={p2Wins > p1Wins} />
          </div>
        </div>

        {/* Names with italic v. */}
        <div className="flex items-baseline justify-center gap-3 flex-wrap mt-5">
          <span className="bill-name" style={{ fontSize: 24, fontWeight: p1Wins > p2Wins ? 500 : 300, color: p1Wins >= p2Wins ? "#ece5d8" : "rgba(236,229,216,0.7)" }}>
            {player1.name}
          </span>
          <span className="bill-name italic" style={{ fontSize: 15, fontWeight: 300, color: "rgba(236,229,216,0.45)" }}>v.</span>
          <span className="bill-name" style={{ fontSize: 24, fontWeight: p2Wins > p1Wins ? 500 : 300, color: p2Wins >= p1Wins ? "#ece5d8" : "rgba(236,229,216,0.7)" }}>
            {player2.name}
          </span>
        </div>
        <div className="eyebrow mt-2" style={{ fontSize: 9, color: "rgba(236,229,216,0.5)" }}>
          {player1.country}
          {player1.current_rank ? ` · No. ${player1.current_rank}` : ""}
          {"  —  "}
          {player2.country}
          {player2.current_rank ? ` · No. ${player2.current_rank}` : ""}
        </div>
        {leader && (
          <div className="bill-name italic mt-3" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.55)" }}>
            {leader} leads the rivalry
          </div>
        )}
        {!leader && total > 0 && (
          <div className="bill-name italic mt-3" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.55)" }}>
            All square
          </div>
        )}
      </div>

      {/* ── The record — dot leaders ────────────────────────────────────────── */}
      {(Object.keys(surfaceMap).filter(s => s !== "Unknown").length > 0 || (slamWins.p1 + slamWins.p2) > 0) && (
        <div className="mb-12">
          <div className="rule-divider mb-5">
            <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>The record</span>
          </div>
          <div className="mx-auto" style={{ maxWidth: 420 }}>
            {["Hard", "Clay", "Grass"].map((surface) => {
              const s = surfaceMap[surface];
              if (!s) return null;
              return (
                <div key={surface} className="dot-leader py-1.5">
                  <span className="bill-name" style={{ fontSize: 15 }}>
                    On <span style={{ color: SURFACE_COLORS[surface] }}>{surface.toLowerCase()}</span>
                  </span>
                  <span className="dot-leader-dots" />
                  <span className="font-mono font-semibold" style={{ fontSize: 15, color: "#ece5d8" }}>
                    {s.p1}<span style={{ color: "rgba(236,229,216,0.35)" }}>–</span>{s.p2}
                  </span>
                </div>
              );
            })}
            {(slamWins.p1 + slamWins.p2) > 0 && (
              <div className="dot-leader py-1.5">
                <span className="bill-name" style={{ fontSize: 15 }}>
                  In <span style={{ color: "#c9a96a" }}>Grand Slam finals</span>
                </span>
                <span className="dot-leader-dots" />
                <span className="font-mono font-semibold" style={{ fontSize: 15, color: "#c9a96a" }}>
                  {slamWins.p1}<span style={{ color: "rgba(236,229,216,0.35)" }}>–</span>{slamWins.p2}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Skill Comparison ────────────────────────────────────────────────── */}
      <div className="mb-12">
        <div className="rule-divider mb-6">
          <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>Skill comparison</span>
        </div>
        <CompareView
          p1={{
            id: p1id,
            name: player1.name,
            country: player1.country ?? null,
            current_rank: player1.current_rank ?? null,
            ratings: p1RatingsData.ratings,
            ratingCount: p1RatingsData.ratingCount,
          }}
          p2={{
            id: p2id,
            name: player2.name,
            country: player2.country ?? null,
            current_rank: player2.current_rank ?? null,
            ratings: p2RatingsData.ratings,
            ratingCount: p2RatingsData.ratingCount,
          }}
          h2hMatches={matches}
          showH2HCard={false}
        />
      </div>

      {/* ── Match history ───────────────────────────────────────────────────── */}
      <section>
        <div className="rule-divider mb-5">
          <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>Every meeting</span>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-lg p-10 text-center" style={{ border: "1px solid var(--hairline-soft)", background: "rgba(236,229,216,0.02)" }}>
            <p className="bill-name italic text-sm" style={{ fontWeight: 300, color: "rgba(236,229,216,0.5)" }}>
              These two have never met in the catalogue.
            </p>
          </div>
        ) : (
          <div>
            {matches.map((match) => {
              const p1Won = match.winner_id === p1id;
              const p2Won = match.winner_id === p2id;
              const surface = match.surface as string | null;
              const winnerName = p1Won ? player1.name : p2Won ? player2.name : null;

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-baseline justify-between gap-x-4 gap-y-0.5 flex-wrap py-3 px-1 transition-colors duration-150"
                  style={{ borderBottom: "1px solid var(--hairline-soft)" }}
                >
                  <span className="bill-name min-w-0 truncate" style={{ fontSize: 15 }}>
                    {winnerName ? (
                      <>
                        <span style={{ color: "#ece5d8" }}>{winnerName.split(" ").pop()}</span>
                        <span className="italic" style={{ fontWeight: 300, fontSize: 13, color: "rgba(236,229,216,0.4)" }}> won </span>
                        <span style={{ color: "rgba(236,229,216,0.55)" }}>{match.tournament}</span>
                      </>
                    ) : (
                      <span style={{ color: "#ece5d8" }}>{match.tournament}</span>
                    )}
                  </span>
                  <span className="font-mono shrink-0" style={{ fontSize: 11, letterSpacing: "0.08em", color: "rgba(236,229,216,0.45)" }}>
                    {match.score && <span className="hidden sm:inline">{match.score} · </span>}
                    {match.round}
                    {surface && <> · <span style={{ color: SURFACE_COLORS[surface] ?? "rgba(236,229,216,0.45)" }}>{surface.toUpperCase()}</span></>}
                    {match.match_date && <> · {match.match_date.slice(0, 4)}</>}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Colophon ─────────────────────────────────────────────────────────── */}
      <div className="text-center mt-16">
        <span className="eyebrow" style={{ fontSize: 10, color: "rgba(201,169,106,0.6)" }}>
          — Courtside · {player1.name.split(" ").pop()} v. {player2.name.split(" ").pop()} —
        </span>
      </div>
    </main>
  );
}

function PlayerAvatar({ player, isLeader }: { player: Player; isLeader: boolean }) {
  return (
    <div
      className="w-16 h-16 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
      style={{
        border: isLeader ? "2px solid rgba(201,169,106,0.85)" : "2px solid rgba(236,229,216,0.2)",
        background: "rgba(236,229,216,0.04)",
      }}
    >
      {(player.photo_url || player.image_url) ? (
        <Image
          src={player.photo_url ?? player.image_url ?? ""}
          alt={player.name}
          width={64}
          height={64}
          className="w-full h-full object-cover object-top"
          unoptimized
        />
      ) : (
        <span className="bill-name" style={{ fontSize: 18, color: "rgba(236,229,216,0.45)" }}>
          {player.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
      )}
    </div>
  );
}
