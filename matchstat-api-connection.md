# Courtside — MatchStat Tennis API: Connection Setup
### Claude Code Handoff

---

## Purpose

Wire the **MatchStat Tennis API** (ATP/WTA/ITF, distributed via RapidAPI) into the Courtside codebase (Next.js 15 / TypeScript / Supabase) so it's authenticated, tested, and ready for the historical backfill. This doc covers the **connection layer only**. The backfill phases live in `data-source-migration-plan.md`.

---

## Provider facts (confirmed)

- Data goes back to **1970**, detailed stats from **1990**. All ATP, WTA, ITF and Grand Slam events covered (Australian Open, Roland Garros, Wimbledon, US Open) — so 2020–2024 Slam coverage is solid.
- Distributed through **RapidAPI**. Free plan for testing + affordable paid tier.
- REST, JSON responses, current version **v2** (path prefix `/tennis/v2/`).
- Docs: `https://tennisapidoc.matchstat.com` — read this for exact endpoint paths.

---

## Step 1 — Subscribe & get the key

1. Subscribe to the **Tennis API – ATP/WTA/ITF** on RapidAPI (host `tennis-api-atp-wta-itf.p.rapidapi.com`). Start on the **free tier**.
2. Copy the `X-RapidAPI-Key` from the RapidAPI dashboard.
3. Before relying on anything beyond the free tier, confirm the paid-tier monthly price sits within budget (~$15–20) and that the listing's terms permit commercial use.

---

## Step 2 — Connection facts (use these verbatim)

- **Base host:** `tennis-api-atp-wta-itf.p.rapidapi.com`
- **Base URL:** `https://tennis-api-atp-wta-itf.p.rapidapi.com/tennis/v2/`
- **Auth headers on every request:**
  - `X-RapidAPI-Key: <your key>`
  - `X-RapidAPI-Host: tennis-api-atp-wta-itf.p.rapidapi.com`
- **Tour selector:** most endpoints take a tour selector (ATP / WTA / ITF) as a path param or query — confirm per endpoint in the docs.
- **Rate limit:** 100 requests/minute per IP, server-enforced (HTTP 429 on exceed). Your RapidAPI plan may add a separate quota.

---

## Step 3 — Environment config

Add to `.env.local` and to the Vercel project environment:

```
MATCHSTAT_API_KEY=<your RapidAPI key>
MATCHSTAT_API_HOST=tennis-api-atp-wta-itf.p.rapidapi.com
```

- **Never commit the key.** Confirm `.env.local` is gitignored.
- **Server-side only.** Do NOT use a `NEXT_PUBLIC_` prefix and do NOT call this API from client components — the key must never reach the browser. All calls go through Next.js route handlers / server actions / server-side scripts.

---

## Step 4 — Thin API client (server-side)

Create a single wrapper module (e.g. `lib/matchstat.ts`) that all server-side code uses. It should:

- read key + host from env (throw clearly if missing)
- attach the two auth headers
- build the URL from the base + endpoint path
- centralize error handling and 429 backoff
- return typed JSON

Illustrative sketch (Claude Code writes the real, typed version):

```ts
const BASE = `https://${process.env.MATCHSTAT_API_HOST}/tennis/v2`;

export async function matchstat<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: {
      "X-RapidAPI-Key": process.env.MATCHSTAT_API_KEY!,
      "X-RapidAPI-Host": process.env.MATCHSTAT_API_HOST!,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 429) { /* backoff + retry */ }
  if (!res.ok) throw new Error(`MatchStat ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
```

---

## Step 5 — Smoke test (do this before anything else)

Confirm auth works with one cheap, known call before building further:

1. Call a rankings endpoint (e.g. `ranking/live?tour=ATP` — confirm the exact path in the docs). Expect a 200 and JSON containing ranked players.
2. Then confirm one historical call returns data — a tournaments lookup, as the precursor to the backfill.
3. Log the HTTP status and one sample record. **Do not proceed past a failing smoke test** — a 401/403 means the key or headers are wrong; a 429 means throttling.

---

## Step 6 — Endpoint map relevant to Courtside

Confirm exact paths against `tennisapidoc.matchstat.com`, but the groups you'll use:

- **Tournaments** — info, seasons, past champions, results, calendar → find the four Slams and their 2020–2024 seasons (backfill entry point).
- **Fixtures** — matches by tournament / date range / player → match records for the catalogue.
- **Players** — profiles, match stats, surface summaries, titles/finals → player records and the bubble's surface W/L.
- **Rankings** — current ATP/WTA singles & doubles with weekly movement → the bubble's ranking + trend arrow.
- **H2H** — all-time records and match lists → not needed for MVP; banked.

---

## Step 7 — Guardrails

- Server-side only; key in env; never exposed to the client.
- Respect the 100 req/min ceiling — add throttling/backoff, especially during the backfill.
- Cache all responses into Supabase; never live-call the API for historical data (see migration plan).
- Handle 429 and 5xx with retry + exponential backoff.
- Validate the JSON shape and fail loudly in development.

---

## Next step

Once the smoke test passes, move to `data-source-migration-plan.md`: Phase 0 (coverage spot-check) → Phase 1 (schema prep) → Phase 2 (backfill).

---

## Open items to confirm

- [ ] Paid-tier price within budget (the free tier should cover the one-time backfill)
- [ ] Commercial-use permission under the RapidAPI listing terms
- [ ] Exact v2 endpoint paths confirmed against `tennisapidoc.matchstat.com`
- [ ] Whether player profiles include photo URLs (decides avatar strategy)
