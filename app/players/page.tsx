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

  // The Field opens on the top of the game, not the full catalogue. Default
  // to the top 30 by rank; "all" is the explicit opt-out for the long tail.
  const effRankMax = rankMax ?? "30";

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
  const dim  = { color: "rgba(236,229,216,0.45)" };
  const stat = (value: React.ReactNode, label: string, color?: string) => (
    <span className="font-mono" style={{ fontSize: 13, letterSpacing: "0.06em", color: color ?? "#ece5d8" }}>
      {value}{" "}
      <span className="uppercase" style={{ fontSize: 9, letterSpacing: "0.15em", ...dim }}>{label}</span>
    </span>
  );

  // Decide what to show on the right side based on active sort
  function statDisplay(): React.ReactNode {
    if (!stats) {
      if (activeSort === "age" && player.age) return stat(player.age, "yrs");
      if (activeSort === "country" && player.country) return stat(player.country, "");
      return player.current_rank
        ? <span className="font-mono" style={{ fontSize: 13, ...dim }}>No. {player.current_rank}</span>
        : null;
    }

    if (activeSort === "matches") return stat(stats.totalMatches, "matches");
    if (activeSort === "hard") {
      const pct = winPct(stats.hardWins, stats.hardTotal);
      return pct !== null ? stat(`${pct}%`, `hard (${stats.hardTotal})`, "#4a90d9") : stat("—", "hard");
    }
    if (activeSort === "clay") {
      const pct = winPct(stats.clayWins, stats.clayTotal);
      return pct !== null ? stat(`${pct}%`, `clay (${stats.clayTotal})`, "#d4734e") : stat("—", "clay");
    }
    if (activeSort === "grass") {
      const pct = winPct(stats.grassWins, stats.grassTotal);
      return pct !== null ? stat(`${pct}%`, `grass (${stats.grassTotal})`, "#5cb85c") : stat("—", "grass");
    }
    if (activeSort === "streak") return stat(`${stats.streak}W`, "streak", "#22d68a");

    // Default: rank
    return player.current_rank
      ? <span className="font-mono" style={{ fontSize: 13, ...dim }}>No. {player.current_rank}</span>
      : null;
  }

  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center justify-between gap-4 py-2.5 px-1 transition-colors duration-150"
      style={{ borderBottom: "1px solid var(--hairline-soft)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Position number */}
        <span className="font-mono w-6 text-right shrink-0" style={{ fontSize: 11, color: "rgba(236,229,216,0.35)" }}>
          {rank}
        </span>

        {/* Player photo */}
        <div
          className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
          style={{ border: "1px solid rgba(236,229,216,0.18)", background: "rgba(236,229,216,0.04)" }}
        >
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
            <span className="bill-name" style={{ fontSize: 13, color: "rgba(236,229,216,0.45)" }}>
              {player.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Name + country */}
        <span className="bill-name truncate" style={{ fontSize: 16, color: "#ece5d8" }}>
          {player.name}
        </span>
        {player.country && (
          <span className="flex items-center gap-1.5 shrink-0">
            <CountryFlag code={player.country} size={20} />
            <span className="font-mono hidden sm:inline" style={{ fontSize: 10, color: "rgba(236,229,216,0.35)", letterSpacing: "0.1em" }}>
              {player.country}
            </span>
          </span>
        )}
      </div>

      {/* Stat display */}
      <div className="shrink-0">{statDisplay()}</div>
    </Link>
  );
}
