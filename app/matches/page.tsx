import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { MatchWithPlayers } from "@/types";
import Link from "next/link";
import MatchFilterBar, { type MatchFilters } from "@/components/MatchFilterBar";
import MatchCard, { type MatchReviewSummary } from "@/components/MatchCard";

export const metadata = { title: "Matches — Courtside" };

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
  scope?:      string;  // "marquee" (default) | "all"
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

// The "marquee" set: IDs of the tour's current top-50 players. Order of Play
// opens on meetings where BOTH players are in this set — the match-ups people
// actually tune in for — rather than the full chronological log.
//
// NOTE: current_rank is today's rank, not rank-at-match-time, so this biases
// toward today's stars. That's intentional ("focus on top players"). 50 is the
// single knob here — bump it to widen the marquee.
const MARQUEE_RANK_CUTOFF = 50;
const getTopPlayerIds = unstable_cache(
  async (tour: string) => {
    const db = getSupabase();
    const { data } = await db
      .from("players")
      .select("id")
      .filter("career_stats->>tour", "eq", tour)
      .lte("current_rank", MARQUEE_RANK_CUTOFF)
      .not("current_rank", "is", null);
    return (data ?? []).map((r) => r.id as string);
  },
  ["matches-marquee-ids"],
  { revalidate: 3600 }
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const { tour, round, tournament, surface, year, player, playerName, level, sets, minRating, scope } =
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
    if (scope)       qs.set("scope", scope);
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
  const tourns   = getArr(tournament);

  // When sets filter is active, fetch more records (JS filtering happens below)
  const fetchLimit = setsArr.length > 0 ? 500 : 40;

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

  // Tournament (multi)
  if (tourns.length === 1)      query = query.eq("tournament", tourns[0]);
  else if (tourns.length > 1)   query = query.in("tournament", tourns);

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

  // Marquee default — both players in the tour's current top 50. Lifted when
  // scope=all, or when drilling into one player (then show all their matches,
  // including against lower-ranked opponents).
  const marquee = scope !== "all" && !isUuid;
  if (marquee) {
    const topIds = await getTopPlayerIds(activeTour);
    if (topIds.length > 0) {
      query = query.in("player1_id", topIds).in("player2_id", topIds);
    }
  }

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

  // ── Community review summary per displayed match (one batched query) ─────────
  // ≤40 ids, so a scoped IN is safe. Top excerpt = highest-rated commented
  // review, newest as tie-break.
  const reviewSummary = new Map<string, MatchReviewSummary>();
  const displayedIds = (matches ?? []).map((m) => m.id);
  if (displayedIds.length > 0) {
    const { data: revRows } = await admin
      .from("reviews")
      .select("match_id, match_rating, comment, created_at")
      .in("match_id", displayedIds);
    if (revRows && revRows.length > 0) {
      const agg = new Map<string, { sum: number; count: number; top: { rating: number; created: string; comment: string } | null }>();
      for (const r of revRows) {
        const mid = r.match_id as string;
        let a = agg.get(mid);
        if (!a) { a = { sum: 0, count: 0, top: null }; agg.set(mid, a); }
        const rating = Number(r.match_rating);
        a.sum += rating; a.count++;
        const comment = (r.comment as string | null)?.trim();
        if (comment) {
          const created = r.created_at as string;
          if (!a.top || rating > a.top.rating || (rating === a.top.rating && created > a.top.created)) {
            a.top = { rating, created, comment };
          }
        }
      }
      for (const [mid, a] of agg) {
        reviewSummary.set(mid, { avg: a.sum / a.count, count: a.count, topExcerpt: a.top?.comment ?? null });
      }
    }
  }

  const hasAnyFilter = !!(round || tournament || surface || year || player || level || sets || minRating);
  const filters: MatchFilters = { round, tournament, surface, year, player, playerName, level, sets, minRating, scope };
  const tourSubtitle = marquee
    ? "The match-ups that mattered — top-50 meetings"
    : activeTour === "WTA" ? "Every match · WTA" : "Every match · ATP";

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
          <div>
            {(matches as MatchWithPlayers[]).map((match) => (
              <MatchCard key={match.id} match={match} summary={reviewSummary.get(match.id) ?? null} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
