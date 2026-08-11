import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Folder } from "lucide-react";
import FollowButton from "@/components/FollowButton";
import TrophyCase from "@/components/TrophyCase";
import UserAvatar from "@/components/UserAvatar";
import { type AchievementTier } from "@/lib/achievements";
import { resolveLayout, getVariant, type LayoutConfig, type SectionId } from "@/lib/profileLayout";
import { type AvatarConfig } from "@/lib/avatarTemplates";
import PressBoxTag from "@/components/PressBoxTag";
import { isPressBox } from "@/lib/pressBox";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `@${username} — Courtside` };
}

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

const SURFACE_COLOR: Record<string, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c",
};

function topSkillFromRow(row: Record<string, unknown>) {
  let bestKey = ""; let bestVal = 0;
  for (const key of SKILL_KEYS) {
    const v = Number(row[key]);
    if (!isNaN(v) && v > bestVal) { bestVal = v; bestKey = key; }
  }
  return bestKey ? { label: SKILL_LABELS[bestKey], value: bestVal } : null;
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

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReviewRow {
  id: string;
  match_rating: number;
  player1_rating: number;
  player2_rating: number;
  comment: string | null;
  is_favorited: boolean;
  created_at: string;
  match: {
    id: string; tournament: string; round: string | null;
    surface: string | null; match_date: string | null; winner_id: string | null;
    player1: { id: string; name: string } | null;
    player2: { id: string; name: string } | null;
  } | null;
}

interface RatingRow {
  player_id: string; created_at: string;
  [key: string]: unknown;
  player: { id: string; name: string; country: string | null; current_rank: number | null } | null;
}

interface WatchRow {
  id: string; collection_name: string | null; created_at: string;
  match: {
    id: string; tournament: string; surface: string | null; match_date: string | null;
    player1: { id: string; name: string } | null;
    player2: { id: string; name: string } | null;
  } | null;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const { userId: currentClerkId } = await auth();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, display_name, bio, clerk_user_id, created_at")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  // Fetch layout_config + avatar_config separately so missing columns never break the page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawLayoutConfig: any = null;
  let avatarConfig: AvatarConfig | null = null;
  try {
    const { data } = await admin
      .from("profiles")
      .select("layout_config, avatar_config")
      .eq("id", profile.id)
      .single();
    const row = data as Record<string, unknown> | null;
    rawLayoutConfig = row?.layout_config ?? null;
    avatarConfig    = (row?.avatar_config as AvatarConfig) ?? null;
  } catch { /* columns may not exist yet */ }

  const displayName = profile.display_name ?? profile.username;
  const initials    = displayName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const isOwnProfile = currentClerkId === profile.clerk_user_id;

  let currentProfileId: string | null = null;
  if (currentClerkId && !isOwnProfile) {
    const { data: me } = await admin.from("profiles").select("id").eq("clerk_user_id", currentClerkId).single();
    currentProfileId = me?.id ?? null;
  }

  const [
    { data: rawReviews },
    { data: rawRatings },
    { data: rawWatch },
    { count: followerCount },
    { count: followingCount },
    { data: followRow },
    { data: rawAchievements },
  ] = await Promise.all([
    admin.from("reviews").select(`
      id, match_rating, player1_rating, player2_rating,
      comment, is_favorited, created_at,
      match:match_id (
        id, tournament, round, surface, match_date, winner_id,
        player1:player1_id ( id, name ),
        player2:player2_id ( id, name )
      )
    `).eq("user_id", profile.id).order("created_at", { ascending: false }).limit(50),

    admin.from("skill_ratings").select(`
      player_id, created_at,
      focus, clutch, resilience, processing_time,
      serve, forehand, backhand, shot_variety,
      net_play, touch, return_play, reaction_time, deception,
      speed, court_coverage, positioning, anticipation,
      player:player_id ( id, name, country, current_rank )
    `).eq("user_id", profile.id).order("created_at", { ascending: false }),

    admin.from("watched_matches").select(`
      id, collection_name, created_at,
      match:match_id (
        id, tournament, surface, match_date,
        player1:player1_id ( id, name ),
        player2:player2_id ( id, name )
      )
    `).eq("user_id", profile.id).order("created_at", { ascending: false }),

    admin.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    admin.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),

    currentProfileId
      ? admin.from("follows").select("follower_id").eq("follower_id", currentProfileId).eq("following_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),

    admin.from("achievements").select("achievement_type, tier, earned_at").eq("user_id", profile.id).order("earned_at", { ascending: false }),
  ]);

  const reviews      = (rawReviews      ?? []) as unknown as ReviewRow[];
  const ratings      = (rawRatings      ?? []) as unknown as RatingRow[];
  const watchLog     = (rawWatch        ?? []) as unknown as WatchRow[];
  const achievements = (rawAchievements ?? []) as { achievement_type: string; tier: AchievementTier; earned_at: string }[];

  const followers   = followerCount  ?? 0;
  const following   = followingCount ?? 0;
  const isFollowing = !!followRow;

  // Derived data
  const favorites        = reviews.filter((r) => r.is_favorited);
  const topComments      = reviews.filter((r) => r.comment && r.comment.length > 50).slice(0, 3);
  const recentWatched    = watchLog.slice(0, 6);
  const recentRated      = ratings.slice(0, 6);

  const collectionMap = new Map<string, WatchRow[]>();
  for (const w of watchLog) {
    const key = w.collection_name ?? "Uncollected";
    if (!collectionMap.has(key)) collectionMap.set(key, []);
    collectionMap.get(key)!.push(w);
  }
  const namedCollections = [...collectionMap.entries()].filter(([k]) => k !== "Uncollected");
  const uncollected      = collectionMap.get("Uncollected") ?? [];

  const isEmpty = reviews.length === 0 && ratings.length === 0 && watchLog.length === 0;

  const layoutConfig = rawLayoutConfig as LayoutConfig | null;
  const { order: effectiveOrder, variants: variantsMap } = resolveLayout(layoutConfig);

  // ── Section renderers ────────────────────────────────────────────────────────

  function renderSection(id: SectionId) {
    const variant = variantsMap[id] ?? getVariant(layoutConfig, id);

    switch (id) {

      case "favorites": {
        if (favorites.length === 0) return null;
        if (variant === "grid") {
          return (
            <section key="favorites" className="mb-12">
              <SectionHeader title="Favorites" count={favorites.length} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {favorites.map((r) => {
                  const m = r.match; if (!m) return null;
                  const p1Won = m.winner_id === m.player1?.id;
                  return (
                    <Link key={r.id} href={`/matches/${m.id}`}
                      className="rounded-lg border border-white/5 bg-white/[0.02] p-3 hover:border-yellow-500/20 hover:bg-white/[0.04] transition-all duration-150">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] text-text-dim">{m.match_date?.slice(0, 4)}</span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#c9a96a"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      </div>
                      <div className={`font-sans text-xs font-medium truncate ${p1Won ? "text-primary" : "text-text-primary"}`}>{m.player1?.name ?? "?"}</div>
                      <div className="font-mono text-[9px] text-text-dim my-0.5">vs</div>
                      <div className={`font-sans text-xs font-medium truncate ${!p1Won ? "text-primary" : "text-text-primary"}`}>{m.player2?.name ?? "?"}</div>
                      <div className="font-mono text-[9px] text-text-dim mt-2 truncate">{m.tournament}</div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        }
        // Default: carousel
        return (
          <section key="favorites" className="mb-12">
            <SectionHeader title="Favorites" count={favorites.length} />
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {favorites.map((r) => {
                const m = r.match; if (!m) return null;
                const p1Won = m.winner_id === m.player1?.id;
                return (
                  <Link key={r.id} href={`/matches/${m.id}`}
                    className="shrink-0 rounded-lg border border-white/5 bg-white/[0.02] p-4 hover:border-yellow-500/20 hover:bg-white/[0.04] transition-all duration-150"
                    style={{ minWidth: 220, maxWidth: 240 }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs text-text-dim">{m.match_date?.slice(0, 4)}</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#c9a96a"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </div>
                    <div className={`font-sans text-sm font-medium truncate ${p1Won ? "text-primary" : "text-text-primary"}`}>{m.player1?.name ?? "?"}</div>
                    <div className="font-mono text-[10px] text-text-dim my-0.5">vs</div>
                    <div className={`font-sans text-sm font-medium truncate ${!p1Won ? "text-primary" : "text-text-primary"}`}>{m.player2?.name ?? "?"}</div>
                    <div className="flex items-center gap-2 mb-3 mt-1">
                      <span className="font-mono text-[10px] text-text-dim truncate">{m.tournament}</span>
                      {m.surface && <span className="font-mono text-[10px] shrink-0" style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}>{m.surface}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <MiniRating label="Match" value={r.match_rating} color="#c9a96a" />
                      <MiniRating label={m.player1?.name?.split(" ").pop() ?? "P1"} value={r.player1_rating} color="#22d68a" />
                      <MiniRating label={m.player2?.name?.split(" ").pop() ?? "P2"} value={r.player2_rating} color="#4a9eff" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      }

      case "trophy_case": {
        return (
          <section key="trophy_case" className="mb-12">
            <SectionHeader title="Honours" count={achievements.length} />
            <TrophyCase achievements={achievements} isOwnProfile={isOwnProfile} />
          </section>
        );
      }

      case "featured_comments": {
        if (topComments.length === 0) return null;
        if (variant === "list") {
          return (
            <section key="featured_comments" className="mb-12">
              <SectionHeader title="Featured Comments" />
              <div className="divide-y divide-white/5">
                {topComments.map((r) => {
                  const m = r.match; if (!m) return null;
                  return (
                    <Link key={r.id} href={`/matches/${m.id}`}
                      className="flex items-start gap-3 py-3 px-1 hover:bg-white/[0.02] rounded transition-colors duration-150 group">
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-sm text-text-mid leading-relaxed line-clamp-2 italic">&ldquo;{r.comment}&rdquo;</p>
                        <p className="font-mono text-[10px] text-text-dim mt-1">{m.player1?.name?.split(" ").pop()} vs {m.player2?.name?.split(" ").pop()} · {m.tournament} {m.match_date?.slice(0, 4)}</p>
                      </div>
                      <MiniRating label="Match" value={r.match_rating} color="#c9a96a" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        }
        // Default: cards
        return (
          <section key="featured_comments" className="mb-12">
            <SectionHeader title="Featured Comments" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topComments.map((r) => {
                const m = r.match; if (!m) return null;
                return (
                  <Link key={r.id} href={`/matches/${m.id}`}
                    className="rounded-lg border border-white/5 bg-white/[0.02] p-5 hover:border-white/10 transition-colors duration-150 flex flex-col gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-text-dim">{m.player1?.name?.split(" ").pop()}</span>
                      <span className="font-mono text-[10px] text-text-dim">vs</span>
                      <span className="font-mono text-xs text-text-dim">{m.player2?.name?.split(" ").pop()}</span>
                      <span className="font-mono text-[10px] text-text-dim">· {m.tournament} {m.match_date?.slice(0, 4)}</span>
                    </div>
                    <p className="font-sans text-sm text-text-mid leading-relaxed italic flex-1">&ldquo;{r.comment}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <MiniRating label="Match" value={r.match_rating} color="#c9a96a" />
                      <span className="font-mono text-[10px] text-text-dim ml-auto">{timeAgo(r.created_at)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      }

      case "collections": {
        if (namedCollections.length === 0) return null;
        return (
          <section key="collections" className="mb-12">
            <SectionHeader title="Collections" count={namedCollections.length} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {namedCollections.map(([name, entries]) => (
                <div key={name} className="rounded-lg p-4" style={{ border: "1px solid var(--hairline-soft)", background: "rgba(236,229,216,0.02)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Folder size={15} strokeWidth={1.6} style={{ color: "#c9a96a" }} className="shrink-0" />
                    <span className="bill-name truncate" style={{ fontSize: 15, color: "#ece5d8" }}>{name}</span>
                  </div>
                  <div className="font-mono text-[10px] text-text-dim mb-2">{entries.length} {entries.length === 1 ? "match" : "matches"}</div>
                  {entries.slice(0, 2).map((w) => (
                    <div key={w.id} className="font-sans text-xs text-text-dim truncate leading-relaxed">
                      {w.match?.player1?.name?.split(" ").pop()} vs {w.match?.player2?.name?.split(" ").pop()}
                    </div>
                  ))}
                  {entries.length > 2 && <div className="font-mono text-[10px] text-text-dim mt-1">+{entries.length - 2} more</div>}
                </div>
              ))}
            </div>
          </section>
        );
      }

      case "recent_activity": {
        if (recentWatched.length === 0 && recentRated.length === 0) return null;
        if (variant === "single") {
          // Full-width stacked lists
          return (
            <section key="recent_activity" className="mb-12">
              <SectionHeader title="Recent Activity" />
              <div className="flex flex-col gap-8">
                {recentWatched.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">Watched</p>
                    <div className="divide-y divide-white/5">
                      {recentWatched.map((w) => {
                        const m = w.match; if (!m) return null;
                        return (
                          <Link key={w.id} href={`/matches/${m.id}`}
                            className="flex items-center justify-between py-2.5 hover:bg-white/[0.03] rounded px-1 transition-colors duration-150 group">
                            <div className="min-w-0 flex-1">
                              <span className="font-sans text-sm text-text-primary group-hover:text-primary transition-colors truncate block">
                                {m.player1?.name?.split(" ").pop()} vs {m.player2?.name?.split(" ").pop()}
                              </span>
                              <span className="font-mono text-[10px] text-text-dim">{m.tournament} · {m.match_date?.slice(0, 4)}</span>
                            </div>
                            {m.surface && <span className="font-mono text-[10px] shrink-0 ml-3" style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}>{m.surface}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                {recentRated.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">Players Rated</p>
                    <div className="divide-y divide-white/5">
                      {recentRated.map((r, i) => {
                        const p = r.player;
                        const top = topSkillFromRow(r as unknown as Record<string, unknown>);
                        return (
                          <Link key={`${r.player_id}-${i}`} href={`/players/${r.player_id}`}
                            className="flex items-center justify-between py-2.5 hover:bg-white/[0.03] rounded px-1 transition-colors duration-150 group">
                            <div className="min-w-0">
                              <span className="font-sans text-sm text-text-primary group-hover:text-primary transition-colors truncate block">{p?.name ?? "Unknown"}</span>
                              <span className="font-mono text-[10px] text-text-dim">{p?.country}{p?.current_rank ? ` · #${p.current_rank}` : ""}</span>
                            </div>
                            {top && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full shrink-0 ml-3" style={{ background: "rgba(34,214,138,0.12)", color: "#22d68a" }}>{top.label} {top.value.toFixed(1)}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        }
        // Default: two columns
        return (
          <section key="recent_activity" className="mb-12">
            <SectionHeader title="Recent Activity" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {recentWatched.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">Watched ({watchLog.length})</p>
                  <div className="divide-y divide-white/5">
                    {recentWatched.map((w) => {
                      const m = w.match; if (!m) return null;
                      return (
                        <Link key={w.id} href={`/matches/${m.id}`}
                          className="flex items-center justify-between py-2.5 hover:bg-white/[0.03] rounded px-1 transition-colors duration-150 group">
                          <div className="min-w-0 flex-1">
                            <span className="font-sans text-sm text-text-primary group-hover:text-primary transition-colors truncate block">
                              {m.player1?.name?.split(" ").pop()} vs {m.player2?.name?.split(" ").pop()}
                            </span>
                            <span className="font-mono text-[10px] text-text-dim">{m.tournament} · {m.match_date?.slice(0, 4)}</span>
                          </div>
                          {m.surface && <span className="font-mono text-[10px] shrink-0 ml-3" style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}>{m.surface}</span>}
                        </Link>
                      );
                    })}
                    {uncollected.length > 6 && <p className="font-mono text-[10px] text-text-dim pt-2 px-1">+{watchLog.length - 6} more</p>}
                  </div>
                </div>
              )}
              {recentRated.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-3">Players Rated ({ratings.length})</p>
                  <div className="divide-y divide-white/5">
                    {recentRated.map((r, i) => {
                      const p = r.player;
                      const top = topSkillFromRow(r as unknown as Record<string, unknown>);
                      return (
                        <Link key={`${r.player_id}-${i}`} href={`/players/${r.player_id}`}
                          className="flex items-center justify-between py-2.5 hover:bg-white/[0.03] rounded px-1 transition-colors duration-150 group">
                          <div className="min-w-0">
                            <span className="font-sans text-sm text-text-primary group-hover:text-primary transition-colors truncate block">{p?.name ?? "Unknown"}</span>
                            <span className="font-mono text-[10px] text-text-dim">{p?.country}{p?.current_rank ? ` · #${p.current_rank}` : ""}{" · "}{timeAgo(r.created_at)}</span>
                          </div>
                          {top && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full shrink-0 ml-4" style={{ background: "rgba(34,214,138,0.12)", color: "#22d68a" }}>{top.label} {top.value.toFixed(1)}</span>}
                        </Link>
                      );
                    })}
                    {ratings.length > 6 && <p className="font-mono text-[10px] text-text-dim pt-2 px-1">+{ratings.length - 6} more</p>}
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      }

      case "reviews": {
        if (reviews.length === 0) return null;
        if (variant === "compact") {
          return (
            <section key="reviews">
              <SectionHeader title="All Reviews" count={reviews.length} />
              <div className="divide-y divide-white/5">
                {reviews.map((r) => {
                  const m = r.match; if (!m) return null;
                  const p1Won = m.winner_id === m.player1?.id;
                  return (
                    <Link key={r.id} href={`/matches/${m.id}`}
                      className="flex items-center justify-between py-2.5 px-1 hover:bg-white/[0.02] rounded transition-colors duration-150 group">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-sans text-sm font-medium truncate ${p1Won ? "text-primary" : "text-text-primary"}`}>{m.player1?.name?.split(" ").pop()}</span>
                          <span className="font-mono text-[10px] text-text-dim shrink-0">vs</span>
                          <span className={`font-sans text-sm font-medium truncate ${!p1Won ? "text-primary" : "text-text-primary"}`}>{m.player2?.name?.split(" ").pop()}</span>
                        </div>
                        <span className="font-mono text-[10px] text-text-dim">{m.tournament} · {m.match_date?.slice(0, 4)}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <MiniRating label="M" value={r.match_rating} color="#c9a96a" />
                        {r.is_favorited && <svg width="10" height="10" viewBox="0 0 24 24" fill="#c9a96a"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                        <span className="font-mono text-[10px] text-text-dim">{timeAgo(r.created_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        }
        // Default: cards
        return (
          <section key="reviews">
            <SectionHeader title="All Reviews" count={reviews.length} />
            <div className="flex flex-col gap-3">
              {reviews.map((r) => {
                const m = r.match; if (!m) return null;
                const p1Won = m.winner_id === m.player1?.id;
                return (
                  <Link key={r.id} href={`/matches/${m.id}`}
                    className="rounded-lg border border-white/5 bg-white/[0.02] p-4 hover:border-white/10 transition-colors duration-150 block">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`font-sans text-sm font-medium ${p1Won ? "text-primary" : "text-text-primary"}`}>{m.player1?.name ?? "?"}</span>
                      <span className="font-mono text-xs text-text-dim">vs</span>
                      <span className={`font-sans text-sm font-medium ${!p1Won ? "text-primary" : "text-text-primary"}`}>{m.player2?.name ?? "?"}</span>
                      {m.surface && <span className="font-mono text-xs" style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}>{m.surface}</span>}
                      <span className="font-mono text-xs text-text-dim">{m.tournament} · {m.match_date?.slice(0, 4)}</span>
                      {r.is_favorited && <svg width="11" height="11" viewBox="0 0 24 24" fill="#c9a96a"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                    </div>
                    <div className="flex items-center gap-4 mb-1.5">
                      <MiniRating label="Match" value={r.match_rating} color="#c9a96a" />
                      <MiniRating label={m.player1?.name?.split(" ").pop() ?? "P1"} value={r.player1_rating} color="#22d68a" />
                      <MiniRating label={m.player2?.name?.split(" ").pop() ?? "P2"} value={r.player2_rating} color="#4a9eff" />
                      <span className="font-mono text-[10px] text-text-dim ml-auto">{timeAgo(r.created_at)}</span>
                    </div>
                    {r.comment && <p className="font-sans text-xs text-text-dim leading-relaxed line-clamp-2">{r.comment}</p>}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-12">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
        <UserAvatar config={avatarConfig} initials={initials} size={80} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <h1 className="bill-name leading-none" style={{ fontSize: 32, fontWeight: 500 }}>{displayName}</h1>
                {isPressBox(profile.clerk_user_id) && <PressBoxTag size="md" />}
              </div>
              <p className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.5)" }}>@{profile.username}</p>
            </div>
            <div className="flex items-center gap-2">
              {isOwnProfile && (
                <>
                  <Link
                    href={`/profile/${profile.username}/edit`}
                    className="eyebrow px-3 py-1.5 rounded-md transition-all duration-150"
                    style={{ fontSize: 9, border: "1px solid var(--hairline)", color: "rgba(236,229,216,0.55)" }}
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/profile/${profile.username}/customize`}
                    className="eyebrow px-3 py-1.5 rounded-md transition-all duration-150"
                    style={{ fontSize: 9, border: "1px solid var(--hairline)", color: "rgba(236,229,216,0.55)" }}
                  >
                    Customize
                  </Link>
                  <Link
                    href="/guide"
                    className="eyebrow px-3 py-1.5 rounded-md transition-all duration-150"
                    style={{ fontSize: 9, border: "1px solid var(--hairline)", color: "rgba(236,229,216,0.55)" }}
                    title="How Courtside works"
                  >
                    ?
                  </Link>
                </>
              )}
              {currentClerkId && !isOwnProfile && (
                <FollowButton
                  targetProfileId={profile.id}
                  initialIsFollowing={isFollowing}
                  targetUsername={profile.username}
                />
              )}
            </div>
          </div>
          {profile.bio && <p className="font-sans text-sm mt-2 max-w-md" style={{ color: "rgba(236,229,216,0.7)" }}>{profile.bio}</p>}
          <p className="eyebrow mt-2" style={{ fontSize: 9, color: "rgba(236,229,216,0.4)" }}>Member since {memberSince(profile.created_at)}</p>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────
          The seven stats sit on one line from lg up (they need ~864px, which
          is exactly the max-w-4xl content width). Below that they wrap, and
          because each divider is rendered inside its own item, a wrap left a
          stranded hairline at the start of every new line. So: plain grid on
          mobile with the dividers hidden, untouched inline row on desktop. */}
      <div
        className="grid grid-cols-3 gap-x-4 gap-y-5 lg:flex lg:items-center lg:flex-wrap lg:gap-x-0 lg:gap-y-4 mb-10 pb-8"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        {([
          { value: reviews.length,          label: "Reviews",       tab: "reviews"     },
          { value: favorites.length,        label: "Favorites",     tab: "favorites"   },
          { value: ratings.length,          label: "Players Rated", tab: "ratings"     },
          { value: namedCollections.length, label: "Collections",   tab: "collections" },
          // No `trophies` tab route exists — the [tab] page only accepts the
          // six below, so linking this one 404'd. Honours already has its own
          // trophy_case section further down the profile, so the count stays
          // but stops pretending to be a destination.
          { value: achievements.length,     label: "Honours",       tab: null          },
          { value: followers,               label: "Followers",     tab: "followers"   },
          { value: following,               label: "Following",     tab: "following"   },
        ] as { value: number; label: string; tab: string | null }[]).map(({ value, label, tab }, i) => {
          const body = (
            <>
              <div className="font-mono font-bold transition-colors duration-150" style={{ fontSize: 24, color: "#ece5d8" }}>{value}</div>
              <div className="eyebrow mt-0.5 transition-colors duration-150" style={{ fontSize: 9, color: "rgba(236,229,216,0.4)" }}>{label}</div>
            </>
          );
          return (
            <div key={label} className="flex items-center">
              {i > 0 && <div className="hidden lg:block w-px h-8 mx-6" style={{ background: "var(--hairline)" }} />}
              {tab ? (
                <Link href={`/profile/${profile.username}/${tab}`} className="group">{body}</Link>
              ) : (
                <div>{body}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Empty state ────────────────────────────────────────── */}
      {isEmpty && (
        <div className="rounded-lg p-10 text-center" style={{ border: "1px solid var(--hairline-soft)", background: "rgba(236,229,216,0.02)" }}>
          <p className="bill-name italic mb-5" style={{ fontWeight: 300, fontSize: 15, color: "rgba(236,229,216,0.5)" }}>Rate a player&apos;s skills or review a match to start building your catalogue.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/players" className="eyebrow btn-solid px-4 py-2 rounded-md" style={{ fontSize: 10 }}>Rate a player</Link>
            <Link href="/matches" className="eyebrow px-4 py-2 rounded-md transition-colors duration-150" style={{ fontSize: 10, border: "1px solid var(--hairline)", color: "rgba(236,229,216,0.55)" }}>Browse matches</Link>
          </div>
        </div>
      )}

      {/* ── Sections in user-configured order ─────────────────── */}
      {!isEmpty && effectiveOrder.map((id) => renderSection(id))}

    </main>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="rule-divider mb-4">
      <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>
        {title}{count !== undefined ? ` · ${count}` : ""}
      </span>
    </div>
  );
}

function MiniRating({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[10px] text-text-dim">{label}</span>
      <span className="font-mono text-xs font-bold" style={{ color }}>{value.toFixed(1)}</span>
    </div>
  );
}
