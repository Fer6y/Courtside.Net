/**
 * lib/matchstat.ts
 *
 * Thin wrapper around the MatchStat Tennis API (via RapidAPI).
 * All server-side code that touches the API goes through this module.
 *
 * Provider: https://tennisapidoc.matchstat.com
 * RapidAPI host: tennis-atp-wta-itf.p.rapidapi.com
 * Version: v2  (all paths prefixed /tennis/v2/)
 *
 * NEVER import this file from a client component — the API key must
 * stay server-side. Next.js will warn if you try.
 */

// Env vars are read lazily inside matchstat() so that dotenv.config()
// in scripts has time to run before they're accessed.
function getConfig() {
  const key  = process.env.MATCHSTAT_API_KEY;
  const host = process.env.MATCHSTAT_API_HOST ?? "tennis-api-atp-wta-itf.p.rapidapi.com";
  return { key, host, base: `https://${host}/tennis/v2` };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Tour = "ATP" | "WTA" | "ITF";

/** Generic successful response wrapper MatchStat uses */
export interface MatchStatResponse<T> {
  data?: T;
  result?: T;        // some endpoints use 'result'
  status?: string;
  [key: string]: unknown;
}

// ── Rate-limit state ──────────────────────────────────────────────────────────
// 100 req/min = 1 request per 600ms minimum. We use 1200ms (50 req/min) to
// stay well under the limit and avoid burning daily quotas on bulk scripts.
const MIN_INTERVAL_MS = 1200;
let lastCallAt = 0;

async function throttle() {
  const now = Date.now();
  const gap = now - lastCallAt;
  if (gap < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - gap);
  }
  lastCallAt = Date.now();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * 401/403 from RapidAPI — the key is missing, revoked, or the subscription
 * is inactive (e.g. cancelled between seasons). Not retryable: callers
 * should stop making API calls for the rest of the run and serve cached
 * Supabase data instead.
 */
export class MatchstatAuthError extends Error {
  constructor(status: number, path: string, body: string) {
    super(
      `MatchStat ${status} on GET /${path} — RapidAPI subscription inactive ` +
      `or key invalid: ${body.slice(0, 120)}`
    );
    this.name = "MatchstatAuthError";
  }
}

// ── Core fetch ────────────────────────────────────────────────────────────────

/**
 * Call a MatchStat v2 endpoint.
 *
 * @param path  Endpoint path WITHOUT leading slash, e.g. "ranking/live"
 * @param params  Query parameters as a plain object
 * @param retries  Number of 429 retries remaining (handled automatically)
 *
 * @example
 *   const data = await matchstat("ranking/live", { tour: "ATP" });
 */
export async function matchstat<T = unknown>(
  path: string,
  params: Record<string, string> = {},
  retries = 3
): Promise<T> {
  const { key, host, base } = getConfig();

  if (!key) {
    throw new Error(
      "MATCHSTAT_API_KEY is not set in environment variables. " +
      "Add it to .env.local and to the Vercel project settings."
    );
  }

  await throttle();

  const qs  = new URLSearchParams(params);
  const url = qs.toString() ? `${base}/${path}?${qs}` : `${base}/${path}`;

  const res = await fetch(url, {
    method:  "GET",
    headers: {
      "X-RapidAPI-Key":  key,
      "X-RapidAPI-Host": host,
      "Accept":          "application/json",
    },
  });

  // 429 — rate limited: wait and retry with exponential backoff
  if (res.status === 429) {
    if (retries <= 0) {
      throw new Error(`MatchStat rate limit hit on ${path} — no retries left`);
    }
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10") * 1000;
    const backoff    = retryAfter || (2 ** (3 - retries)) * 2000; // 2s, 4s, 8s
    console.warn(`  [matchstat] 429 on /${path} — waiting ${backoff}ms, retrying (${retries} left)`);
    await sleep(backoff);
    return matchstat<T>(path, params, retries - 1);
  }

  // 401/403 — dead key or cancelled subscription: never retry
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    throw new MatchstatAuthError(res.status, path, body);
  }

  // Other non-2xx
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MatchStat ${res.status} on GET /${path}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as MatchStatResponse<T>;

  // Unwrap common envelope shapes — return raw if neither key found
  if (json.data !== undefined) return json.data as T;
  if (json.result !== undefined) return json.result as T;
  return json as unknown as T;
}

// ── Convenience helpers ───────────────────────────────────────────────────────
// All paths confirmed against tennisapidoc.matchstat.com
// Pattern: /tennis/v2/{type}/{resource} where type = "atp" | "wta"

/** Current ATP or WTA singles rankings */
export async function getRankings(tour: Tour) {
  return matchstat<unknown[]>(`${tour.toLowerCase()}/ranking/singles`);
}

/** Tournament calendar for a given year — returns all tournaments + seasonids */
export async function getTournamentCalendar(tour: Tour, year: number | string) {
  return matchstat<unknown[]>(`${tour.toLowerCase()}/tournament/calendar/${year}`);
}

/** Full draw results for one tournament season (by seasonid) */
export async function getTournamentResults(tour: Tour, seasonId: string) {
  return matchstat<unknown>(`${tour.toLowerCase()}/tournament/results/${seasonId}`);
}

/** Player profile by player ID */
export async function getPlayerProfile(tour: Tour, playerId: string) {
  return matchstat<unknown>(`${tour.toLowerCase()}/player/profile/${playerId}`, {
    include: "ranking,country",
  });
}

/** Surface win/loss breakdown for a player */
export async function getPlayerSurfaceSummary(tour: Tour, playerId: string) {
  return matchstat<unknown>(`${tour.toLowerCase()}/player/surface-summary/${playerId}`);
}

/** Past matches for a player — filterable by year and tournament rank */
export async function getPlayerPastMatches(
  tour: Tour,
  playerId: string,
  year?: number,
  tourRank?: number  // 1 = Grand Slams, 2 = Masters/Premier
) {
  const filters: string[] = [];
  if (year)     filters.push(`GameYear:${year}`);
  if (tourRank) filters.push(`TourRank:${tourRank}`);
  const params: Record<string, string> = {};
  if (filters.length) params.filter = filters.join(";");
  return matchstat<unknown[]>(`${tour.toLowerCase()}/player/past-matches/${playerId}`, params);
}
