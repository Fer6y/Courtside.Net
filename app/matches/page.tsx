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

const GRAND_SLAMS = [
  "Australian Open",
  "Roland Garros",
  "Wimbledon",
  "Us Open",
];

const MASTERS = [
  "Indian Wells Masters",
  "Miami Masters",
  "Monte Carlo Masters",
  "Madrid Masters",
  "Rome Masters",
  "Canada Masters",
  "Cincinnati Masters",
  "Shanghai Masters",
  "Paris Masters",
  "Indian Wells",
  "Miami",
  "Madrid",
  "Rome",
  "Beijing",
];

const YEARS = ["2020", "2021", "2022", "2023", "2024"];
const SURFACES = ["Hard", "Clay", "Grass"];

type SearchParams = Promise<{
  surface?: string;
  tournament?: string; // comma-separated
  year?: string;       // comma-separated
}>;

/** Parse a comma-separated param into a Set of active values */
function parseMulti(val: string | undefined): Set<string> {
  if (!val) return new Set();
  return new Set(val.split(",").map((s) => s.trim()).filter(Boolean));
}

/** Build URL toggling a value in/out of a multi-select param */
function buildUrl(
  param: string,
  value: string,
  current: { surface?: string; tournament?: string; year?: string },
  multi = true
) {
  const url = new URL("http://x/matches");

  if (multi) {
    // Preserve all current params, toggle the clicked value
    const existing = parseMulti(current[param as keyof typeof current]);
    if (existing.has(value)) existing.delete(value);
    else existing.add(value);
    if (existing.size) url.searchParams.set(param, [...existing].join(","));
    // Preserve other params unchanged
    for (const [k, v] of Object.entries(current)) {
      if (k !== param && v) url.searchParams.set(k, v);
    }
  } else {
    // Single-select (surface): toggle off if already active
    for (const [k, v] of Object.entries(current)) {
      if (v) url.searchParams.set(k, v);
    }
    const currentVal = current[param as keyof typeof current];
    if (currentVal === value) url.searchParams.delete(param);
    else url.searchParams.set(param, value);
  }

  return `/matches?${url.searchParams.toString()}`;
}

function clearUrl(
  param: string,
  current: { surface?: string; tournament?: string; year?: string }
) {
  const url = new URL("http://x/matches");
  for (const [k, v] of Object.entries(current)) {
    if (k !== param && v) url.searchParams.set(k, v);
  }
  const qs = url.searchParams.toString();
  return `/matches${qs ? `?${qs}` : ""}`;
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { surface, tournament, year } = await searchParams;
  const supabase = getSupabase();

  const activeSurfaces    = parseMulti(surface);
  const activeTournaments = parseMulti(tournament);
  const activeYears       = parseMulti(year);

  const current = { surface, tournament, year };

  let query = supabase
    .from("matches")
    .select(`
      *,
      player1:player1_id ( id, name, country, current_rank ),
      player2:player2_id ( id, name, country, current_rank )
    `)
    .order("match_date", { ascending: false })
    .limit(100);

  // Surface — single value
  if (surface) query = query.eq("surface", surface);

  // Tournament — multi-select using .in()
  if (activeTournaments.size) {
    query = query.in("tournament", [...activeTournaments]);
  }

  // Year — multi-select: build OR of date ranges
  if (activeYears.size) {
    const yearList = [...activeYears];
    if (yearList.length === 1) {
      const y = yearList[0];
      query = query.gte("match_date", `${y}-01-01`).lte("match_date", `${y}-12-31`);
    } else {
      const orClauses = yearList
        .map((y) => `and(match_date.gte.${y}-01-01,match_date.lte.${y}-12-31)`)
        .join(",");
      query = query.or(orClauses);
    }
  }

  const { data: matches, error } = await query;

  const totalActive = activeSurfaces.size + activeTournaments.size + activeYears.size;

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="font-mono text-3xl font-bold text-text-primary mb-2">
        Matches
      </h1>
      <p className="font-sans text-text-mid mb-8">
        Grand Slams &amp; Masters 1000 · 2020–2024 · ATP &amp; WTA
      </p>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-8">

        {/* Active filter summary + clear all */}
        {totalActive > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs text-primary">
              {totalActive} filter{totalActive > 1 ? "s" : ""} active
            </span>
            <Link
              href="/matches"
              className="font-mono text-xs px-3 py-1 rounded-full border border-white/10 text-text-dim hover:text-text-primary transition-colors duration-150"
            >
              Clear all
            </Link>
          </div>
        )}

        {/* Surface — single-select */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-text-dim w-20 shrink-0">Surface</span>
          <div className="flex gap-1.5 flex-wrap">
            {SURFACES.map((s) => {
              const active = activeSurfaces.has(s);
              return (
                <Link
                  key={s}
                  href={buildUrl("surface", s, current, false)}
                  className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                    active
                      ? "border-primary text-primary bg-primary/10"
                      : "border-white/10 text-text-dim hover:text-text-primary"
                  }`}
                >
                  {s}
                  {active && <span className="ml-1 opacity-60">×</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Year — multi-select */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-text-dim w-20 shrink-0">Year</span>
          <div className="flex gap-1.5 flex-wrap">
            {activeTournaments.size > 0 && (
              <Link
                href={clearUrl("year", current)}
                className="font-mono text-xs px-3 py-1.5 rounded-full border border-white/10 text-text-dim hover:text-text-primary transition-colors duration-150"
              >
                Clear
              </Link>
            )}
            {YEARS.map((y) => {
              const active = activeYears.has(y);
              return (
                <Link
                  key={y}
                  href={buildUrl("year", y, current)}
                  className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                    active
                      ? "border-primary text-primary bg-primary/10"
                      : "border-white/10 text-text-dim hover:text-text-primary"
                  }`}
                >
                  {y}
                  {active && <span className="ml-1 opacity-60">×</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Grand Slams — multi-select */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-text-dim w-20 shrink-0">Slams</span>
          <div className="flex gap-1.5 flex-wrap">
            {GRAND_SLAMS.map((t) => {
              const active = activeTournaments.has(t);
              return (
                <Link
                  key={t}
                  href={buildUrl("tournament", t, current)}
                  className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                    active
                      ? "border-primary text-primary bg-primary/10"
                      : "border-white/10 text-text-dim hover:text-text-primary"
                  }`}
                >
                  {t}
                  {active && <span className="ml-1 opacity-60">×</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Masters — multi-select */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-text-dim w-20 shrink-0">Masters</span>
          <div className="flex gap-1.5 flex-wrap">
            {MASTERS.map((t) => {
              const active = activeTournaments.has(t);
              return (
                <Link
                  key={t}
                  href={buildUrl("tournament", t, current)}
                  className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                    active
                      ? "border-primary text-primary bg-primary/10"
                      : "border-white/10 text-text-dim hover:text-text-primary"
                  }`}
                >
                  {t}
                  {active && <span className="ml-1 opacity-60">×</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results count */}
      {error ? (
        <p className="text-loss font-sans text-sm">Failed to load matches.</p>
      ) : (
        <>
          <p className="font-mono text-sm text-text-dim mb-4">
            {matches?.length ?? 0} matches{(matches?.length ?? 0) >= 100 ? "+" : ""}
          </p>

          <div className="divide-y divide-white/5">
            {(matches as MatchWithPlayers[]).map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function MatchRow({ match }: { match: MatchWithPlayers }) {
  const surface = match.surface as Surface | null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-sans text-text-primary group-hover:text-primary transition-colors duration-150 truncate">
          {match.player1?.name ?? "Unknown"}
        </span>
        <span className="font-mono text-text-dim text-xs shrink-0">vs</span>
        <span className="font-sans text-text-primary truncate">
          {match.player2?.name ?? "Unknown"}
        </span>
      </div>

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
