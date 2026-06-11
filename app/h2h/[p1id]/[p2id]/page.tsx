import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Player } from "@/types";
import Link from "next/link";
import Image from "next/image";
import CountryFlag from "@/components/CountryFlag";
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
  const p1LeadsPct = total > 0 ? Math.round((p1Wins / total) * 100) : 50;

  const leader =
    p1Wins > p2Wins ? player1.name
    : p2Wins > p1Wins ? player2.name
    : null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">

      {/* Back */}
      <div className="flex gap-4 mb-8">
        <Link href={`/players/${p1id}`} className="font-sans text-sm text-text-dim hover:text-text-mid transition-colors duration-150">
          ← {player1.name}
        </Link>
        <Link href={`/h2h/${p1id}`} className="font-sans text-sm text-text-dim hover:text-text-mid transition-colors duration-150">
          Change opponent
        </Link>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 mb-8">
        <div className="flex items-center justify-between gap-4">

          {/* Player 1 */}
          <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
            <PlayerAvatar player={player1} isLeader={p1Wins > p2Wins} />
            <div className="text-center">
              <p className="font-mono font-bold text-text-primary text-base sm:text-lg leading-tight">{player1.name}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <CountryFlag code={player1.country} size={20} />
                {player1.current_rank && (
                  <span className="font-mono text-xs text-primary">#{player1.current_rank}</span>
                )}
              </div>
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-3">
              <span className={`font-mono text-5xl font-bold ${p1Wins > p2Wins ? "text-primary" : "text-text-dim"}`}>
                {p1Wins}
              </span>
              <span className="font-mono text-2xl text-text-dim">–</span>
              <span className={`font-mono text-5xl font-bold ${p2Wins > p1Wins ? "text-primary" : "text-text-dim"}`}>
                {p2Wins}
              </span>
            </div>
            <span className="font-mono text-xs text-text-dim uppercase tracking-widest">
              {total} {total === 1 ? "match" : "matches"}
            </span>
            {leader && (
              <span className="font-sans text-xs text-text-dim mt-1">
                {leader} leads
              </span>
            )}
            {!leader && total > 0 && (
              <span className="font-sans text-xs text-text-dim mt-1">All square</span>
            )}
          </div>

          {/* Player 2 */}
          <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
            <PlayerAvatar player={player2} isLeader={p2Wins > p1Wins} />
            <div className="text-center">
              <p className="font-mono font-bold text-text-primary text-base sm:text-lg leading-tight">{player2.name}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <CountryFlag code={player2.country} size={20} />
                {player2.current_rank && (
                  <span className="font-mono text-xs text-primary">#{player2.current_rank}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Win % bar */}
        {total > 0 && (
          <div className="mt-6">
            <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${p1LeadsPct}%`,
                  background: "linear-gradient(to right, #22d68a, #22d68a99)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-xs text-primary">{p1LeadsPct}%</span>
              <span className="font-mono text-xs text-text-dim">{100 - p1LeadsPct}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Surface breakdown ───────────────────────────────────────────────── */}
      {Object.keys(surfaceMap).filter(s => s !== "Unknown").length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {["Hard", "Clay", "Grass"].map((surface) => {
            const s = surfaceMap[surface];
            if (!s) return null;
            const tot = s.p1 + s.p2;
            return (
              <div key={surface} className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center">
                <p className="font-mono text-xs font-semibold mb-3" style={{ color: SURFACE_COLORS[surface] }}>
                  {surface}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className={`font-mono text-2xl font-bold ${s.p1 > s.p2 ? "text-primary" : "text-text-dim"}`}>{s.p1}</span>
                  <span className="font-mono text-sm text-text-dim">–</span>
                  <span className={`font-mono text-2xl font-bold ${s.p2 > s.p1 ? "text-primary" : "text-text-dim"}`}>{s.p2}</span>
                </div>
                <p className="font-mono text-xs text-text-dim mt-1">{tot} {tot === 1 ? "match" : "matches"}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Slam Finals ─────────────────────────────────────────────────────── */}
      {(slamWins.p1 + slamWins.p2) > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-5 mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim mb-4">Grand Slam Finals</p>
          <div className="flex items-center gap-4">
            <span className={`font-mono text-3xl font-bold ${slamWins.p1 > slamWins.p2 ? "text-primary" : "text-text-dim"}`}>{slamWins.p1}</span>
            <span className="font-mono text-text-dim">–</span>
            <span className={`font-mono text-3xl font-bold ${slamWins.p2 > slamWins.p1 ? "text-primary" : "text-text-dim"}`}>{slamWins.p2}</span>
            <span className="font-sans text-xs text-text-dim ml-2">in Slam Finals</span>
          </div>
        </div>
      )}

      {/* ── Skill Comparison ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-6">
          Skill Comparison
        </h2>
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
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-4">
          Match History
        </h2>

        {matches.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-10 text-center">
            <p className="font-mono text-text-dim text-sm">No matches found between these players.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {matches.map((match) => {
              const p1Won = match.winner_id === p1id;
              const p2Won = match.winner_id === p2id;
              const surface = match.surface as string | null;

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
                >
                  {/* Left: result + tournament */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Winner indicator */}
                    <div className="flex gap-1 shrink-0">
                      <span className={`font-mono text-xs font-bold w-4 text-center ${p1Won ? "text-primary" : p2Won ? "text-loss" : "text-text-dim"}`}>
                        {p1Won ? "W" : p2Won ? "L" : "—"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-text-primary truncate group-hover:text-primary transition-colors duration-150">
                        {match.tournament}
                      </p>
                      <p className="font-mono text-xs text-text-dim">{match.round}</p>
                    </div>
                  </div>

                  {/* Right: score + surface + year */}
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    {match.score && (
                      <span className="font-mono text-sm text-text-mid hidden sm:block">{match.score}</span>
                    )}
                    {surface && (
                      <span className="font-mono text-xs" style={{ color: SURFACE_COLORS[surface] ?? "#6b7280" }}>
                        {surface}
                      </span>
                    )}
                    {match.match_date && (
                      <span className="font-mono text-xs text-text-dim">{match.match_date.slice(0, 4)}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function PlayerAvatar({ player, isLeader }: { player: Player; isLeader: boolean }) {
  const frameStyle: React.CSSProperties = isLeader
    ? { background: "linear-gradient(135deg, #22d68a, #16a863)", padding: "2px", boxShadow: "0 0 12px rgba(34,214,138,0.4)" }
    : { border: "2px solid rgba(255,255,255,0.08)" };

  return (
    <div className="w-16 h-16 rounded-full shrink-0" style={frameStyle}>
      {(player.photo_url || player.image_url) ? (
        <Image
          src={player.photo_url ?? player.image_url ?? ""}
          alt={player.name}
          width={64}
          height={64}
          className="w-full h-full rounded-full object-cover object-top"
          unoptimized
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-mono text-lg font-bold"
          style={{ background: "rgba(34,214,138,0.1)", color: "#22d68a" }}
        >
          {player.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
        </div>
      )}
    </div>
  );
}
