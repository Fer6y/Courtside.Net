import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";

type Tab = "reviews" | "favorites" | "ratings" | "collections" | "followers" | "following";

const TAB_LABELS: Record<Tab, string> = {
  reviews:     "Reviews",
  favorites:   "Favorites",
  ratings:     "Players Rated",
  collections: "Collections",
  followers:   "Followers",
  following:   "Following",
};

const VALID_TABS = new Set<string>(Object.keys(TAB_LABELS));

const SURFACE_COLOR: Record<string, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c",
};

const SKILL_KEYS = [
  "focus","clutch","resilience","serve","forehand","backhand",
  "net_play","touch","return_play","reaction_time",
  "speed","court_coverage","positioning",
] as const;

const SKILL_LABELS: Record<string, string> = {
  focus: "Focus", clutch: "Clutch", resilience: "Resilience",
  serve: "Serve", forehand: "Forehand", backhand: "Backhand",
  net_play: "Net Play", touch: "Touch", return_play: "Return",
  reaction_time: "Reaction", speed: "Speed",
  court_coverage: "Coverage", positioning: "Positioning",
};

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

function topSkill(row: Record<string, unknown>) {
  let bestKey = ""; let bestVal = 0;
  for (const key of SKILL_KEYS) {
    const v = Number(row[key]);
    if (!isNaN(v) && v > bestVal) { bestVal = v; bestKey = key; }
  }
  return bestKey ? { label: SKILL_LABELS[bestKey], value: bestVal } : null;
}

type Props = { params: Promise<{ username: string; tab: string }> };

export async function generateMetadata({ params }: Props) {
  const { username, tab } = await params;
  const label = TAB_LABELS[tab as Tab] ?? tab;
  return { title: `${label} — @${username} — Courtside` };
}

export default async function ProfileTabPage({ params }: Props) {
  const { username, tab } = await params;

  if (!VALID_TABS.has(tab)) notFound();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const displayName = profile.display_name ?? profile.username;
  const label       = TAB_LABELS[tab as Tab];

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">

      {/* Back to profile */}
      <Link
        href={`/profile/${username}`}
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-6 inline-block transition-colors duration-150"
      >
        ← {displayName}
      </Link>

      <h1 className="font-mono text-2xl font-bold text-text-primary mb-8">
        {label}
      </h1>

      <TabContent tab={tab as Tab} profile={profile} />
    </main>
  );
}

// ── Per-tab data fetching + rendering ─────────────────────────────────────────

async function TabContent({
  tab,
  profile,
}: {
  tab: Tab;
  profile: { id: string; username: string; display_name: string | null };
}) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  switch (tab) {

    case "reviews":
    case "favorites": {
      let q = admin
        .from("reviews")
        .select(`
          id, match_rating, player1_rating, player2_rating,
          comment, is_favorited, created_at,
          match:match_id (
            id, tournament, round, surface, match_date, winner_id,
            player1:player1_id ( id, name ),
            player2:player2_id ( id, name )
          )
        `)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (tab === "favorites") q = q.eq("is_favorited", true);

      const { data } = await q;
      const rows = (data ?? []) as unknown as ReviewRow[];

      if (rows.length === 0) {
        return <Empty message={`No ${tab} yet.`} />;
      }

      return (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const m = r.match;
            if (!m) return null;
            const p1Won = m.winner_id === m.player1?.id;
            return (
              <Link
                key={r.id}
                href={`/matches/${m.id}`}
                className="rounded-lg border border-white/5 bg-white/[0.02] p-5 hover:border-white/10 transition-colors duration-150 block"
              >
                {/* Match header */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`font-sans text-sm font-medium ${p1Won ? "text-primary" : "text-text-primary"}`}>
                    {m.player1?.name ?? "?"}
                  </span>
                  <span className="font-mono text-xs text-text-dim">vs</span>
                  <span className={`font-sans text-sm font-medium ${!p1Won ? "text-primary" : "text-text-primary"}`}>
                    {m.player2?.name ?? "?"}
                  </span>
                  {m.surface && (
                    <span className="font-mono text-xs" style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}>
                      {m.surface}
                    </span>
                  )}
                  <span className="font-mono text-xs text-text-dim">
                    {m.tournament}{m.round ? ` · ${m.round}` : ""}{m.match_date ? ` · ${m.match_date.slice(0, 4)}` : ""}
                  </span>
                  {r.is_favorited && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#f5c518">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  )}
                </div>
                {/* Ratings */}
                <div className="flex items-center gap-4 mb-2 flex-wrap">
                  <MiniRating label="Match"                                        value={r.match_rating}   color="#f5c518" />
                  <MiniRating label={m.player1?.name?.split(" ").pop() ?? "P1"}    value={r.player1_rating} color="#22d68a" />
                  <MiniRating label={m.player2?.name?.split(" ").pop() ?? "P2"}    value={r.player2_rating} color="#4a9eff" />
                  <span className="font-mono text-[10px] text-text-dim ml-auto">{timeAgo(r.created_at)}</span>
                </div>
                {/* Comment */}
                {r.comment && (
                  <p className="font-sans text-sm text-text-mid leading-relaxed">{r.comment}</p>
                )}
              </Link>
            );
          })}
        </div>
      );
    }

    case "ratings": {
      const { data } = await admin
        .from("skill_ratings")
        .select(`
          player_id, created_at,
          focus, clutch, resilience, serve, forehand, backhand,
          net_play, touch, return_play, reaction_time,
          speed, court_coverage, positioning,
          player:player_id ( id, name, country, current_rank )
        `)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as unknown as RatingRow[];

      if (rows.length === 0) return <Empty message="No player ratings yet." />;

      return (
        <div className="divide-y divide-white/5">
          {rows.map((r, i) => {
            const p   = r.player;
            const top = topSkill(r as unknown as Record<string, unknown>);
            return (
              <Link
                key={`${r.player_id}-${i}`}
                href={`/players/${r.player_id}`}
                className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-sans text-sm text-text-primary group-hover:text-primary transition-colors truncate block">
                    {p?.name ?? "Unknown"}
                  </span>
                  <span className="font-mono text-xs text-text-dim">
                    {p?.country}{p?.current_rank ? ` · #${p.current_rank}` : ""}
                    {" · "}{timeAgo(r.created_at)}
                  </span>
                </div>
                {top && (
                  <span
                    className="font-mono text-xs px-2 py-0.5 rounded-full shrink-0 ml-4"
                    style={{ background: "rgba(34,214,138,0.12)", color: "#22d68a" }}
                  >
                    {top.label} {top.value.toFixed(1)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      );
    }

    case "collections": {
      const { data } = await admin
        .from("watched_matches")
        .select(`
          collection_name, created_at,
          match:match_id (
            id, tournament, round, surface, match_date,
            player1:player1_id ( id, name ),
            player2:player2_id ( id, name )
          )
        `)
        .eq("user_id", profile.id)
        .not("collection_name", "is", null)
        .order("collection_name", { ascending: true })
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as unknown as WatchRow[];

      if (rows.length === 0) return <Empty message="No collections yet. Add matches to a folder when reviewing." />;

      // Group by collection_name
      const grouped: Record<string, WatchRow[]> = {};
      for (const row of rows) {
        const key = row.collection_name ?? "Uncategorized";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }

      return (
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([collectionName, items]) => (
            <div key={collectionName}>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-sm font-semibold text-text-primary">{collectionName}</span>
                <span className="font-mono text-xs text-text-dim">{items.length} {items.length === 1 ? "match" : "matches"}</span>
              </div>
              <div className="divide-y divide-white/5 rounded-lg border border-white/5 overflow-hidden">
                {items.map((w, i) => {
                  const m = w.match;
                  if (!m) return null;
                  return (
                    <Link
                      key={`${m.id}-${i}`}
                      href={`/matches/${m.id}`}
                      className="flex items-center justify-between py-3 px-4 hover:bg-white/[0.03] transition-colors duration-150 group"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-sans text-sm text-text-primary group-hover:text-primary transition-colors block truncate">
                          {m.player1?.name?.split(" ").pop()} vs {m.player2?.name?.split(" ").pop()}
                        </span>
                        <span className="font-mono text-xs text-text-dim">
                          {m.tournament}{m.round ? ` · ${m.round}` : ""}{m.match_date ? ` · ${m.match_date.slice(0, 4)}` : ""}
                        </span>
                      </div>
                      {m.surface && (
                        <span
                          className="font-mono text-xs shrink-0 ml-4"
                          style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}
                        >
                          {m.surface}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "followers":
    case "following": {
      const col = tab === "followers" ? "follower_id" : "following_id";
      const ref = tab === "followers" ? "follower_id" : "following_id";
      const joinCol = tab === "followers" ? "follower:follower_id" : "following:following_id";

      const { data } = await admin
        .from("follows")
        .select(`
          created_at,
          ${joinCol} ( id, username, display_name )
        `)
        .eq(tab === "followers" ? "following_id" : "follower_id", profile.id)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as FollowRow[];
      const personKey = tab === "followers" ? "follower" : "following";

      if (rows.length === 0) {
        return <Empty message={tab === "followers" ? "No followers yet." : "Not following anyone yet."} />;
      }

      return (
        <div className="divide-y divide-white/5">
          {rows.map((row, i) => {
            const person = (row as unknown as Record<string, unknown>)[personKey] as { id: string; username: string; display_name: string | null } | null;
            if (!person) return null;
            const name     = person.display_name ?? person.username;
            const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <Link
                key={i}
                href={`/profile/${person.username}`}
                className="flex items-center gap-3 py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0"
                  style={{ background: "rgba(34,214,138,0.12)", color: "#22d68a" }}
                >
                  {initials}
                </div>
                <div>
                  <div className="font-sans text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                    {name}
                  </div>
                  <div className="font-mono text-xs text-text-dim">@{person.username}</div>
                </div>
              </Link>
            );
          })}
        </div>
      );
    }

    default:
      notFound();
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-12 text-center">
      <p className="font-sans text-text-dim text-sm">{message}</p>
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewRow {
  id: string;
  match_rating: number;
  player1_rating: number;
  player2_rating: number;
  comment: string | null;
  is_favorited: boolean;
  created_at: string;
  match: {
    id: string;
    tournament: string;
    round: string | null;
    surface: string | null;
    match_date: string | null;
    winner_id: string | null;
    player1: { id: string; name: string } | null;
    player2: { id: string; name: string } | null;
  } | null;
}

interface RatingRow {
  player_id: string;
  created_at: string;
  player: { id: string; name: string; country: string | null; current_rank: number | null } | null;
  [key: string]: unknown;
}

interface WatchRow {
  collection_name: string | null;
  created_at: string;
  match: {
    id: string;
    tournament: string;
    round: string | null;
    surface: string | null;
    match_date: string | null;
    player1: { id: string; name: string } | null;
    player2: { id: string; name: string } | null;
  } | null;
}

interface FollowRow {
  created_at: string;
}
