import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { MatchWithPlayers, Surface } from "@/types";
import Link from "next/link";
import PlayerNameWithBubble from "@/components/PlayerNameWithBubble";
import MatchFilterBar, { type MatchFilters } from "@/components/MatchFilterBar";

export const metadata = { title: "Matches — Courtside" };

const SURFACE_COLORS: Record<Surface, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c", Carpet: "#9ca3af",
};

const ROUND_SHORT: Record<string, string> = {
  "Round of 128": "R128", "Round of 64": "R64",
  "Round of 32":  "R32",  "Round of 16": "R16",
  "Quarterfinal": "QF",   "Semifinal":   "SF",
  "Final":        "F",    "Round Robin": "RR",
};

// Short label for the order-of-play meta line. Slams get their gold
// monogram; everything else shows its name (year stripped — the year has
// its own slot in the line).
function tournamentAbbrev(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("australian open")) return "AO";
  if (n.includes("roland garros") || n.includes("french open")) return "RG";
  if (n.includes("wimbledon")) return "W";
  if (n.includes("us open")) return "USO";
  return name.replace(/\s+\d{4}$/, "").toUpperCase();
}

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

// Filter dropdown options, cached for an hour — they only change when new
// tournaments are imported. The previous version read the first 500 rows
// alphabetically, so the dropdown showed only "Australian Open 2020–2023"
// (4 of 86 tournaments) and the year list was derived from a capped query.
const getFilterOptions = unstable_cache(
  async () => {
    const db = getSupabase();

    const rows = await fetchAllRows<{ tournament: string }>((from, to) =>
      db.from("matches").select("tournament").range(from, to)
    );
    const tournaments = [...new Set(rows.map((r) => r.tournament).filter(Boolean))].sort();

    const [{ data: minRow }, { data: maxRow }] = await Promise.all([
      db.from("matches").select("tournament_season").not("tournament_season", "is", null)
        .order("tournament_season", { ascending: true }).limit(1).maybeSingle(),
      db.from("matches").select("tournament_season").not("tournament_season", "is", null)
        .order("tournament_season", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const years: string[] = [];
    const lo = minRow?.tournament_season as number | undefined;
    const hi = maxRow?.tournament_season as number | undefined;
    if (lo && hi) for (let y = hi; y >= lo; y--) years.push(String(y));

    return { tournaments, years };
  },
  ["match-filter-options"],
  { revalidate: 3600 }
);

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

  // ── Fetch filter options (cached hourly) ─────────────────────────────────────
  const { tournaments, years } = await getFilterOptions();

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
    // Page through all reviews — an unbounded select silently caps at 1,000
    // rows, which would compute wrong averages once reviews grow past that
    const ratingRows = await fetchAllRows<{ match_id: string; match_rating: number }>(
      (from, to) => admin.from("reviews").select("match_id, match_rating").range(from, to)
    );
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
    .order("match_date", { ascending: false, nullsFirst: false })
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

  // Player (single) — validate UUID shape before interpolating into the
  // filter string; anything else could manipulate the query expression
  const isUuid = player && /^[0-9a-f-]{36}$/i.test(player);
  if (isUuid) query = query.or(`player1_id.eq.${player},player2_id.eq.${player}`);

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

      {/* Masthead */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="bill-name text-3xl" style={{ fontWeight: 500 }}>Order of Play</h1>
        <div className="eyebrow" style={{ fontSize: 11 }}>
          {(["ATP", "WTA"] as const).map((t, i) => (
            <span key={t}>
              {i > 0 && <span style={{ color: "#c9a96a" }}> · </span>}
              <Link
                href={buildTourUrl(t)}
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
        {tourSubtitle}
      </p>

      <div className="mb-8">
        <MatchFilterBar filters={filters} options={{ tournaments, surfaces, years }} basePath="/matches" />
      </div>

      {error ? (
        <p className="text-loss font-sans text-sm">Failed to load matches.</p>
      ) : (matches ?? []).length === 0 ? (
        <div
          className="rounded-lg p-12 text-center"
          style={{ border: "1px solid var(--hairline-soft)", background: "rgba(236,229,216,0.02)" }}
        >
          <p className="bill-name italic text-sm" style={{ fontWeight: 300, color: "rgba(236,229,216,0.5)" }}>
            Nothing on the schedule.
          </p>
          {hasAnyFilter && (
            <p className="font-sans text-xs mt-2" style={{ color: "rgba(236,229,216,0.35)" }}>
              Try adjusting your filters
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="eyebrow mb-3" style={{ fontSize: 10, color: "rgba(236,229,216,0.35)" }}>
            {matches!.length}{matches!.length >= 100 ? "+" : ""} match{matches!.length !== 1 ? "es" : ""}
          </p>
          <div>
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
  const p1Won = !!match.winner_id && match.winner_id === match.player1?.id;
  const p2Won = !!match.winner_id && match.winner_id === match.player2?.id;
  const hasWinner = p1Won || p2Won;

  // Winner reads first on the bill — "Alcaraz d. Sinner"
  const first  = p2Won ? match.player2 : match.player1;
  const second = p2Won ? match.player1 : match.player2;

  const abbrev  = tournamentAbbrev(match.tournament);
  const tier    = match.tournament_tier;
  const abbrevColor =
    tier === "grand_slam" ? "#c9a96a" :
    tier === "masters_1000" ? "rgba(192,192,192,0.7)" :
    "rgba(236,229,216,0.45)";
  const year = match.match_date?.slice(0, 4);
  const round = ROUND_SHORT[match.round ?? ""] ?? match.round;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-baseline justify-between gap-x-4 gap-y-0.5 flex-wrap py-3 px-1 transition-colors duration-150"
      style={{ borderBottom: "1px solid var(--hairline-soft)" }}
    >
      <span className="bill-name min-w-0" style={{ fontSize: 16 }}>
        <span style={{ fontWeight: hasWinner ? 500 : 400, color: "#ece5d8" }}>
          <PlayerNameWithBubble playerId={first.id} playerName={first?.name ?? "Unknown"} />
        </span>
        <span className="italic" style={{ fontWeight: 300, fontSize: 13, color: "rgba(236,229,216,0.4)" }}>
          {" "}{hasWinner ? "d." : "v."}{" "}
        </span>
        <span style={{ fontWeight: 300, color: hasWinner ? "rgba(236,229,216,0.65)" : "#ece5d8" }}>
          <PlayerNameWithBubble playerId={second.id} playerName={second?.name ?? "Unknown"} />
        </span>
      </span>
      <span
        className="font-mono shrink-0"
        style={{ fontSize: 11, letterSpacing: "0.08em", color: "rgba(236,229,216,0.45)" }}
      >
        <span style={{ color: abbrevColor }}>{abbrev}</span>
        {round && <> · {round}</>}
        {surface && <> · <span style={{ color: SURFACE_COLORS[surface] }}>{surface.toUpperCase()}</span></>}
        {year && <> · {year}</>}
      </span>
    </Link>
  );
}
