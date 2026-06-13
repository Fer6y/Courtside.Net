import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { Player } from "@/types";
import Link from "next/link";
import PlayerFilterBar from "@/components/PlayerFilterBar";
import PlayerCard from "@/components/PlayerCard";
import { SKILL_KEYS, topSkills } from "@/lib/skillMeta";

export const metadata = {
  title: "Players — Courtside",
};

type SearchParams = Promise<{
  tour?:    string;
  sort?:    string;
  country?: string;
  rankMax?: string;
}>;

const SORT_OPTIONS = [
  { label: "Rank",        value: "rank" },
  { label: "Name",        value: "name" },
  { label: "Age",         value: "age" },
  { label: "Country",     value: "country" },
  { label: "Matches",     value: "matches" },
  { label: "Hard %",      value: "hard" },
  { label: "Clay %",      value: "clay" },
  { label: "Grass %",     value: "grass" },
  { label: "Win Streak",  value: "streak" },
];

const STAT_SORTS = new Set(["matches", "hard", "clay", "grass", "streak"]);

interface MatchRow {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  surface: string | null;
  match_date: string | null;
}

interface PlayerStats {
  totalMatches: number;
  hardWins: number;  hardTotal: number;
  clayWins: number;  clayTotal: number;
  grassWins: number; grassTotal: number;
  streak: number;
}

function computeStats(playerId: string, matches: MatchRow[]): PlayerStats {
  const stats: PlayerStats = {
    totalMatches: 0,
    hardWins: 0, hardTotal: 0,
    clayWins: 0, clayTotal: 0,
    grassWins: 0, grassTotal: 0,
    streak: 0,
  };

  const mine = matches.filter(
    (m) => m.player1_id === playerId || m.player2_id === playerId
  );
  stats.totalMatches = mine.length;

  for (const m of mine) {
    const won = m.winner_id === playerId;
    const s = m.surface?.toLowerCase();
    if (s === "hard")  { stats.hardTotal++;  if (won) stats.hardWins++;  }
    if (s === "clay")  { stats.clayTotal++;  if (won) stats.clayWins++;  }
    if (s === "grass") { stats.grassTotal++; if (won) stats.grassWins++; }
  }

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

function winPct(wins: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((wins / total) * 100);
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
        .select("id, player1_id, player2_id, winner_id, surface, match_date")
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
  const { tour, sort, country, rankMax } = await searchParams;

  const activeTour = tour === "WTA" ? "WTA" : "ATP";
  const activeSort = sort ?? "rank";

  // The Field opens on the top of the game, not the full catalogue. Default
  // to the top 30 by rank; "all" is the explicit opt-out for the long tail.
  const effRankMax = rankMax ?? "30";

  const supabase = getSupabase();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Fetch distinct countries for filter dropdown ───────────────
  const { data: countryRows } = await supabase
    .from("players")
    .select("country")
    .filter("career_stats->>tour", "eq", activeTour)
    .not("api_player_key", "is", null)
    .not("country", "is", null)
    .order("country");
  const countries = [...new Set((countryRows ?? []).map((r) => r.country).filter(Boolean))].sort() as string[];

  // ── Fetch players ─────────────────────────────────────────────
  let query = supabase
    .from("players")
    .select("id, name, country, age, current_rank, career_stats, photo_url")
    .filter("career_stats->>tour", "eq", activeTour)
    .not("api_player_key", "is", null);

  // Filter by country
  if (country) query = query.eq("country", country);

  // Filter by rank range — default top 30, unless "all" opts out of the cut
  if (effRankMax !== "all") {
    query = query.lte("current_rank", Number(effRankMax)).not("current_rank", "is", null);
  }

  // Only DB-sort for non-stat sorts
  if (!STAT_SORTS.has(activeSort)) {
    if (activeSort === "rank") {
      query = query.order("current_rank", { ascending: true, nullsFirst: false });
    } else if (activeSort === "name") {
      query = query.order("name", { ascending: true });
    } else if (activeSort === "age") {
      query = query.order("age", { ascending: true, nullsFirst: false });
    } else if (activeSort === "country") {
      query = query.order("country", { ascending: true, nullsFirst: false });
    }
  }

  const { data: rawPlayers, error } = await query;
  const players = (rawPlayers ?? []) as Player[];

  // ── Compute surface stats for every card ──────────────────────
  // Cards always show form (best-surface win%, match count), so we compute
  // for all displayed players — not just when sorting by a stat. The tour's
  // match rows are cached hourly.
  const statsMap = new Map<string, PlayerStats>();
  const matchRows = players.length > 0 ? await getTourMatchRows(activeTour) : [];
  for (const p of players) {
    statsMap.set(p.id, computeStats(p.id, matchRows));
  }

  // ── Sort by stat if needed ────────────────────────────────────
  const sorted = [...players];

  if (activeSort === "matches") {
    sorted.sort(
      (a, b) => (statsMap.get(b.id)?.totalMatches ?? 0) - (statsMap.get(a.id)?.totalMatches ?? 0)
    );
  } else if (activeSort === "hard") {
    sorted.sort((a, b) => {
      const sa = statsMap.get(a.id)!;
      const sb = statsMap.get(b.id)!;
      return (winPct(sb.hardWins, sb.hardTotal) ?? -1) - (winPct(sa.hardWins, sa.hardTotal) ?? -1);
    });
  } else if (activeSort === "clay") {
    sorted.sort((a, b) => {
      const sa = statsMap.get(a.id)!;
      const sb = statsMap.get(b.id)!;
      return (winPct(sb.clayWins, sb.clayTotal) ?? -1) - (winPct(sa.clayWins, sa.clayTotal) ?? -1);
    });
  } else if (activeSort === "grass") {
    sorted.sort((a, b) => {
      const sa = statsMap.get(a.id)!;
      const sb = statsMap.get(b.id)!;
      return (winPct(sb.grassWins, sb.grassTotal) ?? -1) - (winPct(sa.grassWins, sa.grassTotal) ?? -1);
    });
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

  // Build URL preserving current filter state
  function buildUrl(params: { tour?: string; sort?: string }) {
    const merged = { tour: activeTour, sort: activeSort, ...params };
    const qs = new URLSearchParams();
    if (merged.tour) qs.set("tour", merged.tour);
    if (merged.sort && merged.sort !== "rank") qs.set("sort", merged.sort);
    // Preserve active filters when changing tour/sort. Bare URL = Top 30,
    // so only carry rankMax when it differs from the default.
    if (country) qs.set("country", country);
    if (effRankMax !== "30") qs.set("rankMax", effRankMax);
    return `/players${qs.toString() ? `?${qs}` : ""}`;
  }

  // Extra params passed to PlayerFilterBar so it preserves tour + sort when filtering
  const extraParams: Record<string, string> = {};
  if (activeTour !== "ATP") extraParams.tour = activeTour;
  if (activeSort !== "rank") extraParams.sort = activeSort;

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
        <span className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.35)" }}>
          Sort —
        </span>
        {SORT_OPTIONS.map(({ label, value }) => (
          <Link
            key={value}
            href={buildUrl({ sort: value })}
            className="eyebrow transition-colors duration-150"
            style={{
              fontSize: 10,
              color: activeSort === value ? "#c9a96a" : "rgba(236,229,216,0.45)",
              borderBottom: activeSort === value ? "1px solid rgba(201,169,106,0.6)" : "1px solid transparent",
              paddingBottom: 2,
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Filter chips — country + rank */}
      <div className="mb-6">
        <PlayerFilterBar
          filters={{ country, rankMax: effRankMax }}
          countries={countries}
          basePath="/players"
          extraParams={extraParams}
        />
      </div>

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
