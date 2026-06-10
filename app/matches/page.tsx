import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import type { MatchWithPlayers, Surface } from "@/types";
import Link from "next/link";
import PlayerNameWithBubble from "@/components/PlayerNameWithBubble";
import MatchFilterBar, { type MatchFilters } from "@/components/MatchFilterBar";

export const metadata = { title: "Matches — Courtside" };

const SURFACE_COLORS: Record<Surface, string> = {
  Hard: "text-court-hard", Clay: "text-court-clay",
  Grass: "text-court-grass", Carpet: "text-text-dim",
};

// Grand Slam name patterns — everything else in our dataset is Masters
const SLAM_PATTERNS = [
  "Australian Open", "French Open", "Roland Garros", "Wimbledon", "US Open",
];

type SearchParams = Promise<{
  tour?:       string;
  round?:      string;
  tournament?: string;
  surface?:    string;
  year?:       string;  // "2020-2024" range format
  player?:     string;
  playerName?: string;
  level?:      string;  // comma-separated: "slam,masters"
  sets?:       string;  // comma-separated: "3,4,5"
  minRating?:  string;
}>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getArr(val?: string): string[] {
  return val ? val.split(",").filter(Boolean) : [];
}

// Count spaces in a score string to determine number of sets
function scoreSetCount(score: string | null): number {
  if (!score || !score.trim()) return 0;
  return score.trim().split(" ").length;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const { tour, round, tournament, surface, year, player, playerName, level, sets, minRating } =
    await searchParams;

  const activeTour = tour === "WTA" ? "WTA" : "ATP";

  const supabase = getSupabase();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Fetch filter options ─────────────────────────────────────────────────────
  const [{ data: tournamentRows }, { data: yearRows }] = await Promise.all([
    supabase.from("matches").select("tournament").order("tournament").limit(500),
    supabase.from("matches").select("match_date").not("match_date", "is", null).limit(10000),
  ]);

  const tournaments = [...new Set((tournamentRows ?? []).map((r) => r.tournament).filter(Boolean))].sort();
  const years = [...new Set((yearRows ?? []).map((r) => r.match_date?.slice(0, 4)).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a)) as string[];

  // Surfaces are schema-defined constants — no need to query
  const surfaces = ["Hard", "Clay", "Grass"];

  // ── Tour URL builder (preserves all other search params) ────────────────────
  function buildTourUrl(t: string): string {
    const qs = new URLSearchParams();
    qs.set("tour", t);
    if (round)       qs.set("round", round);
    if (tournament)  qs.set("tournament", tournament);
    if (surface)     qs.set("surface", surface);
    if (year)        qs.set("year", year);
    if (player)      qs.set("player", player);
    if (playerName)  qs.set("playerName", playerName);
    if (level)       qs.set("level", level);
    if (sets)        qs.set("sets", sets);
    if (minRating)   qs.set("minRating", minRating);
    return `/matches?${qs.toString()}`;
  }

  // ── Min rating: pre-fetch qualifying match IDs ───────────────────────────────
  let ratedMatchIds: string[] | null = null;
  if (minRating) {
    const threshold = Number(minRating);
    const { data: ratingRows } = await admin.from("reviews").select("match_id, match_rating");
    if (ratingRows && ratingRows.length > 0) {
      const totals = new Map<string, { sum: number; count: number }>();
      for (const row of ratingRows) {
        const mid = row.match_id as string;
        if (!totals.has(mid)) totals.set(mid, { sum: 0, count: 0 });
        const t = totals.get(mid)!;
        t.sum += Number(row.match_rating);
        t.count++;
      }
      ratedMatchIds = [];
      for (const [mid, { sum, count }] of totals) {
        if (sum / count >= threshold) ratedMatchIds.push(mid);
      }
    } else {
      ratedMatchIds = [];
    }
  }

  // ── Parse multi-select values ────────────────────────────────────────────────
  const rounds   = getArr(round);
  const surfaces_ = getArr(surface);
  const levels   = getArr(level);
  const setsArr  = getArr(sets);

  // When sets filter is active, fetch more records (JS filtering happens below)
  const fetchLimit = setsArr.length > 0 ? 500 : 100;

  // ── Build DB query ───────────────────────────────────────────────────────────
  let query = supabase
    .from("matches")
    .select(`*, player1:player1_id(id,name,country,current_rank), player2:player2_id(id,name,country,current_rank)`)
    .order("match_date", { ascending: false })
    .limit(fetchLimit);

  // Tour
  query = query.eq("tour", activeTour);

  // Round (multi)
  if (rounds.length === 1)      query = query.eq("round", rounds[0]);
  else if (rounds.length > 1)   query = query.in("round", rounds);

  // Tournament (single)
  if (tournament) query = query.eq("tournament", tournament);

  // Surface (multi)
  if (surfaces_.length === 1)     query = query.eq("surface", surfaces_[0]);
  else if (surfaces_.length > 1)  query = query.in("surface", surfaces_);

  // Year (5-year range, single-select) — format: "2020-2024"
  if (year) {
    const startYear = year.substring(0, 4);
    const endYear   = year.substring(5, 9);
    if (startYear && endYear) {
      query = query.gte("match_date", `${startYear}-01-01`).lte("match_date", `${endYear}-12-31`);
    }
  }

  // Player (single)
  if (player) query = query.or(`player1_id.eq.${player},player2_id.eq.${player}`);

  // Level (multi) — only apply when not both selected (both = no filter)
  if (levels.length === 1) {
    if (levels[0] === "slam") {
      query = query.or(SLAM_PATTERNS.map((p) => `tournament.ilike.%${p}%`).join(","));
    } else if (levels[0] === "masters") {
      for (const p of SLAM_PATTERNS) query = query.not("tournament", "ilike", `%${p}%`);
    }
  }

  // Min rating
  if (ratedMatchIds !== null) {
    if (ratedMatchIds.length === 0) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("id", ratedMatchIds);
    }
  }

  const { data: rawMatches, error } = await query;

  // ── JS post-filter: sets (multi-select) ─────────────────────────────────────
  let matches = rawMatches as MatchWithPlayers[] | null;
  if (matches && setsArr.length > 0) {
    matches = matches
      .filter((m) => {
        const n = scoreSetCount((m as unknown as { score: string | null }).score);
        return setsArr.includes(String(n));
      })
      .slice(0, 100);
  }

  const hasAnyFilter = !!(round || tournament || surface || year || player || level || sets || minRating);
  const filters: MatchFilters = { round, tournament, surface, year, player, playerName, level, sets, minRating };
  const tourSubtitle = activeTour === "WTA" ? "Grand Slams & Premier · WTA" : "Grand Slams & Masters 1000 · ATP";

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="font-mono text-3xl font-bold text-text-primary mb-2">Matches</h1>
      <p className="font-sans text-text-mid mb-6">{tourSubtitle}</p>

      {/* Tour tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(["ATP", "WTA"] as const).map((t) => (
          <Link
            key={t}
            href={buildTourUrl(t)}
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

      <div className="mb-8">
        <MatchFilterBar filters={filters} options={{ tournaments, surfaces, years }} basePath="/matches" />
      </div>

      {error ? (
        <p className="text-loss font-sans text-sm">Failed to load matches.</p>
      ) : (matches ?? []).length === 0 ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-12 text-center">
          <p className="font-mono text-text-dim text-sm mb-2">No matches found</p>
          {hasAnyFilter && <p className="font-sans text-text-dim text-xs">Try adjusting your filters</p>}
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
        {surface && <span className={`font-mono text-xs ${SURFACE_COLORS[surface]}`}>{surface}</span>}
        <span className="font-sans text-xs text-text-dim hidden md:block">{match.tournament}</span>
        <span className="font-mono text-xs text-text-dim hidden sm:block">{match.round}</span>
        {match.match_date && <span className="font-mono text-xs text-text-dim">{match.match_date.slice(0, 4)}</span>}
      </div>
    </Link>
  );
}
