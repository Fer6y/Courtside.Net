import { getSupabase } from "@/lib/supabase";
import type { MatchWithPlayers, Surface } from "@/types";
import Link from "next/link";
import PlayerNameWithBubble from "@/components/PlayerNameWithBubble";
import MatchFilterBar, { type MatchFilters } from "@/components/MatchFilterBar";

export const metadata = {
  title: "Matches — Courtside",
};

const SURFACE_COLORS: Record<Surface, string> = {
  Hard:   "text-court-hard",
  Clay:   "text-court-clay",
  Grass:  "text-court-grass",
  Carpet: "text-text-dim",
};

type SearchParams = Promise<{
  round?:       string;
  tournament?:  string;
  surface?:     string;
  year?:        string;
  player?:      string;
  playerName?:  string;
}>;

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { round, tournament, surface, year, player, playerName } = await searchParams;
  const supabase = getSupabase();

  // ── Fetch filter options dynamically ──────────────────────────────────────
  const [{ data: tournamentRows }, { data: yearRows }, { data: surfaceRows }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("tournament")
        .order("tournament")
        .limit(500),
      supabase
        .from("matches")
        .select("match_date")
        .not("match_date", "is", null)
        .limit(10000),
      supabase
        .from("matches")
        .select("surface")
        .not("surface", "is", null)
        .limit(500),
    ]);

  const tournaments = [...new Set((tournamentRows ?? []).map((r) => r.tournament).filter(Boolean))].sort();
  const years = [
    ...new Set(
      (yearRows ?? [])
        .map((r) => r.match_date?.slice(0, 4))
        .filter(Boolean)
    ),
  ].sort((a, b) => Number(b) - Number(a)) as string[];
  const surfaces = [...new Set((surfaceRows ?? []).map((r) => r.surface).filter(Boolean))].sort() as string[];

  // ── Build filtered query ───────────────────────────────────────────────────
  let query = supabase
    .from("matches")
    .select(`
      *,
      player1:player1_id ( id, name, country, current_rank ),
      player2:player2_id ( id, name, country, current_rank )
    `)
    .order("match_date", { ascending: false })
    .limit(100);

  if (round)      query = query.eq("round", round);
  if (tournament) query = query.eq("tournament", tournament);
  if (surface)    query = query.eq("surface", surface);
  if (year)       query = query.gte("match_date", `${year}-01-01`).lte("match_date", `${year}-12-31`);
  if (player)     query = query.or(`player1_id.eq.${player},player2_id.eq.${player}`);

  const { data: matches, error } = await query;

  const hasAnyFilter = !!(round || tournament || surface || year || player);

  const filters: MatchFilters = { round, tournament, surface, year, player, playerName };

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="font-mono text-3xl font-bold text-text-primary mb-2">
        Matches
      </h1>
      <p className="font-sans text-text-mid mb-8">
        Grand Slams &amp; Masters 1000 · ATP &amp; WTA
      </p>

      {/* ── Filter chip row ──────────────────────────────────────────────── */}
      <div className="mb-8">
        <MatchFilterBar
          filters={filters}
          options={{ tournaments, surfaces, years }}
          basePath="/matches"
        />
      </div>

      {/* Results */}
      {error ? (
        <p className="text-loss font-sans text-sm">Failed to load matches.</p>
      ) : (matches ?? []).length === 0 ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-12 text-center">
          <p className="font-mono text-text-dim text-sm mb-2">No matches found</p>
          {hasAnyFilter && (
            <p className="font-sans text-text-dim text-xs">Try adjusting your filters</p>
          )}
        </div>
      ) : (
        <>
          <p className="font-mono text-sm text-text-dim mb-4">
            {matches!.length}{matches!.length >= 100 ? "+" : ""} match{matches!.length !== 1 ? "es" : ""}
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
  const p1Won = match.winner_id && match.player1 && match.winner_id === match.player1.id;
  const p2Won = match.winner_id && match.player2 && match.winner_id === match.player2.id;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <PlayerNameWithBubble
          playerId={match.player1.id}
          playerName={match.player1?.name ?? "Unknown"}
          className={`font-sans truncate transition-colors duration-150 ${p1Won ? "text-primary font-semibold" : "text-text-primary"}`}
        />
        <span className="font-mono text-text-dim text-xs shrink-0">vs</span>
        <PlayerNameWithBubble
          playerId={match.player2.id}
          playerName={match.player2?.name ?? "Unknown"}
          className={`font-sans truncate ${p2Won ? "text-primary font-semibold" : "text-text-primary"}`}
        />
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
