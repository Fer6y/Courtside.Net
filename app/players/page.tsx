import { getSupabase } from "@/lib/supabase";
import type { Player } from "@/types";
import Link from "next/link";

export const metadata = {
  title: "Players — Courtside",
};

type SearchParams = Promise<{
  tour?: string;
  sort?: string;
}>;

const SORT_OPTIONS = [
  { label: "Rank",    value: "rank" },
  { label: "Name",    value: "name" },
  { label: "Age",     value: "age" },
  { label: "Country", value: "country" },
];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tour, sort } = await searchParams;

  // Defaults
  const activeTour = tour === "WTA" ? "WTA" : "ATP";
  const activeSort = sort ?? "rank";

  const supabase = getSupabase();

  // Build query with server-side tour filter
  let query = supabase
    .from("players")
    .select("id, name, country, age, current_rank, career_stats");

  // Filter by tour stored in career_stats JSONB column
  query = query.filter("career_stats->>tour", "eq", activeTour);

  // Sort
  if (activeSort === "rank") {
    query = query.order("current_rank", { ascending: true, nullsFirst: false });
  } else if (activeSort === "name") {
    query = query.order("name", { ascending: true });
  } else if (activeSort === "age") {
    query = query.order("age", { ascending: true, nullsFirst: false });
  } else if (activeSort === "country") {
    query = query.order("country", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("current_rank", { ascending: true, nullsFirst: false });
  }

  const { data: players, error } = await query;

  function buildUrl(params: { tour?: string; sort?: string }) {
    const merged = { tour: activeTour, sort: activeSort, ...params };
    const qs = new URLSearchParams();
    if (merged.tour) qs.set("tour", merged.tour);
    if (merged.sort && merged.sort !== "rank") qs.set("sort", merged.sort);
    const str = qs.toString();
    return `/players${str ? `?${str}` : ""}`;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="font-mono text-3xl font-bold text-text-primary mb-2">
        Players
      </h1>
      <p className="font-sans text-text-mid mb-8">
        Grand Slam players 2020–2024
      </p>

      {/* Tour selector */}
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
                ? "border-primary/50 text-primary"
                : "border-white/10 text-text-dim hover:text-text-primary"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="text-loss font-sans text-sm">Failed to load players.</p>
      ) : (
        <>
          <p className="font-mono text-sm text-text-dim mb-4">
            {players?.length ?? 0} players
          </p>

          <div className="divide-y divide-white/5">
            {(players as Player[]).map((player) => (
              <PlayerRow key={player.id} player={player} showRank={activeSort === "rank" || !activeSort} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function PlayerRow({ player, showRank }: { player: Player; showRank: boolean }) {
  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
    >
      <div className="flex items-center gap-4">
        {/* Rank */}
        <span className="font-mono text-sm text-text-dim w-8 text-right shrink-0">
          {showRank && player.current_rank ? `#${player.current_rank}` : "—"}
        </span>

        {/* Name + country */}
        <div>
          <span className="font-sans text-text-primary group-hover:text-primary transition-colors duration-150">
            {player.name}
          </span>
          {player.country && (
            <span className="font-mono text-xs text-text-dim ml-2">
              {player.country}
            </span>
          )}
        </div>
      </div>

      {/* Age */}
      {player.age && (
        <span className="font-mono text-sm text-text-dim">
          Age {player.age}
        </span>
      )}
    </Link>
  );
}
