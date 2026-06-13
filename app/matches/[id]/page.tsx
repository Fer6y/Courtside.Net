import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Surface } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerNameWithBubble from "@/components/PlayerNameWithBubble";
import DeleteReviewButton from "@/components/DeleteReviewButton";
import CommentThread, { type Comment } from "@/components/CommentThread";
import ReactionBar, { type ReactionSummary, EMPTY_REACTIONS } from "@/components/ReactionBar";
import type { EmojiKey } from "@/components/ReactionBar";
import { getTournamentTier, getCoverBand } from "@/lib/tournamentTiers";
import CourtOverride from "@/components/CourtOverride";
import { surfaceToCourt, courtOverrideScript } from "@/lib/courts";

type Props = { params: Promise<{ id: string }> };

// React cache() dedupes this across generateMetadata and the page body —
// one DB query per request instead of two
const getMatch = cache(async (id: string) => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select(`
      *,
      player1:player1_id ( id, name, country, current_rank, photo_url ),
      player2:player2_id ( id, name, country, current_rank, photo_url )
    `)
    .eq("id", id)
    .single();
  return data;
});

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) return { title: "Match — Courtside" };
  const p1 = (match.player1 as unknown as { name: string } | null)?.name ?? "Player 1";
  const p2 = (match.player2 as unknown as { name: string } | null)?.name ?? "Player 2";
  return { title: `${p1} vs ${p2} — Courtside` };
}

const SURFACE_COLORS: Record<Surface, string> = {
  Hard:   "#4a90d9",
  Clay:   "#d4734e",
  Grass:  "#5cb85c",
  Carpet: "#9ca3af",
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

function formatLongDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function MatchPage({ params }: Props) {
  const { userId } = await auth();
  const { id } = await params;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch match (deduped with generateMetadata via React cache)
  const match = await getMatch(id);
  if (!match) notFound();

  // Fetch reviews with profile info
  const { data: rawReviews } = await admin
    .from("reviews")
    .select(`
      id, match_rating, player1_rating, player2_rating,
      comment, is_favorited, created_at,
      profile:user_id ( username, display_name, clerk_user_id )
    `)
    .eq("match_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  const reviews = (rawReviews ?? []) as unknown as ReviewRow[];
  const reviewIds = reviews.map((r) => r.id);

  // Fetch comments for all reviews
  let commentsByReview: Record<string, Comment[]> = {};
  const allComments: Comment[] = [];
  if (reviewIds.length > 0) {
    const { data: rawComments } = await admin
      .from("comments")
      .select(`
        id, user_id, review_id, parent_comment_id, body, created_at,
        profile:user_id ( username, display_name, clerk_user_id )
      `)
      .in("review_id", reviewIds)
      .order("created_at", { ascending: true });

    const comments = (rawComments ?? []) as unknown as Comment[];
    allComments.push(...comments);
    commentsByReview = comments.reduce(
      (acc, c) => {
        if (!acc[c.review_id]) acc[c.review_id] = [];
        acc[c.review_id].push(c);
        return acc;
      },
      {} as Record<string, Comment[]>
    );
  }

  // Resolve current user's profile ID (for reactions "mine" check)
  let currentProfileId: string | null = null;
  if (userId) {
    const { data: myProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();
    currentProfileId = myProfile?.id ?? null;
  }

  // Fetch all reactions for this match's reviews + comments
  const allCommentIds = allComments.map((c) => c.id);
  const allTargetIds  = [...reviewIds, ...allCommentIds];
  const reactionsMap: Record<string, ReactionSummary> = {};

  if (allTargetIds.length > 0) {
    const { data: rawReactions } = await admin
      .from("reactions")
      .select("target_id, emoji, user_id")
      .in("target_id", allTargetIds);

    for (const r of (rawReactions ?? []) as { target_id: string; emoji: string; user_id: string }[]) {
      if (!reactionsMap[r.target_id]) {
        reactionsMap[r.target_id] = { ...EMPTY_REACTIONS,
          fire:    { count: 0, mine: false },
          shocked: { count: 0, mine: false },
          dislike: { count: 0, mine: false },
        };
      }
      const key = r.emoji as EmojiKey;
      if (reactionsMap[r.target_id][key]) {
        reactionsMap[r.target_id][key].count++;
        if (r.user_id === currentProfileId) reactionsMap[r.target_id][key].mine = true;
      }
    }
  }

  // Compute averages
  const count    = reviews.length;
  const avgMatch = avg(reviews.map((r) => r.match_rating));
  const avgP1    = avg(reviews.map((r) => r.player1_rating));
  const avgP2    = avg(reviews.map((r) => r.player2_rating));

  const userHasReviewed = userId
    ? reviews.some((r) => r.profile?.clerk_user_id === userId)
    : false;

  const isLoggedIn = !!userId;

  const p1 = match.player1 as { id: string; name: string; country: string | null; current_rank: number | null; photo_url: string | null };
  const p2 = match.player2 as { id: string; name: string; country: string | null; current_rank: number | null; photo_url: string | null };
  const surface = match.surface as Surface | null;
  const won1 = match.winner_id === p1.id;
  const tier = ((match.tournament_tier as string | null) ?? getTournamentTier(match.tournament)) as
    | "grand_slam" | "masters_1000" | "other";
  const cover = getCoverBand(match.tournament, tier);

  const singlesLabel =
    match.tour === "WTA" ? "Women's Singles" : match.tour === "ATP" ? "Men's Singles" : null;
  const dateLabel = formatLongDate(match.match_date);
  const p1Last = p1.name.split(" ").pop()!;
  const p2Last = p2.name.split(" ").pop()!;

  // The whole page is read on the court this match was played on —
  // clay matches on clay, grass on grass — overriding the user's theme
  const matchCourt = surfaceToCourt(surface);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      {matchCourt && (
        <>
          <script dangerouslySetInnerHTML={{ __html: courtOverrideScript(matchCourt) }} />
          <CourtOverride court={matchCourt} />
        </>
      )}

      {/* Back */}
      <Link
        href="/matches"
        className="eyebrow mb-8 inline-block transition-colors duration-150"
        style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}
      >
        ← Order of Play
      </Link>

      {/* ── The bill — cover band hero ───────────────────────────── */}
      <div
        className="rounded-lg overflow-hidden mb-12"
        style={{ border: `1px solid ${cover.borderColor}` }}
      >
        <div className="px-6 py-9 text-center" style={{ background: cover.background }}>
          <div className="eyebrow" style={{ color: "#c9a96a" }}>
            {match.tournament}
            {singlesLabel && <> · {singlesLabel}</>}
            {match.round && <> · {match.round}</>}
          </div>

          {/* Match-up */}
          <div className="flex items-baseline justify-center gap-x-4 gap-y-1 flex-wrap mt-5">
            <span
              className="bill-name text-2xl sm:text-3xl"
              style={{
                fontWeight: won1 ? 500 : 300,
                color: won1 ? "#ece5d8" : "rgba(236,229,216,0.72)",
              }}
            >
              <PlayerNameWithBubble playerId={p1.id} playerName={p1.name} />
              {won1 && <span style={{ color: "#c9a96a" }} title="Winner"> ✦</span>}
            </span>
            <span
              className="bill-name italic text-base sm:text-lg"
              style={{ fontWeight: 300, color: "rgba(236,229,216,0.45)" }}
            >
              v.
            </span>
            <span
              className="bill-name text-2xl sm:text-3xl"
              style={{
                fontWeight: !won1 ? 500 : 300,
                color: !won1 ? "#ece5d8" : "rgba(236,229,216,0.72)",
              }}
            >
              <PlayerNameWithBubble playerId={p2.id} playerName={p2.name} />
              {!won1 && <span style={{ color: "#c9a96a" }} title="Winner"> ✦</span>}
            </span>
          </div>

          {/* Score between gold rules */}
          {match.score && (
            <div className="flex items-center justify-center gap-4 mt-5">
              <span className="inline-block w-11" style={{ borderTop: "1px solid rgba(201,169,106,0.5)" }} />
              <span
                className="font-mono text-sm sm:text-base"
                style={{ color: "#ece5d8", letterSpacing: "0.12em" }}
              >
                {match.score.split(" ").map((set: string) => set.replace("-", "–")).join("  ")}
              </span>
              <span className="inline-block w-11" style={{ borderTop: "1px solid rgba(201,169,106,0.5)" }} />
            </div>
          )}

          {/* Venue line */}
          <div className="eyebrow mt-4" style={{ fontSize: 10, color: "rgba(236,229,216,0.5)" }}>
            {surface && (
              <span style={{ color: SURFACE_COLORS[surface] }}>{surface}</span>
            )}
            {surface && dateLabel && " · "}
            {dateLabel}
          </div>
        </div>
      </div>

      {/* ── Notes from the gallery — community averages ──────────── */}
      {count > 0 && (
        <div className="mb-12">
          <div className="rule-divider mb-5">
            <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>
              Notes from the gallery — {count} {count === 1 ? "review" : "reviews"}
            </span>
          </div>
          <div className="mx-auto" style={{ maxWidth: 420 }}>
            <GalleryRow label="Match quality" value={fmt(avgMatch)} gold />
            <GalleryRow label={p1Last} value={fmt(avgP1)} winner={won1} />
            <GalleryRow label={p2Last} value={fmt(avgP2)} winner={!won1} />
          </div>
        </div>
      )}

      {/* ── Reviews ──────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="bill-name text-xl" style={{ fontWeight: 500 }}>
          Reviews
        </h2>
        <Link
          href={userId ? `/matches/${id}/review` : "/sign-in"}
          className="eyebrow btn-solid rounded-md px-4 py-2.5 font-semibold"
          style={{ fontSize: 10 }}
        >
          {userHasReviewed ? "Edit Review" : "Review Match"}
        </Link>
      </div>

      {count === 0 ? (
        <div
          className="rounded-lg p-10 text-center"
          style={{ border: "1px solid var(--hairline-soft)", background: "rgba(236,229,216,0.02)" }}
        >
          <p className="bill-name italic text-sm" style={{ fontWeight: 300, color: "rgba(236,229,216,0.5)" }}>
            No notes yet — be the first in the gallery.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              p1Name={p1Last}
              p2Name={p2Last}
              isOwn={review.profile?.clerk_user_id === userId}
              matchId={id}
              comments={commentsByReview[review.id] ?? []}
              currentClerkUserId={userId ?? null}
              reviewReactions={reactionsMap[review.id] ?? EMPTY_REACTIONS}
              commentReactions={reactionsMap}
              isLoggedIn={isLoggedIn}
            />
          ))}
        </div>
      )}

      {/* ── Colophon ─────────────────────────────────────────────── */}
      <div className="text-center mt-16">
        <span className="eyebrow" style={{ fontSize: 10, color: "rgba(201,169,106,0.6)" }}>
          — Courtside · {match.tournament} —
        </span>
      </div>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function GalleryRow({
  label,
  value,
  gold = false,
  winner = false,
}: {
  label: string;
  value: string;
  gold?: boolean;
  winner?: boolean;
}) {
  return (
    <div className="dot-leader py-1.5">
      <span className="bill-name" style={{ fontSize: 15 }}>
        {label}
        {winner && (
          <span className="italic" style={{ fontSize: 12, color: "#22d68a" }}> — winner</span>
        )}
      </span>
      <span className="dot-leader-dots" />
      <span
        className="font-mono font-semibold"
        style={{ fontSize: 15, color: gold ? "#c9a96a" : "#ece5d8" }}
      >
        {value}
      </span>
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
  reviewReactions,
  commentReactions,
  isLoggedIn,
}: {
  review: ReviewRow;
  p1Name: string;
  p2Name: string;
  isOwn: boolean;
  matchId: string;
  comments: Comment[];
  currentClerkUserId: string | null;
  reviewReactions: ReactionSummary;
  commentReactions: Record<string, ReactionSummary>;
  isLoggedIn: boolean;
}) {
  const name = review.profile?.display_name ?? review.profile?.username ?? "Anonymous";

  return (
    <div
      className="rounded-lg p-5"
      style={{ border: "1px solid var(--hairline-soft)", background: "rgba(236,229,216,0.02)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="bill-name truncate" style={{ fontSize: 15 }}>{name}</span>
          {review.profile?.username && (
            <span className="font-mono text-xs" style={{ color: "rgba(236,229,216,0.4)" }}>
              @{review.profile.username}
            </span>
          )}
          {review.is_favorited && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#c9a96a" className="shrink-0 self-center" aria-label="Favorite match">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isOwn && (
            <>
              <Link
                href={`/matches/${matchId}/review`}
                className="font-mono text-xs transition-colors duration-150 hover:text-primary"
                style={{ color: "rgba(236,229,216,0.4)" }}
              >
                Edit
              </Link>
              <DeleteReviewButton reviewId={review.id} />
            </>
          )}
          <span className="font-mono text-xs" style={{ color: "rgba(236,229,216,0.4)" }}>
            {timeAgo(review.created_at)}
          </span>
        </div>
      </div>

      {/* Ratings line */}
      <div className="font-mono flex items-center gap-4 mb-3 flex-wrap" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
        <span>
          <span style={{ color: "rgba(236,229,216,0.5)" }}>MATCH </span>
          <span className="font-semibold" style={{ color: "#c9a96a" }}>{review.match_rating.toFixed(1)}</span>
        </span>
        <span>
          <span style={{ color: "rgba(236,229,216,0.5)" }}>{p1Name.toUpperCase()} </span>
          <span className="font-semibold" style={{ color: "#ece5d8" }}>{review.player1_rating.toFixed(1)}</span>
        </span>
        <span>
          <span style={{ color: "rgba(236,229,216,0.5)" }}>{p2Name.toUpperCase()} </span>
          <span className="font-semibold" style={{ color: "#ece5d8" }}>{review.player2_rating.toFixed(1)}</span>
        </span>
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="font-sans text-sm leading-relaxed mb-3" style={{ color: "#b5bcb2" }}>
          {review.comment}
        </p>
      )}

      {/* Reactions on the review */}
      <ReactionBar
        targetType="review"
        targetId={review.id}
        initial={reviewReactions}
        isLoggedIn={isLoggedIn}
      />

      {/* Comment thread */}
      <CommentThread
        reviewId={review.id}
        initialComments={comments}
        currentClerkUserId={currentClerkUserId}
        initialReactions={commentReactions}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
