import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Surface } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerNameWithBubble from "@/components/PlayerNameWithBubble";
import DeleteReviewButton from "@/components/DeleteReviewButton";
import CommentThread, { type Comment } from "@/components/CommentThread";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select(`tournament, round, player1:player1_id(name), player2:player2_id(name)`)
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

interface ReviewRow {
  id: string;
  match_rating: number;
  player1_rating: number;
  player2_rating: number;
  comment: string | null;
  is_favorited: boolean;
  created_at: string;
  profile: {
    username: string;
    display_name: string | null;
    clerk_user_id: string;
  } | null;
}

function avg(vals: number[]): number {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function fmt(n: number): string {
  return n.toFixed(1);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default async function MatchPage({ params }: Props) {
  const { userId } = await auth();
  const { id } = await params;

  const supabase = getSupabase();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch match
  const { data: match, error } = await supabase
    .from("matches")
    .select(`
      *,
      player1:player1_id ( id, name, country, current_rank ),
      player2:player2_id ( id, name, country, current_rank )
    `)
    .eq("id", id)
    .single();

  if (error || !match) notFound();

  // Fetch reviews with profile info
  const { data: rawReviews } = await admin
    .from("reviews")
    .select(`
      id, match_rating, player1_rating, player2_rating,
      comment, is_favorited, created_at,
      profile:user_id ( username, display_name, clerk_user_id )
    `)
    .eq("match_id", id)
    .order("created_at", { ascending: false });

  const reviews = (rawReviews ?? []) as unknown as ReviewRow[];

  // Fetch comments for all reviews
  const reviewIds = reviews.map((r) => r.id);
  let commentsByReview: Record<string, Comment[]> = {};
  if (reviewIds.length > 0) {
    const { data: rawComments } = await admin
      .from("comments")
      .select(`
        id, user_id, review_id, parent_comment_id, body, created_at,
        profile:user_id ( username, display_name, clerk_user_id )
      `)
      .in("review_id", reviewIds)
      .order("created_at", { ascending: true });

    commentsByReview = ((rawComments ?? []) as unknown as Comment[]).reduce(
      (acc, c) => {
        if (!acc[c.review_id]) acc[c.review_id] = [];
        acc[c.review_id].push(c);
        return acc;
      },
      {} as Record<string, Comment[]>
    );
  }

  // Compute averages
  const count = reviews.length;
  const avgMatch = avg(reviews.map((r) => r.match_rating));
  const avgP1    = avg(reviews.map((r) => r.player1_rating));
  const avgP2    = avg(reviews.map((r) => r.player2_rating));

  // Check if current user has already reviewed
  const userHasReviewed = userId
    ? reviews.some((r) => r.profile?.clerk_user_id === userId)
    : false;

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
          <Link href={`/players/${p1.id}`} className="flex-1 group">
            <div className={`font-mono text-2xl font-bold transition-colors duration-150 group-hover:text-primary ${won1 ? "text-primary" : "text-text-primary"}`}>
              <PlayerNameWithBubble playerId={p1.id} playerName={p1.name} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              {p1.country    && <span className="font-mono text-xs text-text-dim">{p1.country}</span>}
              {p1.current_rank && <span className="font-mono text-xs text-text-dim">#{p1.current_rank}</span>}
            </div>
            {won1 && <span className="font-mono text-xs text-primary mt-1 block">Winner</span>}
          </Link>

          <div className="text-center px-4">
            {match.score
              ? <div className="font-mono text-lg text-text-primary whitespace-nowrap">{match.score}</div>
              : <div className="font-mono text-2xl text-text-dim">vs</div>
            }
          </div>

          <Link href={`/players/${p2.id}`} className="flex-1 text-right group">
            <div className={`font-mono text-2xl font-bold transition-colors duration-150 group-hover:text-primary ${!won1 ? "text-primary" : "text-text-primary"}`}>
              <PlayerNameWithBubble playerId={p2.id} playerName={p2.name} />
            </div>
            <div className="flex items-center gap-2 mt-1 justify-end">
              {p2.current_rank && <span className="font-mono text-xs text-text-dim">#{p2.current_rank}</span>}
              {p2.country      && <span className="font-mono text-xs text-text-dim">{p2.country}</span>}
            </div>
            {!won1 && <span className="font-mono text-xs text-primary mt-1 block">Winner</span>}
          </Link>
        </div>
      </div>

      {/* ── Community Rating Summary ───────────────────────────── */}
      {count > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-text-dim">
              Community Rating
            </h2>
            <span className="font-mono text-xs text-text-dim">
              {count} {count === 1 ? "review" : "reviews"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Match quality */}
            <div className="text-center">
              <div
                className="font-mono text-4xl font-bold mb-1"
                style={{ color: "#f5c518" }}
              >
                {fmt(avgMatch)}
              </div>
              <div className="font-mono text-xs text-text-dim mb-3">Match Quality</div>
              <RatingBar value={avgMatch} color="#f5c518" />
            </div>

            {/* Player 1 */}
            <div className="text-center">
              <div
                className="font-mono text-4xl font-bold mb-1"
                style={{ color: "#22d68a" }}
              >
                {fmt(avgP1)}
              </div>
              <div
                className="font-mono text-xs text-text-dim mb-3 truncate px-1"
                title={p1.name}
              >
                {p1.name.split(" ").pop()}
              </div>
              <RatingBar value={avgP1} color="#22d68a" />
            </div>

            {/* Player 2 */}
            <div className="text-center">
              <div
                className="font-mono text-4xl font-bold mb-1"
                style={{ color: "#4a9eff" }}
              >
                {fmt(avgP2)}
              </div>
              <div
                className="font-mono text-xs text-text-dim mb-3 truncate px-1"
                title={p2.name}
              >
                {p2.name.split(" ").pop()}
              </div>
              <RatingBar value={avgP2} color="#4a9eff" />
            </div>
          </div>
        </div>
      )}

      {/* ── Reviews section ───────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-mono text-lg font-semibold text-text-mid uppercase tracking-widest">
          {count > 0 ? `Reviews (${count})` : "Reviews"}
        </h2>
        <Link
          href={userId ? `/matches/${id}/review` : "/sign-in"}
          className="font-mono text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-150"
          style={{ background: "#22d68a", color: "#0e1116" }}
        >
          {userHasReviewed ? "Edit Review" : "Review Match"}
        </Link>
      </div>

      {count === 0 ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 text-center">
          <p className="font-sans text-text-dim text-sm">
            No reviews yet. Be the first to review this match.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              p1Name={p1.name}
              p2Name={p2.name}
              isOwn={review.profile?.clerk_user_id === userId}
              matchId={id}
              comments={commentsByReview[review.id] ?? []}
              currentClerkUserId={userId ?? null}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────

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

function ReviewCard({
  review,
  p1Name,
  p2Name,
  isOwn,
  matchId,
  comments,
  currentClerkUserId,
}: {
  review: ReviewRow;
  p1Name: string;
  p2Name: string;
  isOwn: boolean;
  matchId: string;
  comments: Comment[];
  currentClerkUserId: string | null;
}) {
  const name = review.profile?.display_name ?? review.profile?.username ?? "Anonymous";

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Avatar initial */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0"
            style={{ background: "rgba(34,214,138,0.15)", color: "#22d68a" }}
          >
            {name[0]?.toUpperCase()}
          </div>
          <div>
            <span className="font-sans text-sm font-medium text-text-primary">
              {name}
            </span>
            {review.profile?.username && (
              <span className="font-mono text-xs text-text-dim ml-2">
                @{review.profile.username}
              </span>
            )}
          </div>
          {review.is_favorited && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#f5c518" className="shrink-0">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isOwn && (
            <>
              <Link
                href={`/matches/${matchId}/review`}
                className="font-mono text-xs text-text-dim hover:text-primary transition-colors duration-150"
              >
                Edit
              </Link>
              <DeleteReviewButton reviewId={review.id} />
            </>
          )}
          <span className="font-mono text-xs text-text-dim">
            {timeAgo(review.created_at)}
          </span>
        </div>
      </div>

      {/* Ratings row */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <RatingBadge label="Match" value={review.match_rating} color="#f5c518" />
        <RatingBadge label={p1Name.split(" ").pop()!} value={review.player1_rating} color="#22d68a" />
        <RatingBadge label={p2Name.split(" ").pop()!} value={review.player2_rating} color="#4a9eff" />
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="font-sans text-sm text-text-mid leading-relaxed">
          {review.comment}
        </p>
      )}

      {/* Comment thread */}
      <CommentThread
        reviewId={review.id}
        initialComments={comments}
        currentClerkUserId={currentClerkUserId}
      />
    </div>
  );
}

function RatingBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-text-dim">{label}</span>
      <span
        className="font-mono text-sm font-bold"
        style={{ color }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}
