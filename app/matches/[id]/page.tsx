import { getSupabase } from "@/lib/supabase";
import type { Surface } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select(`
      tournament, round,
      player1:player1_id ( name ),
      player2:player2_id ( name )
    `)
    .eq("id", id)
    .single();

  if (!data) return { title: "Match — Courtside" };
  const p1 = (data.player1 as unknown as { name: string } | null)?.name ?? "Player 1";
  const p2 = (data.player2 as unknown as { name: string } | null)?.name ?? "Player 2";
  return { title: `${p1} vs ${p2} — Courtside` };
}

const SURFACE_COLORS: Record<Surface, string> = {
  Hard:   "text-court-hard border-court-hard/30",
  Clay:   "text-court-clay border-court-clay/30",
  Grass:  "text-court-grass border-court-grass/30",
  Carpet: "text-text-dim border-white/10",
};

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: match, error } = await supabase
    .from("matches")
    .select(`
      *,
      player1:player1_id ( id, name, country, current_rank, age, career_stats ),
      player2:player2_id ( id, name, country, current_rank, age, career_stats )
    `)
    .eq("id", id)
    .single();

  if (error || !match) notFound();

  const p1 = match.player1 as { id: string; name: string; country: string | null; current_rank: number | null };
  const p2 = match.player2 as { id: string; name: string; country: string | null; current_rank: number | null };
  const surface = match.surface as Surface | null;
  const won1 = match.winner_id === p1.id;

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      {/* Back */}
      <Link
        href="/matches"
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
      >
        ← All Matches
      </Link>

      {/* Tournament header */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <span className="font-mono text-sm text-text-mid">{match.tournament}</span>
        <span className="text-text-dim">·</span>
        <span className="font-mono text-sm text-text-dim">{match.round}</span>
        {surface && (
          <>
            <span className="text-text-dim">·</span>
            <span className={`font-mono text-xs border px-2 py-0.5 rounded ${SURFACE_COLORS[surface]}`}>
              {surface}
            </span>
          </>
        )}
        {match.match_date && (
          <>
            <span className="text-text-dim">·</span>
            <span className="font-mono text-xs text-text-dim">{match.match_date}</span>
          </>
        )}
      </div>

      {/* Players vs score */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 mb-10">
        <div className="flex items-center justify-between gap-4">
          {/* Player 1 */}
          <Link href={`/players/${p1.id}`} className="flex-1 group">
            <div className={`font-mono text-2xl font-bold transition-colors duration-150 group-hover:text-primary ${won1 ? "text-primary" : "text-text-primary"}`}>
              {p1.name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {p1.country && (
                <span className="font-mono text-xs text-text-dim">{p1.country}</span>
              )}
              {p1.current_rank && (
                <span className="font-mono text-xs text-text-dim">#{p1.current_rank}</span>
              )}
            </div>
            {won1 && (
              <span className="font-mono text-xs text-primary mt-1 block">Winner</span>
            )}
          </Link>

          {/* Score */}
          <div className="text-center px-4">
            {match.score ? (
              <div className="font-mono text-lg text-text-primary whitespace-nowrap">
                {match.score}
              </div>
            ) : (
              <div className="font-mono text-2xl text-text-dim">vs</div>
            )}
          </div>

          {/* Player 2 */}
          <Link href={`/players/${p2.id}`} className="flex-1 text-right group">
            <div className={`font-mono text-2xl font-bold transition-colors duration-150 group-hover:text-primary ${!won1 ? "text-primary" : "text-text-primary"}`}>
              {p2.name}
            </div>
            <div className="flex items-center gap-2 mt-1 justify-end">
              {p2.current_rank && (
                <span className="font-mono text-xs text-text-dim">#{p2.current_rank}</span>
              )}
              {p2.country && (
                <span className="font-mono text-xs text-text-dim">{p2.country}</span>
              )}
            </div>
            {!won1 && (
              <span className="font-mono text-xs text-primary mt-1 block">Winner</span>
            )}
          </Link>
        </div>
      </div>

      {/* Radar placeholder */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 mb-10 flex items-center justify-center min-h-[280px]">
        <p className="font-sans text-text-dim text-sm">
          Head-to-head radar comparison coming soon
        </p>
      </div>

      {/* Reviews placeholder */}
      <section>
        <h2 className="font-mono text-lg font-semibold text-text-mid uppercase tracking-widest mb-4">
          Community Reviews
        </h2>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6">
          <p className="font-sans text-text-dim text-sm">
            Rating and review system coming in Phase 3.
          </p>
        </div>
      </section>
    </main>
  );
}
