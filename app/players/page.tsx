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

// Sorts computed in JS rather than the DB. "form" (last-10 wins) and "recent"
// (most-recent title) are the implicit default orders for the Hot Streaks and
// Recent Winners lenses — they have no chip in the sort bar.
const STAT_SORTS = new Set(["matches", "streak", "form", "recent"]);

// The default ordering each lens opens in when the user hasn't picked a sort.
function viewDefaultOrder(view: string): string {
  if (view === "hot") return "form";
  if (view === "winners") return "recent";
  return "rank";
}

// The three lenses on the field. "top30" opens by default; the other two are
// computed from match results (see hot-streak / recent-winner helpers below).
const VIEW_OPTIONS = [
  { label: "Top 30",         value: "top30",   note: "By current rank" },
  { label: "Hot Streaks",    value: "hot",     note: "90%+ win rate in last 10 matches" },
  { label: "Recent Winners", value: "winners", note: "Tournament winners of the last year" },
];
const DEFAULT_VIEW = "top30";

// Only the fields the form maths reads. Every extra column here is paid for
// ~7,200 times over on the ATP side, which is what pushed the cached value
// past Next's 2MB entry limit (see getTourMatchRows).
interface MatchRow {
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  match_date: string | null;
}

// Recent Winners needs the tournament identity, but only for finals inside the
// last year — a few dozen rows. Kept off MatchRow so the name and season don't
// ride along on every match in the tour.
interface FinalRow {
  winner_id: string | null;
  match_date: string | null;
  tournament: string | null;
  tournament_season: number | null;
}

// What a card highlights under the active lens: a recent-form record (Hot
// Streaks) or the title just won (Recent Winners). Null on the default view.
export interface FormNote {
  text: string;
  color: string;
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

// A player's win–loss record across their last 10 matches.
function lastTenRecord(playerId: string, matches: MatchRow[]): { wins: number; losses: number } {
  const recent = playerMatches(playerId, matches).slice(0, 10);
  const wins = recent.filter((m) => m.winner_id === playerId).length;
  return { wins, losses: recent.length - wins };
}

// Hot streak: 90%+ win rate across the player's last 10 matches. Requires a
// full sample of 10 so the rate is meaningful (≥9 of the last 10 won).
function isHotStreak(playerId: string, matches: MatchRow[]): boolean {
  const { wins, losses } = lastTenRecord(playerId, matches);
  if (wins + losses < 10) return false;
  return wins / (wins + losses) >= 0.9;
}

interface RecentTitle {
  tournament: string;
  season: number | null;
  date: string;
}

// Most recent tournament final each player won within the last 365 days,
// keyed by winner id. Drives both the Recent Winners filter and its chip.
// The round and date window are applied by the query now (getRecentFinals),
// so this just picks the freshest title per winner.
function recentTitles(finals: FinalRow[]): Map<string, RecentTitle> {
  const titles = new Map<string, RecentTitle>();
  for (const m of finals) {
    if (!m.winner_id) continue;
    const date = m.match_date ?? "";
    const cur = titles.get(m.winner_id);
    if (!cur || date > cur.date) {
      titles.set(m.winner_id, { tournament: m.tournament ?? "Title", season: m.tournament_season, date });
    }
  }
  return titles;
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
        .select("player1_id, player2_id, winner_id, match_date")
        .eq("tour", tour)
        .range(from, to)
    );
  },
  ["players-stat-matches"],
  { revalidate: 3600 }
);

// Finals from the last year — everything Recent Winners needs, and nothing
// else. Splitting these out (rather than carrying round/tournament/season on
// all ~7,200 ATP rows above) is what keeps the cached payload under the 2MB
// entry limit; over it, Next silently fails the cache write every request.
const getRecentFinals = unstable_cache(
  async (tour: string) => {
    const db = getSupabase();
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    return fetchAllRows<FinalRow>((from, to) =>
      db.from("matches")
        .select("winner_id, match_date, tournament, tournament_season")
        .eq("tour", tour)
        .eq("round", "Final")
        .gte("match_date", cutoff.toISOString().slice(0, 10))
        .range(from, to)
    );
  },
  ["players-recent-finals"],
  { revalidate: 3600 }
);

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tour, sort, view } = await searchParams;

  const activeTour = tour === "WTA" ? "WTA" : "ATP";

  // The Field opens on the top of the game. "top30" is the default lens;
  // "hot" and "winners" are computed from match results across all ranks.
  const activeView = VIEW_OPTIONS.some((v) => v.value === view) ? view! : DEFAULT_VIEW;

  // An explicit ?sort wins; otherwise each lens opens in its natural order
  // (Top 30 → rank, Hot Streaks → form, Recent Winners → most recent title).
  const sortExplicit = sort !== undefined;
  const activeSort = sort ?? viewDefaultOrder(activeView);

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
  const titleMap =
    activeView === "winners" ? recentTitles(await getRecentFinals(activeTour)) : null;
  let players = allPlayers;
  if (activeView === "hot") {
    players = allPlayers.filter((p) => isHotStreak(p.id, matchRows));
  } else if (titleMap) {
    players = allPlayers.filter((p) => titleMap.has(p.id));
  }

  // ── Compute form stats for every displayed card ───────────────
  const statsMap = new Map<string, PlayerStats>();
  for (const p of players) {
    statsMap.set(p.id, computeStats(p.id, matchRows));
  }

  // ── Per-card context chip + the data the lens sorts on ────────
  // Hot Streaks shows each player's last-10 record; Recent Winners shows the
  // title just won. Cached here so the chip and the sort agree.
  const recordMap = new Map<string, { wins: number; losses: number }>();
  const formNoteMap = new Map<string, FormNote>();
  if (activeView === "hot") {
    for (const p of players) {
      const rec = lastTenRecord(p.id, matchRows);
      recordMap.set(p.id, rec);
      formNoteMap.set(p.id, { text: `${rec.wins}–${rec.losses} · last 10`, color: "#22d68a" });
    }
  } else if (titleMap) {
    for (const p of players) {
      const t = titleMap.get(p.id);
      if (!t) continue;
      // Tournament names already carry the year (e.g. "Australian Open 2026");
      // only append the season when it isn't already in the name.
      const hasYear = t.season != null && t.tournament.includes(String(t.season));
      const label = !hasYear && t.season != null ? `${t.tournament} ${t.season}` : t.tournament;
      formNoteMap.set(p.id, { text: `✦ ${label}`, color: "#c9a96a" });
    }
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
  } else if (activeSort === "form") {
    // Hottest first: most wins in the last 10, then current win streak.
    sorted.sort((a, b) => {
      const ra = recordMap.get(a.id), rb = recordMap.get(b.id);
      return (rb?.wins ?? 0) - (ra?.wins ?? 0)
        || (statsMap.get(b.id)?.streak ?? 0) - (statsMap.get(a.id)?.streak ?? 0);
    });
  } else if (activeSort === "recent" && titleMap) {
    // Freshest title first.
    sorted.sort((a, b) =>
      (titleMap.get(b.id)?.date ?? "").localeCompare(titleMap.get(a.id)?.date ?? "")
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
  // no giant IN list. The two player ids come from an embedded match relation
  // — previously this built a match→players map over every row of the tour,
  // which is the only reason those rows had to carry `id` at all.
  const reviewMap = new Map<string, string>();
  {
    const { data: reviewRows } = await admin
      .from("reviews")
      .select("comment, created_at, match:match_id ( player1_id, player2_id )")
      .not("comment", "is", null)
      .order("created_at", { ascending: false });
    for (const r of reviewRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = r.match as any;
      if (!m?.player1_id || !m?.player2_id) continue;
      const text = (r.comment as string | null)?.trim();
      if (!text) continue;
      for (const pid of [m.player1_id as string, m.player2_id as string]) {
        if (!reviewMap.has(pid)) reviewMap.set(pid, text);
      }
    }
  }

  // Build URL preserving current tour / sort / view state.
  function buildUrl(params: { tour?: string; sort?: string; view?: string }) {
    const targetTour = params.tour ?? activeTour;
    const targetView = params.view ?? activeView;
    const switchingView = params.view !== undefined && params.view !== activeView;

    // Resolve the sort: an explicit click wins; switching lens drops the old
    // sort so the new lens opens in its own natural order; otherwise we carry
    // the user's chosen sort (but not a defaulted one).
    let targetSort: string | undefined;
    if (params.sort !== undefined) targetSort = params.sort;
    else if (sortExplicit && !switchingView) targetSort = activeSort;

    const qs = new URLSearchParams();
    if (targetTour) qs.set("tour", targetTour);
    // Only carry sort when it differs from the lens's natural order.
    if (targetSort && targetSort !== viewDefaultOrder(targetView)) qs.set("sort", targetSort);
    // Bare URL = Top 30, so only carry view when it differs from the default.
    if (targetView !== DEFAULT_VIEW) qs.set("view", targetView);
    return `/players${qs.toString() ? `?${qs}` : ""}`;
  }

  const activeViewNote = VIEW_OPTIONS.find((v) => v.value === activeView)?.note;

  return (
    <main className="w-full max-w-5xl mx-auto px-4 py-12">

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
                formNote={formNoteMap.get(player.id) ?? null}
              />
            ))}
          </div>
          )}
        </>
      )}
    </main>
  );
}
