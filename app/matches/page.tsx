import { getSupabase } from "@/lib/supabase";
import type { MatchWithPlayers, Surface } from "@/types";
import Link from "next/link";

export const metadata = {
  title: "Matches — Courtside",
};

const SURFACE_COLORS: Record<Surface, string> = {
  Hard:   "text-court-hard",
  Clay:   "text-court-clay",
  Grass:  "text-court-grass",
  Carpet: "text-text-dim",
};

const TOURNAMENTS = [
  "Australian Open",
  "Roland Garros",
  "Wimbledon",
  "Us Open",
];

type SearchParams = Promise<{
  surface?: string;
  tournament?: string;
  year?: string;
}>;

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { surface, tournament, year } = await searchParams;
  const supabase = getSupabase();

  let query = supabase
    .from("matches")
    .select(`
      *,
      player1:player1_id ( id, name, country, current_rank ),
      player2:player2_id ( id, name, country, current_rank )
    `)
    .order("match_date", { ascending: false })
    .limit(100);

  if (surface)    query = query.eq("surface", surface);
  if (tournament) query = query.eq("tournament", tournament);
  if (year)       query = query.gte("match_date", `${year}-01-01`).lte("match_date", `${year}-12-31`);

  const { data: matches, error } = await query;

  if (error) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-loss">Failed to load matches.</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="font-mono text-3xl font-bold text-text-primary mb-2">
        Matches
      </h1>
      <p className="font-sans text-text-mid mb-8">
        Grand Slam matches 2020–2024 · ATP & WTA
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <FilterGroup
          label="Surface"
          param="surface"
          current={surface}
          options={["Hard", "Clay", "Grass"]}
        />
        <FilterGroup
          label="Tournament"
          param="tournament"
          current={tournament}
          options={TOURNAMENTS}
        />
        <FilterGroup
          label="Year"
          param="year"
          current={year}
          options={["2020", "2021", "2022", "2023", "2024"]}
        />
      </div>

      {/* Results count */}
      <p className="font-mono text-sm text-text-dim mb-4">
        {matches.length} matches{matches.length === 100 ? "+" : ""}
      </p>

      {/* Match list */}
      <div className="divide-y divide-white/5">
        {(matches as MatchWithPlayers[]).map((match) => (
          <MatchRow key={match.id} match={match} />
        ))}
      </div>
    </main>
  );
}

function FilterGroup({
  param,
  current,
  options,
}: {
  label: string;
  param: string;
  current?: string;
  options: string[];
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {current && (
        <Link
          href={buildFilterUrl(param, undefined, {})}
          className="font-mono text-xs px-3 py-1.5 rounded-full border border-white/10 text-text-dim hover:text-text-primary transition-colors duration-150"
        >
          Clear
        </Link>
      )}
      {options.map((opt) => (
        <Link
          key={opt}
          href={buildFilterUrl(param, opt, {})}
          className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
            current === opt
              ? "border-primary text-primary"
              : "border-white/10 text-text-dim hover:text-text-primary"
          }`}
        >
          {opt}
        </Link>
      ))}
    </div>
  );
}

function buildFilterUrl(param: string, value: string | undefined, _current: Record<string, string>) {
  const url = new URL("http://x/matches");
  if (param !== "surface"    && _current.surface)    url.searchParams.set("surface", _current.surface);
  if (param !== "tournament" && _current.tournament) url.searchParams.set("tournament", _current.tournament);
  if (param !== "year"       && _current.year)       url.searchParams.set("year", _current.year);
  if (value) url.searchParams.set(param, value);
  return `/matches?${url.searchParams.toString()}`;
}

function MatchRow({ match }: { match: MatchWithPlayers }) {
  const surface = match.surface as Surface | null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
    >
      {/* Players */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-sans text-text-primary group-hover:text-primary transition-colors duration-150 truncate">
          {match.player1?.name ?? "Unknown"}
        </span>
        <span className="font-mono text-text-dim text-xs shrink-0">vs</span>
        <span className="font-sans text-text-primary truncate">
          {match.player2?.name ?? "Unknown"}
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 shrink-0 ml-4">
        {surface && (
          <span className={`font-mono text-xs ${SURFACE_COLORS[surface]}`}>
            {surface}
          </span>
        )}
        <span className="font-sans text-xs text-text-dim hidden md:block">
          {match.tournament}
        </span>
        <span className="font-mono text-xs text-text-dim hidden sm:block">
          {match.round}
        </span>
        {match.match_date && (
          <span className="font-mono text-xs text-text-dim">
            {match.match_date.slice(0, 4)}
          </span>
        )}
      </div>
    </Link>
  );
}
