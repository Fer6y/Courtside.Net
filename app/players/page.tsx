import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { Player } from "@/types";
import Link from "next/link";
import PlayerCard from "@/components/PlayerCard";
import { SKILL_KEYS, topSkills } from "@/lib/skillMeta";

export const metadata = {
  title: "Players — Courtside",
};

type SearchParams = Promise<{
  tour?: string;
  sort?: string;
  view?: string;
}>;

const SORT_OPTIONS = [
  { label: "Rank",        value: "rank" },
  { label: "Name",        value: "name" },
  { label: "Age",         value: "age" },
  { label: "Matches",     value: "matches" },
  { label: "Win Streak",  value: "streak" },
];

const STAT_SORTS = new Set(["matches", "streak"]);

// The three lenses on the field. "top30" opens by default; the other two are
// computed from match results (see hot-streak / recent-winner helpers below).
const VIEW_OPTIONS = [
  { label: "Top 30",         value: "top30",   note: "By current rank" },
  { label: "Hot Streaks",    value: "hot",     note: "90%+ win rate in last 10 matches" },
  { label: "Recent Winners", value: "winners", note: "Tournament winners of the last year" },
];
const DEFAULT_VIEW = "top30";

interface MatchRow {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  match_date: string | null;
  round: string | null;
}

interface PlayerStats {
  totalMatches: number;
  streak: number;
}

function computeStats(playerId: string, matches: MatchRow[]): PlayerStats {
  const stats: PlayerStats = {
    totalMatches: 0,
    streak: 0,
  };

  const mine = matches.filter(
    (m) => m.player1_id === playerId || m.player2_id === playerId
  );
  stats.totalMatches = mine.length;

  // Current streak: scan from most recent backwards
  const sorted = [...mine].sort(
    (a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? "")
  );
  for (const m of sorted) {
    if (m.winner_id === playerId) stats.streak++;
    else break;
  }

  return stats;
}

// A player's matches, most-recent first.
function playerMatches(playerId: string, matches: MatchRow[]): MatchRow[] {
  return matches
    .filter((m) => m.player1_id === playerId || m.player2_id === playerId)
    .sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""));
}

// Hot streak: 90%+ win rate across the player's last 10 matches. Requires a
// full sample of 10 so the rate is meaningful (≥9 of the last 10 won).
function isHotStreak(playerId: string, matches: MatchRow[]): boolean {
  const recent = playerMatches(playerId, matches).slice(0, 10);
  if (recent.length < 10) return false;
  const wins = recent.filter((m) => m.winner_id === playerId).length;
  return wins / recent.length >= 0.9;
}

// Recent winners: anyone who won a tournament final within the last 365 days.
function recentWinnerSet(matches: MatchRow[]): Set<string> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const winners = new Set<string>();
  for (const m of matches) {
    if (
      m.round === "Final" &&
      m.winner_id &&
      (m.match_date ?? "") >= cutoffStr
    ) {
      winners.add(m.winner_id);
    }
  }
  return winners;
}

// All match rows for a tour, cached hourly (match results only change on
// import). The previous version built one query containing every player ID
// (~56,000 characters) which the database rejected outright — and even if
// it hadn't, the unbounded select would have been silently capped at 1,000
// of ~9,000 rows, computing wrong stats.
const getTourMatchRows = unstable_cache(
  async (tour: string) => {
    const db = getSupabase();
    return fetchAllRows<MatchRow>((from, to) =>
      db.from("matches")
        .select("id, player1_id, player2_id, winner_id, match_date, round")
        .eq("tour", tour)
        .range(from, to)
    );
  },
  ["players-stat-matches"],
  { revalidate: 3600 }
);

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tour, sort, view } = await searchParams;

  const activeTour = tour === "WTA" ? "WTA" : "ATP";
  const activeSort = sort ?? "rank";

  // The Field opens on the top of the game. "top30" is the default lens;
  // "hot" and "winners" are computed from match results across all ranks.
  const activeView = VIEW_OPTIONS.some((v) => v.value === view) ? view! : DEFAULT_VIEW;

  const supabase = getSupabase();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Fetch players ─────────────────────────────────────────────
  let query = supabase
    .from("players")
    .select("id, name, country, age, current_rank, career_stats, photo_url")
    .filter("career_stats->>tour", "eq", activeTour)
    .not("api_player_key", "is", null);

  // Top 30 is a clean DB cut by rank. Hot Streaks / Recent Winners span all
  // ranks and are decided from match results, so they fetch the full tour and
  // filter in JS below.
  if (activeView === "top30") {
    query = query.lte("current_rank", 30).not("current_rank", "is", null);
  }

  // Only DB-sort for non-stat sorts
  if (!STAT_SORTS.has(activeSort)) {
    if (activeSort === "rank") {
      query = query.order("current_rank", { ascending: true, nullsFirst: false });
    } else if (activeSort === "name") {
      query = query.order("name", { ascending: true });
    } else if (activeSort === "age") {
      query = query.order("age", { ascending: true, nullsFirst: false });
    }
  }

  const { data: rawPlayers, error } = await query;
  const allPlayers = (rawPlayers ?? []) as Player[];

  // Match rows for the tour (cached hourly) power both the form stats on every
  // card and the Hot Streaks / Recent Winners lenses.
  const matchRows = allPlayers.length > 0 ? await getTourMatchRows(activeTour) : [];

  // ── Apply the computed lenses ─────────────────────────────────
  let players = allPlayers;
  if (activeView === "hot") {
    players = allPlayers.filter((p) => isHotStreak(p.id, matchRows));
  } else if (activeView === "winners") {
    const winners = recentWinnerSet(matchRows);
    players = allPlayers.filter((p) => winners.has(p.id));
  }

  // ── Compute form stats for every displayed card ───────────────
  const statsMap = new Map<string, PlayerStats>();
  for (const p of players) {
    statsMap.set(p.id, computeStats(p.id, matchRows));
  }

  // ── Sort by stat if needed ────────────────────────────────────
  const sorted = [...players];

  if (activeSort === "matches") {
    sorted.sort(
      (a, b) => (statsMap.get(b.id)?.totalMatches ?? 0) - (statsMap.get(a.id)?.totalMatches ?? 0)
    );
  } else if (activeSort === "streak") {
    sorted.sort(
      (a, b) => (statsMap.get(b.id)?.streak ?? 0) - (statsMap.get(a.id)?.streak ?? 0)
    );
  }

  // ── Community skills — aggregate per player (table is tiny) ────
  // skill_ratings holds only a handful of rows today, so we read them all
  // and average in JS rather than risk a huge player-id IN list.
  const skillsMap = new Map<string, ReturnType<typeof topSkills>>();
  {
    const { data: skillRows } = await supabase
      .from("skill_ratings")
      .select(["player_id", ...SKILL_KEYS].join(","))
      .returns<Record<string, unknown>[]>();
    const acc = new Map<string, { sums: Record<string, number>; counts: Record<string, number> }>();
    for (const row of skillRows ?? []) {
      const pid = row.player_id as string;
      if (!pid) continue;
      let a = acc.get(pid);
      if (!a) { a = { sums: {}, counts: {} }; acc.set(pid, a); }
      for (const k of SKILL_KEYS) {
        const v = Number(row[k]);
        if (!isNaN(v) && v > 0) { a.sums[k] = (a.sums[k] ?? 0) + v; a.counts[k] = (a.counts[k] ?? 0) + 1; }
      }
    }
    for (const [pid, a] of acc) {
      const avgMap: Record<string, number> = {};
      for (const k of SKILL_KEYS) if (a.counts[k]) avgMap[k] = a.sums[k] / a.counts[k];
      skillsMap.set(pid, topSkills(avgMap, 2));
    }
  }

  // ── Recent review excerpt per player ──────────────────────────
  // Walk commented reviews newest-first and attach each to its match's two
  // players. Bounded by the (small) review count, not players × matches, so
  // no giant IN list. Match → players comes from the tour rows above.
  const reviewMap = new Map<string, string>();
  {
    const matchPlayers = new Map<string, [string, string]>();
    for (const m of matchRows) matchPlayers.set(m.id, [m.player1_id, m.player2_id]);
    const { data: reviewRows } = await admin
      .from("reviews")
      .select("match_id, comment, created_at")
      .not("comment", "is", null)
      .order("created_at", { ascending: false });
    for (const r of reviewRows ?? []) {
      const pids = matchPlayers.get(r.match_id as string);
      if (!pids) continue;
      const text = (r.comment as string | null)?.trim();
      if (!text) continue;
      for (const pid of pids) if (!reviewMap.has(pid)) reviewMap.set(pid, text);
    }
  }

  // Build URL preserving current tour / sort / view state
  function buildUrl(params: { tour?: string; sort?: string; view?: string }) {
    const merged = { tour: activeTour, sort: activeSort, view: activeView, ...params };
    const qs = new URLSearchParams();
    if (merged.tour) qs.set("tour", merged.tour);
    if (merged.sort && merged.sort !== "rank") qs.set("sort", merged.sort);
    // Bare URL = Top 30, so only carry view when it differs from the default.
    if (merged.view && merged.view !== DEFAULT_VIEW) qs.set("view", merged.view);
    return `/players${qs.toString() ? `?${qs}` : ""}`;
  }

  const activeViewNote = VIEW_OPTIONS.find((v) => v.value === activeView)?.note;

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">

      {/* Masthead */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="bill-name text-3xl" style={{ fontWeight: 500 }}>The Field</h1>
        <div className="eyebrow" style={{ fontSize: 11 }}>
          {(["ATP", "WTA"] as const).map((t, i) => (
            <span key={t}>
              {i > 0 && <span style={{ color: "#c9a96a" }}> · </span>}
              <Link
                href={buildUrl({ tour: t })}
                className="transition-colors duration-150"
                style={{
                  color: activeTour === t ? "#c9a96a" : "rgba(236,229,216,0.35)",
                  borderBottom: activeTour === t ? "1px solid rgba(201,169,106,0.6)" : "none",
                  paddingBottom: 2,
                }}
              >
                {t}
              </Link>
            </span>
          ))}
        </div>
      </div>
      <p
        className="bill-name italic mb-7 mt-1"
        style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}
      >
        The top of the game — rate their skills, read their form
      </p>

      {/* Sort options */}
      <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap mb-4">
        <span className="eyebrow" style={{ fontSize: 11, color: "rgba(236,229,216,0.35)" }}>
          Sort —
        </span>
        {SORT_OPTIONS.map(({ label, value }) => (
          <Link
            key={value}
            href={buildUrl({ sort: value })}
            className="eyebrow transition-colors duration-150"
            style={{
              fontSize: 12,
              color: activeSort === value ? "#c9a96a" : "rgba(236,229,216,0.45)",
              borderBottom: activeSort === value ? "1px solid rgba(201,169,106,0.6)" : "1px solid transparent",
              paddingBottom: 4,
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Filter — Top 30 · Hot Streaks · Recent Winners */}
      <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap mb-1">
        <span className="eyebrow shrink-0" style={{ fontSize: 11, color: "rgba(236,229,216,0.35)" }}>
          Filter —
        </span>
        {VIEW_OPTIONS.map(({ label, value }) => (
          <Link
            key={value}
            href={buildUrl({ view: value })}
            className="eyebrow transition-colors duration-150"
            style={{
              fontSize: 12,
              color: activeView === value ? "#c9a96a" : "rgba(236,229,216,0.45)",
              borderBottom: activeView === value ? "1px solid rgba(201,169,106,0.6)" : "1px solid transparent",
              paddingBottom: 4,
            }}
          >
            {label}
          </Link>
        ))}
      </div>
      {activeViewNote && (
        <p
          className="bill-name italic mb-6"
          style={{ fontWeight: 300, fontSize: 12, color: "rgba(236,229,216,0.4)" }}
        >
          {activeViewNote}
        </p>
      )}

      {error ? (
        <p className="text-loss font-sans text-sm">Failed to load players.</p>
      ) : (
        <>
          {sorted.length === 0 ? (
            <div
              className="rounded-lg p-12 text-center"
              style={{ border: "1px solid var(--hairline-soft)", background: "rgba(236,229,216,0.02)" }}
            >
              <p className="bill-name italic text-sm" style={{ fontWeight: 300, color: "rgba(236,229,216,0.5)" }}>
                No players found.
              </p>
            </div>
          ) : (
          <div>
            {sorted.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                stats={statsMap.get(player.id) ?? null}
                topSkills={skillsMap.get(player.id) ?? []}
                reviewExcerpt={reviewMap.get(player.id) ?? null}
              />
            ))}
          </div>
          )}
        </>
      )}
    </main>
  );
}
