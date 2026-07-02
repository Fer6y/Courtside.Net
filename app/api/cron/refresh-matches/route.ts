/**
 * GET /api/cron/refresh-matches
 *
 * The live match-refresh pipeline (docs/live-match-refresh-plan.md).
 * Pinged every ~2.5 minutes by the GitHub Actions workflow
 * (.github/workflows/refresh-matches.yml); idempotent and time-boxed, so
 * overlapping or missed runs are harmless.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends
 * this automatically when the CRON_SECRET env var is set; external
 * schedulers (cron-job.org) must be configured with the same header.
 *
 * Per run:
 *   1. Which tracked tournaments are in their date window today? None → exit
 *      (zero API calls — a year-round schedule costs nothing off-season).
 *   2. Discovery for in-window events with no seasonId yet — identity is
 *      verified via tournament/info, never assumed from dates. Runs on the
 *      first poll of each hour (or with ?force=discover) to keep pre-play
 *      probing cheap.
 *   3. Poll each discovered tournament's draw and import newly completed
 *      matches (creating any players we haven't met).
 *   4. When a Final lands for the first time, refresh live rankings.
 *   5. Log to refresh_log if the table exists (optional migration), and
 *      return the run summary as JSON either way.
 *
 * State lives in existing tables: the seasonId cache is the api_raw_staging
 * fixtures row; "event finished" is derived from the matches table.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { eventsInWindow, type TrackedEvent } from "@/lib/tournamentCalendar";
import {
  discoverSeasonIds,
  importTournament,
  syncRankings,
  type Tour,
} from "@/lib/matchImport";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 240_000; // leave headroom before the platform limit

interface RunSummary {
  window: string[];
  discovered: string[];
  polled: Record<string, unknown>[];
  completedNow: string[];
  rankings: { corrected: number; cleared: number } | null;
  skipped: string[];
  errors: string[];
  ms: number;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const now = new Date();
  const force = req.nextUrl.searchParams.get("force") === "discover";
  const db = getSupabaseAdmin();

  const summary: RunSummary = {
    window: [], discovered: [], polled: [], completedNow: [],
    rankings: null, skipped: [], errors: [], ms: 0,
  };

  try {
    // ── 1. What should be live right now? ────────────────────────────────
    const inWindow = eventsInWindow(now);
    summary.window = inWindow.map(({ event, year }) => `${event.name} ${year}`);
    if (inWindow.length === 0) {
      summary.ms = Date.now() - started;
      await writeLog(db, summary, true);
      return NextResponse.json({ ok: true, note: "no tracked tournament in window", ...summary });
    }

    // Season-id cache: a fixtures staging row for (event, year, tour) means
    // the tournament was already discovered.
    type Target = { event: TrackedEvent; year: number; tour: Tour; seasonId: string | null };
    const targets: Target[] = [];
    for (const { event, year } of inWindow) {
      for (const tour of event.tours) {
        const { data } = await db
          .from("api_raw_staging")
          .select("params")
          .eq("method", "get_fixtures")
          .contains("params", { slam_name: event.name, year: String(year), tour })
          .maybeSingle();
        const seasonId = (data?.params as Record<string, string> | null)?.seasonId ?? null;
        targets.push({ event, year, tour, seasonId });
      }
    }

    // ── 2. Discovery (a couple of attempts per hour, or forced) ──────────
    // The probe costs ~20–40 API calls, so with ~90s ping cadence it only
    // fires in the first minutes of each hour until the event is found.
    const needsDiscovery = targets.filter((t) => !t.seasonId);
    const discoveryDue = force || now.getUTCMinutes() < 3;
    if (needsDiscovery.length > 0 && discoveryDue) {
      for (const tour of ["ATP", "WTA"] as Tour[]) {
        const tourTargets = needsDiscovery.filter((t) => t.tour === tour);
        if (tourTargets.length === 0 || Date.now() > started + TIME_BUDGET_MS) continue;
        try {
          const found = await discoverSeasonIds(
            tour,
            tourTargets[0].year,
            tourTargets.map((t) => t.event)
          );
          for (const d of found) {
            const target = tourTargets.find((t) => t.event.name === d.event.name);
            if (!target) continue;
            target.seasonId = d.seasonId;
            summary.discovered.push(
              `${d.event.name} ${target.year} ${tour} → ${d.seasonId} ("${d.infoName}" [${d.infoTier}])`
            );
          }
        } catch (err) {
          summary.errors.push(`discovery ${tour}: ${(err as Error).message}`);
        }
      }
    } else if (needsDiscovery.length > 0) {
      summary.skipped.push(
        `discovery deferred to the top of the hour for: ${needsDiscovery
          .map((t) => `${t.event.name} ${t.tour}`)
          .join(", ")}`
      );
    }

    // ── 3. Poll every discovered tournament in window ────────────────────
    let anyTransition = false;
    for (const target of targets) {
      if (!target.seasonId) continue;
      if (Date.now() > started + TIME_BUDGET_MS) {
        summary.skipped.push(`${target.event.name} ${target.tour}: out of time, next run`);
        continue;
      }
      const label = `${target.event.name} ${target.year}`;
      try {
        const { data: finalRow } = await db
          .from("matches")
          .select("id")
          .eq("tournament", label)
          .eq("tour", target.tour)
          .eq("round", "Final")
          .not("winner_id", "is", null)
          .limit(1)
          .maybeSingle();
        const finalWasDone = !!finalRow;

        const result = await importTournament(db, {
          event: target.event,
          tour: target.tour,
          year: target.year,
          seasonId: target.seasonId,
        });
        summary.polled.push({ tournament: label, tour: target.tour, ...result });

        if (result.finalCompleted && !finalWasDone) {
          anyTransition = true;
          summary.completedNow.push(`${label} ${target.tour}`);
        }
        if (result.problems.length > 0) {
          summary.errors.push(`${label} ${target.tour} validation: ${result.problems.join("; ")}`);
        }
      } catch (err) {
        summary.errors.push(`poll ${label} ${target.tour}: ${(err as Error).message}`);
      }
    }

    // ── 4. A final just landed → refresh live rankings ───────────────────
    if (anyTransition && Date.now() < started + TIME_BUDGET_MS) {
      try {
        summary.rankings = await syncRankings(db);
      } catch (err) {
        summary.errors.push(`rankings sync: ${(err as Error).message}`);
      }
    }

    summary.ms = Date.now() - started;
    const ok = summary.errors.length === 0;
    await writeLog(db, summary, ok);
    return NextResponse.json({ ok, ...summary });
  } catch (err) {
    summary.errors.push((err as Error).message);
    summary.ms = Date.now() - started;
    await writeLog(db, summary, false);
    return NextResponse.json({ ok: false, ...summary }, { status: 500 });
  }
}

/** Run history — optional table (supabase/migrations/add_refresh_log.sql). */
async function writeLog(
  db: ReturnType<typeof getSupabaseAdmin>,
  summary: RunSummary,
  ok: boolean
) {
  try {
    await db.from("refresh_log").insert({ trigger: "cron", ok, summary });
  } catch {
    // table not created yet — the JSON response still carries the summary
  }
}
