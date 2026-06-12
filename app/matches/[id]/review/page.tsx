import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ReviewMatchForm from "./ReviewMatchForm";
import { getExistingReview } from "./actions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select(`tournament, round, player1:player1_id(name), player2:player2_id(name)`)
    .eq("id", id)
    .single();
  if (!data) return { title: "Review Match — Courtside" };
  const p1 = (data.player1 as unknown as { name: string } | null)?.name ?? "Player 1";
  const p2 = (data.player2 as unknown as { name: string } | null)?.name ?? "Player 2";
  return { title: `Review: ${p1} vs ${p2} — Courtside` };
}

export default async function ReviewMatchPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const supabase = getSupabase();

  const { data: match, error } = await supabase
    .from("matches")
    .select(`
      id, tournament, round, surface, match_date, score,
      player1:player1_id ( id, name, current_rank ),
      player2:player2_id ( id, name, current_rank )
    `)
    .eq("id", id)
    .single();

  if (error || !match) notFound();

  const p1 = match.player1 as unknown as { id: string; name: string; current_rank: number | null };
  const p2 = match.player2 as unknown as { id: string; name: string; current_rank: number | null };

  const existing = await getExistingReview(id);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Back */}
      <Link
        href={`/matches/${id}`}
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
      >
        ← Back to match
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold text-text-primary">
          {existing ? "Edit Review" : "Review Match"}
        </h1>

        {/* Match summary */}
        <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-mono text-base font-semibold text-primary">{p1.name}</div>
              {p1.current_rank && (
                <div className="font-mono text-xs text-text-dim">#{p1.current_rank}</div>
              )}
            </div>
            <div className="text-center flex-shrink-0">
              {match.score ? (
                <div className="font-mono text-sm text-text-mid whitespace-nowrap">{match.score}</div>
              ) : (
                <div className="font-mono text-sm text-text-dim">vs</div>
              )}
              <div className="font-mono text-xs text-text-dim mt-0.5">{match.round}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-base font-semibold text-text-primary">{p2.name}</div>
              {p2.current_rank && (
                <div className="font-mono text-xs text-text-dim">#{p2.current_rank}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
            <span className="font-sans text-xs text-text-dim">{match.tournament}</span>
            {match.surface && (
              <>
                <span className="text-text-dim">·</span>
                <span className="font-mono text-xs text-text-dim">{match.surface}</span>
              </>
            )}
            {match.match_date && (
              <>
                <span className="text-text-dim">·</span>
                <span className="font-mono text-xs text-text-dim">{match.match_date}</span>
              </>
            )}
          </div>
        </div>

        {existing && (
          <p className="font-mono text-xs text-primary mt-3">✓ Updating your existing review</p>
        )}
      </div>

      <ReviewMatchForm
        matchId={id}
        player1={{ id: p1.id, name: p1.name }}
        player2={{ id: p2.id, name: p2.name }}
        existing={existing}
      />
    </main>
  );
}
