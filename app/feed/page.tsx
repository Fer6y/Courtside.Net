import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Flame } from "lucide-react";
import FeedTabs from "@/components/FeedTabs";
import type {
  ActivityItem,
  TrendingPlayer,
  HotMatch,
  Top25Clash,
  ProfileMini,
  PlayerMini,
  MatchMini,
} from "@/lib/feedTypes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity Feed — Courtside",
};

// ── Skill helpers ──────────────────────────────────────────────────────────────

const SKILL_KEYS = [
  "focus","clutch","resilience","processing_time",
  "serve","forehand","backhand","shot_variety",
  "net_play","touch","return_play","reaction_time","deception",
  "speed","court_coverage","positioning","anticipation",
] as const;

const SKILL_LABELS: Record<string, string> = {
  focus: "Focus", clutch: "Clutch", resilience: "Resilience", processing_time: "Proc. Time",
  serve: "Serve", forehand: "Forehand", backhand: "Backhand", shot_variety: "Shot Variety",
  net_play: "Net Play", touch: "Touch", return_play: "Return", reaction_time: "Reaction",
  deception: "Deception", speed: "Speed", court_coverage: "Coverage",
  positioning: "Positioning", anticipation: "Anticipation",
};

function topSkillFromRow(row: Record<string, unknown>) {
  let bestKey = ""; let bestVal = 0;
  for (const key of SKILL_KEYS) {
    const v = Number(row[key]);
    if (!isNaN(v) && v > bestVal) { bestVal = v; bestKey = key; }
  }
  return bestKey ? { label: SKILL_LABELS[bestKey], value: bestVal } : null;
}

const SURFACE_COLOR: Record<string, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c",
};

// reviewCount × (avgRating / 5) gives a combined heat score
function heatEmojis(reviewCount: number, avgRating: number): number {
  const score = reviewCount * (avgRating / 5);
  if (score >= 10) return 5;
  if (score >= 6)  return 4;
  if (score >= 3)  return 3;
  if (score >= 1.5) return 2;
  return 1;
}

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const days  = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function FeedPage() {
  const { userId: clerkId } = await auth();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const since30  = new Date(Date.now() - 30  * 86400000).toISOString();
  const since14  = new Date(Date.now() - 14  * 86400000).toISOString();

  // Get current user's profile ID
  let currentProfileId: string | null = null;
  if (clerkId) {
    const { data: me } = await admin.from("profiles").select("id").eq("clerk_user_id", clerkId).single();
    currentProfileId = me?.id ?? null;
  }

  // All queries in parallel
  const [
    { data: rawReviews },
    { data: rawRatings },
    { data: rawClashMatches },
    { data: followRows },
  ] = await Promise.all([
    // Recent community reviews
    admin
      .from("reviews")
      .select(`
        id, match_rating, comment, created_at,
        user:user_id ( id, username, display_name, clerk_user_id, avatar_config ),
        match:match_id (
          id, tournament, round, surface, match_date,
          player1:player1_id ( id, name ),
          player2:player2_id ( id, name )
        )
      `)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(150),

    // Recent community skill ratings
    admin
      .from("skill_ratings")
      .select(`
        player_id, created_at, user_id, highlighted_skill,
        focus, clutch, resilience, processing_time,
        serve, forehand, backhand, shot_variety,
        net_play, touch, return_play, reaction_time, deception,
        speed, court_coverage, positioning, anticipation,
        user:user_id ( id, username, display_name, clerk_user_id, avatar_config ),
        player:player_id ( id, name, country, current_rank )
      `)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(150),

    // Recent matches for top-25 clash detection
    admin
      .from("matches")
      .select(`
        id, tournament, round, surface, match_date,
        player1:player1_id ( id, name, current_rank ),
        player2:player2_id ( id, name, current_rank )
      `)
      .gte("match_date", since30.slice(0, 10))
      .order("match_date", { ascending: false })
      .limit(200),

    // Current user's follows
    currentProfileId
      ? admin.from("follows").select("following_id").eq("follower_id", currentProfileId)
      : Promise.resolve({ data: [] }),
  ]);

  // ── Build follow set ────────────────────────────────────────────────────────
  const followingIds = new Set((followRows ?? []).map((r: Record<string, unknown>) => r.following_id as string));

  // ── Build activity items ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews = (rawReviews ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ratings = (rawRatings ?? []) as any[];

  const reviewItems: ActivityItem[] = reviews
    .filter((r) => r.user)
    .map((r): ActivityItem => ({
      type:         "review",
      id:           `review-${r.id}`,
      created_at:   r.created_at,
      user:         r.user as ProfileMini,
      match:        r.match as MatchMini | null,
      match_rating: r.match_rating,
      comment:      r.comment,
    }));

  const ratingItems: ActivityItem[] = ratings
    .filter((r) => r.user)
    .map((r): ActivityItem => {
      // Prefer the user's chosen highlighted skill, fall back to computed highest
      const highlighted = r.highlighted_skill as string | null;
      const topSkill = highlighted && SKILL_LABELS[highlighted]
        ? { label: SKILL_LABELS[highlighted], value: Number(r[highlighted]) }
        : topSkillFromRow(r as Record<string, unknown>);
      return {
        type:       "rating",
        id:         `rating-${r.user_id}-${r.player_id}-${r.created_at}`,
        created_at: r.created_at,
        user:       r.user as ProfileMini,
        player:     r.player as PlayerMini | null,
        topSkill,
      };
    });

  const allItems: ActivityItem[] = [...reviewItems, ...ratingItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const communityItems = allItems.slice(0, 80);

  const followingItems = allItems
    .filter((item) => followingIds.has(item.user.id))
    .slice(0, 80);

  // ── Trending players (last 14 days, by rating count) ────────────────────────
  const recentRatings = ratings.filter((r) => r.created_at >= since14);
  const playerCountMap = new Map<string, { count: number; row: typeof ratings[0] }>();
  for (const r of recentRatings) {
    if (!r.player) continue;
    const existing = playerCountMap.get(r.player_id);
    if (!existing || r.created_at > existing.row.created_at) {
      playerCountMap.set(r.player_id, { count: (existing?.count ?? 0) + 1, row: r });
    } else {
      playerCountMap.set(r.player_id, { count: existing.count + 1, row: existing.row });
    }
  }
  const trendingPlayers: TrendingPlayer[] = [...playerCountMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([, { count, row }]) => ({
      player:      row.player as PlayerMini,
      ratingCount: count,
      topSkill:    topSkillFromRow(row as Record<string, unknown>),
    }));

  // ── Hot matches (last 14 days, by review count) ──────────────────────────────
  const recentReviews = reviews.filter((r) => r.created_at >= since14);
  const matchCountMap = new Map<string, { count: number; totalRating: number; match: typeof reviews[0]["match"] }>();
  for (const r of recentReviews) {
    if (!r.match) continue;
    const existing = matchCountMap.get(r.match.id);
    matchCountMap.set(r.match.id, {
      count:       (existing?.count ?? 0) + 1,
      totalRating: (existing?.totalRating ?? 0) + r.match_rating,
      match:       r.match,
    });
  }
  const hotMatches: HotMatch[] = [...matchCountMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([, { count, totalRating, match }]) => ({
      match:       match as MatchMini,
      reviewCount: count,
      avgRating:   totalRating / count,
    }));

  // ── Top 25 clashes ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clashMatches = (rawClashMatches ?? []) as any[];
  const reviewCounts = new Map<string, number>();
  for (const r of reviews) { if (r.match?.id) reviewCounts.set(r.match.id, (reviewCounts.get(r.match.id) ?? 0) + 1); }

  const top25Clashes: Top25Clash[] = clashMatches
    .filter((m) => {
      const r1 = m.player1?.current_rank;
      const r2 = m.player2?.current_rank;
      return r1 && r2 && r1 <= 25 && r2 <= 25;
    })
    .slice(0, 6)
    .map((m) => ({
      match:       m,
      reviewCount: reviewCounts.get(m.id) ?? 0,
    }));

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const totalReviewsThisWeek = reviews.filter(
    (r) => r.created_at >= new Date(Date.now() - 7 * 86400000).toISOString()
  ).length;
  const totalRatingsThisWeek = ratings.filter(
    (r) => r.created_at >= new Date(Date.now() - 7 * 86400000).toISOString()
  ).length;
  const uniquePlayersRated = new Set(
    ratings
      .filter((r) => r.created_at >= new Date(Date.now() - 7 * 86400000).toISOString())
      .map((r) => r.player_id)
  ).size;

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="mb-6">
        <div className="eyebrow" style={{ fontSize: 10, color: "#c9a96a" }}>The Daily</div>
        <h1 className="bill-name mt-1" style={{ fontSize: 32, fontWeight: 500 }}>Activity</h1>
        <p className="bill-name italic mt-0.5" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}>
          What the community is watching, reviewing, and rating.
        </p>
      </div>

      {/* ── Weekly pulse ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-8 mb-10 pb-7" style={{ borderBottom: "1px solid var(--hairline)" }}>
        {[
          { value: totalReviewsThisWeek, label: "Reviews this week" },
          { value: totalRatingsThisWeek, label: "Ratings this week"  },
          { value: uniquePlayersRated,   label: "Players rated"      },
        ].map(({ value, label }) => (
          <div key={label}>
            <div className="font-mono font-bold" style={{ fontSize: 26, color: "#ece5d8" }}>{value}</div>
            <div className="eyebrow mt-0.5" style={{ fontSize: 9, color: "rgba(236,229,216,0.4)" }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10">

        {/* ── Left: Activity feed ───────────────────────────────── */}
        <div>
          <div className="rule-divider mb-5">
            <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>Recent activity</span>
          </div>
          <FeedTabs
            communityItems={communityItems}
            followingItems={followingItems}
            isSignedIn={!!clerkId}
            followingCount={followingIds.size}
          />
        </div>

        {/* ── Right: Sidebar ────────────────────────────────────── */}
        <div className="space-y-10">

          {/* Trending players */}
          {trendingPlayers.length > 0 && (
            <div>
              <div className="rule-divider mb-4">
                <span className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.5)" }}>Trending · 14 days</span>
              </div>
              <div>
                {trendingPlayers.map(({ player, ratingCount, topSkill }, i) => (
                  <Link
                    key={player.id}
                    href={`/players/${player.id}`}
                    className="flex items-baseline gap-3 py-2.5 px-1 transition-colors duration-150"
                    style={{ borderBottom: "1px solid var(--hairline-soft)" }}
                  >
                    <span className="font-mono shrink-0" style={{ fontSize: 11, color: "rgba(236,229,216,0.35)" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="bill-name truncate block" style={{ fontSize: 15, color: "#ece5d8" }}>
                        {player.name}
                      </span>
                      <span className="eyebrow" style={{ fontSize: 8, color: "rgba(236,229,216,0.4)" }}>
                        {player.country ?? ""}
                        {player.current_rank ? ` · No. ${player.current_rank}` : ""}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      {topSkill && (
                        <span className="eyebrow block" style={{ fontSize: 8, color: "#c9a96a" }}>
                          {topSkill.label}
                        </span>
                      )}
                      <span className="font-mono" style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}>{ratingCount} rating{ratingCount !== 1 ? "s" : ""}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top 25 clashes */}
          {top25Clashes.length > 0 && (
            <div>
              <div className="rule-divider mb-4">
                <span className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.5)" }}>Top-25 clashes · 30 days</span>
              </div>
              <div>
                {top25Clashes.map(({ match: m, reviewCount }) => (
                  <Link
                    key={m.id}
                    href={`/matches/${m.id}`}
                    className="block py-2.5 px-1 transition-colors duration-150"
                    style={{ borderBottom: "1px solid var(--hairline-soft)" }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="bill-name truncate" style={{ fontSize: 15 }}>
                        <span style={{ color: "#ece5d8" }}>{m.player1?.name?.split(" ").pop()}</span>
                        <span className="italic" style={{ fontWeight: 300, fontSize: 12, color: "rgba(236,229,216,0.4)" }}> v. </span>
                        <span style={{ color: "#ece5d8" }}>{m.player2?.name?.split(" ").pop()}</span>
                      </span>
                      {m.match_date && (
                        <span className="font-mono shrink-0" style={{ fontSize: 9, color: "rgba(236,229,216,0.4)" }}>{timeAgo(m.match_date)}</span>
                      )}
                    </div>
                    <div className="eyebrow mt-0.5" style={{ fontSize: 8, color: "rgba(236,229,216,0.4)" }}>
                      {m.tournament}
                      {m.surface && <span style={{ color: SURFACE_COLOR[m.surface] ?? "inherit" }}> · {m.surface}</span>}
                      {reviewCount > 0 && <> · {reviewCount} review{reviewCount !== 1 ? "s" : ""}</>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Hot matches */}
          {hotMatches.length > 0 && (
            <div>
              <div className="rule-divider mb-4">
                <span className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.5)" }}>Hot matches · 14 days</span>
              </div>
              <div>
                {hotMatches.map(({ match: m, reviewCount, avgRating }) => (
                  <Link
                    key={m.id}
                    href={`/matches/${m.id}`}
                    className="block py-2.5 px-1 transition-colors duration-150"
                    style={{ borderBottom: "1px solid var(--hairline-soft)" }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="bill-name truncate" style={{ fontSize: 15 }}>
                        <span style={{ color: "#ece5d8" }}>{m.player1?.name?.split(" ").pop()}</span>
                        <span className="italic" style={{ fontWeight: 300, fontSize: 12, color: "rgba(236,229,216,0.4)" }}> v. </span>
                        <span style={{ color: "#ece5d8" }}>{m.player2?.name?.split(" ").pop()}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        {Array.from({ length: heatEmojis(reviewCount, avgRating) }).map((_, i) => (
                          <Flame key={i} size={11} strokeWidth={1.7} style={{ color: "#c9a96a" }} />
                        ))}
                        <span className="font-mono font-bold ml-0.5" style={{ fontSize: 14, color: "#c9a96a" }}>
                          {avgRating.toFixed(1)}
                        </span>
                      </span>
                    </div>
                    <div className="eyebrow mt-0.5" style={{ fontSize: 8, color: "rgba(236,229,216,0.4)" }}>
                      {m.tournament} · {reviewCount} review{reviewCount !== 1 ? "s" : ""}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty sidebar state */}
          {trendingPlayers.length === 0 && top25Clashes.length === 0 && hotMatches.length === 0 && (
            <div
              className="rounded-lg p-6 text-center"
              style={{ background: "rgba(236,229,216,0.02)", border: "1px solid var(--hairline-soft)" }}
            >
              <p className="bill-name italic" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}>
                Trending players and hot matches will appear here as the community grows.
              </p>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
