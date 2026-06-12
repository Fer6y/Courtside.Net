import { getSupabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { Player } from "@/types";
import Link from "next/link";
import Image from "next/image";
import PlayerFilterBar from "@/components/PlayerFilterBar";
import CountryFlag from "@/components/CountryFlag";

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
        .select("player1_id, player2_id, winner_id, surface, match_date")
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

  const supabase = getSupabase();

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

  // Filter by rank range
  if (rankMax) query = query.lte("current_rank", Number(rankMax)).not("current_rank", "is", null);

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

  // ── Compute stats if needed ───────────────────────────────────
  const statsMap = new Map<string, PlayerStats>();

  if (STAT_SORTS.has(activeSort) && players.length > 0) {
    const matchRows = await getTourMatchRows(activeTour);

    for (const p of players) {
      statsMap.set(p.id, computeStats(p.id, matchRows));
    }
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

  // Build URL preserving current filter state
  function buildUrl(params: { tour?: string; sort?: string }) {
    const merged = { tour: activeTour, sort: activeSort, ...params };
    const qs = new URLSearchParams();
    if (merged.tour) qs.set("tour", merged.tour);
    if (merged.sort && merged.sort !== "rank") qs.set("sort", merged.sort);
    // Preserve active filters when changing tour/sort
    if (country) qs.set("country", country);
    if (rankMax) qs.set("rankMax", rankMax);
    return `/players${qs.toString() ? `?${qs}` : ""}`;
  }

  // Extra params passed to PlayerFilterBar so it preserves tour + sort when filtering
  const extraParams: Record<string, string> = {};
  if (activeTour !== "ATP") extraParams.tour = activeTour;
  if (activeSort !== "rank") extraParams.sort = activeSort;

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="font-mono text-3xl font-bold text-text-primary mb-2">
        Players
      </h1>
      <p className="font-sans text-text-mid mb-8">
        Grand Slam &amp; Masters 1000 · 2020–2024
      </p>

      {/* Tour tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(["ATP", "WTA"] as const).map((t) => (
          <Link
            key={t}
            href={buildUrl({ tour: t })}
            className={`font-mono text-sm font-semibold px-5 py-2 rounded-full border transition-colors duration-150 ${
              activeTour === t
                ? "border-primary text-primary bg-primary/10"
                : "border-white/10 text-text-dim hover:text-text-primary hover:border-white/20"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {/* Sort options */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <span className="font-sans text-xs text-text-dim mr-1">Sort by</span>
        {SORT_OPTIONS.map(({ label, value }) => (
          <Link
            key={value}
            href={buildUrl({ sort: value })}
            className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
              activeSort === value
                ? "border-primary/50 text-primary bg-primary/5"
                : "border-white/10 text-text-dim hover:text-text-primary"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Filter chips — country + rank */}
      <div className="mb-6">
        <PlayerFilterBar
          filters={{ country, rankMax }}
          countries={countries}
          basePath="/players"
          extraParams={extraParams}
        />
      </div>

      {error ? (
        <p className="text-loss font-sans text-sm">Failed to load players.</p>
      ) : (
        <>
          <p className="font-mono text-sm text-text-dim mb-4">
            {sorted.length} players
          </p>

          {sorted.length === 0 ? (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-12 text-center">
              <p className="font-sans text-text-dim text-sm">No players found.</p>
            </div>
          ) : (
          <div className="divide-y divide-white/5">
            {sorted.map((player, i) => (
              <PlayerRow
                key={player.id}
                player={player}
                rank={i + 1}
                activeSort={activeSort}
                stats={statsMap.get(player.id) ?? null}
              />
            ))}
          </div>
          )}
        </>
      )}
    </main>
  );
}

function PlayerRow({
  player,
  rank,
  activeSort,
  stats,
}: {
  player: Player;
  rank: number;
  activeSort: string;
  stats: PlayerStats | null;
}) {
  // Decide what to show on the right side based on active sort
  function statDisplay(): React.ReactNode {
    if (!stats) {
      if (activeSort === "age" && player.age)
        return <span className="font-mono text-sm text-text-dim">Age {player.age}</span>;
      if (activeSort === "country" && player.country)
        return <span className="font-mono text-sm text-text-dim">{player.country}</span>;
      return player.current_rank
        ? <span className="font-mono text-sm text-text-dim">#{player.current_rank}</span>
        : null;
    }

    if (activeSort === "matches") {
      return (
        <span className="font-mono text-sm text-text-mid">
          {stats.totalMatches} <span className="text-text-dim text-xs">matches</span>
        </span>
      );
    }
    if (activeSort === "hard") {
      const pct = winPct(stats.hardWins, stats.hardTotal);
      return pct !== null
        ? <span className="font-mono text-sm text-court-hard">{pct}% <span className="text-text-dim text-xs">hard ({stats.hardTotal})</span></span>
        : <span className="font-mono text-sm text-text-dim">— hard</span>;
    }
    if (activeSort === "clay") {
      const pct = winPct(stats.clayWins, stats.clayTotal);
      return pct !== null
        ? <span className="font-mono text-sm text-court-clay">{pct}% <span className="text-text-dim text-xs">clay ({stats.clayTotal})</span></span>
        : <span className="font-mono text-sm text-text-dim">— clay</span>;
    }
    if (activeSort === "grass") {
      const pct = winPct(stats.grassWins, stats.grassTotal);
      return pct !== null
        ? <span className="font-mono text-sm text-court-grass">{pct}% <span className="text-text-dim text-xs">grass ({stats.grassTotal})</span></span>
        : <span className="font-mono text-sm text-text-dim">— grass</span>;
    }
    if (activeSort === "streak") {
      return (
        <span className="font-mono text-sm text-primary">
          {stats.streak}W <span className="text-text-dim text-xs">streak</span>
        </span>
      );
    }
    // Default: rank
    return player.current_rank
      ? <span className="font-mono text-sm text-text-dim">#{player.current_rank}</span>
      : null;
  }

  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
    >
      <div className="flex items-center gap-3">
        {/* Position number */}
        <span className="font-mono text-sm text-text-dim w-6 text-right shrink-0">
          {rank}
        </span>

        {/* Player photo */}
        <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
          {player.photo_url ? (
            <Image
              src={player.photo_url}
              alt={player.name}
              width={36}
              height={36}
              className="w-full h-full object-cover object-top"
              unoptimized
            />
          ) : (
            <span className="font-mono text-xs text-text-dim">
              {player.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Name + country */}
        <div className="flex items-center gap-2">
          <span className="font-sans text-text-primary group-hover:text-primary transition-colors duration-150">
            {player.name}
          </span>
          {player.country && (
            <span className="flex items-center gap-1.5">
              <CountryFlag code={player.country} size={20} />
              <span className="font-mono text-xs text-text-dim">
                {player.country}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Stat display */}
      <div>{statDisplay()}</div>
    </Link>
  );
}
