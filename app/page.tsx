import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { TOUR_PREF_COOKIE, asTourPreference } from "@/lib/tourPreference";
import CountryFlag from "@/components/CountryFlag";
import CourtsideMark from "@/components/CourtsideMark";
import GuideBanner from "@/components/GuideBanner";

// NOTE: a page-level `revalidate` doesn't work here — auth() forces dynamic
// rendering. Public data is cached via unstable_cache below instead; only
// the per-user guide-banner query runs on every request.

export const metadata = {
  title: "Courtside — Catalogue your tennis fandom",
};

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SURFACE_COLOR: Record<string, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c",
};

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const days  = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmt(n: number) { return n.toFixed(1); }

// ── Page ───────────────────────────────────────────────────────────────────────

// Public home page data, cached 5 minutes. Site-wide vanity counts were
// retired with the redesign (content rule: no boasting until there's a
// real community) — the cover features an editorial match instead.
const getHomeData = unstable_cache(
  async () => {
    const db = adminDb();
    const topQuery = (tour: "ATP" | "WTA") =>
      db.from("players")
        .select("id, name, country, current_rank, photo_url, image_url")
        .not("current_rank", "is", null)
        .filter("career_stats->>tour", "eq", tour)
        .order("current_rank", { ascending: true })
        .limit(10);

    const [
      { data: topAtp },
      { data: topWta },
      { data: rawReviews },
      { data: featuredFinal },
    ] = await Promise.all([
      topQuery("ATP"),
      topQuery("WTA"),

      db.from("reviews")
        .select(`
          id, match_rating, comment, created_at,
          profile:user_id ( username, display_name ),
          match:match_id (
            id, tournament, tournament_tier, round, surface, match_date,
            player1:player1_id ( id, name ),
            player2:player2_id ( id, name )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(4),

      // "This fortnight" — the most recent final in the catalogue
      db.from("matches")
        .select(`
          id, tournament, round, surface, match_date, tournament_tier, winner_id,
          player1:player1_id ( id, name ),
          player2:player2_id ( id, name )
        `)
        .eq("round", "Final")
        .not("match_date", "is", null)
        .order("match_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      topAtp: topAtp ?? [],
      topWta: topWta ?? [],
      rawReviews: rawReviews ?? [],
      featuredFinal: featuredFinal ?? null,
    };
  },
  ["home-page-data"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const { userId: clerkId } = await auth();
  const db = adminDb();

  const { topAtp, topWta, rawReviews, featuredFinal } = await getHomeData();

  // "Top of the Draw" is ATP-focused by default; the WTA is folded in only when
  // the viewer has opted into both tours on their customize page (cookie is the
  // source of truth — read here rather than in the shared cache).
  const tourPref = asTourPreference((await cookies()).get(TOUR_PREF_COOKIE)?.value);
  const topPlayers =
    tourPref === "all"
      ? [...topAtp, ...topWta]
          .sort(
            (a, b) =>
              ((a.current_rank as number) ?? 999) - ((b.current_rank as number) ?? 999)
          )
          .slice(0, 10)
      : topAtp;

  // Current user's own review count — decides whether the guide banner shows.
  // Per-user, so it stays outside the cache. 999 = not logged in → never show.
  let userReviewCount: number | null = 999;
  if (clerkId) {
    const { data: me } = await db.from("profiles").select("id").eq("clerk_user_id", clerkId).single();
    if (me) {
      const { count } = await db
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("user_id", me.id);
      userReviewCount = count;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews = (rawReviews ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players = (topPlayers ?? []) as any[];

  return (
    <div>

      {/* ── Guide banner (shown to logged-in users with < 5 reviews) ─────── */}
      {clerkId && <GuideBanner reviewCount={userReviewCount ?? 0} />}

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-4 min-h-[calc(100svh_-_100px)] md:min-h-[calc(100vh_-_60px)]"
      >
        <CourtsideMark size={76} className="mb-5" />
        <div className="eyebrow" style={{ fontSize: 11, color: "#c9a96a" }}>
          Catalogue your tennis fandom
        </div>
        <h1 className="bill-name" style={{ fontSize: 52, fontWeight: 500, margin: "14px 0 6px", lineHeight: 1 }}>
          Courtside
        </h1>
        <p
          className="bill-name italic"
          style={{ fontWeight: 300, fontSize: 17, color: "rgba(236,229,216,0.6)" }}
        >
          The matches you watched, the players you rate.
        </p>

        {/* Double rule */}
        <div className="w-full" style={{ maxWidth: 380, marginTop: 26 }}>
          <hr className="rule" />
          <hr className="rule" style={{ marginTop: 3 }} />
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link
            href={clerkId ? "/matches" : "/sign-up"}
            className="eyebrow btn-paper rounded-md px-6 py-3 font-semibold"
            style={{ fontSize: 11 }}
          >
            {clerkId ? "Order of Play" : "Begin Your Catalogue"}
          </Link>
          {clerkId && (
            <Link
              href="/players"
              className="eyebrow btn-ghost rounded-md px-6 py-3"
              style={{ fontSize: 11 }}
            >
              The Field
            </Link>
          )}
          <Link
            href={clerkId ? "/feed" : "/guide"}
            className="eyebrow btn-ghost rounded-md px-6 py-3"
            style={{ fontSize: 11 }}
          >
            {clerkId ? "Your Activity" : "The Guide"}
          </Link>
        </div>

        {/* Bottom strip — pinned to the foot of the hero so the masthead
            (logo · title · options) stays vertically centred and uncluttered.
            On mobile it's a slim footnote; the scroll cue is desktop-only. */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-6 flex flex-col items-center gap-5">
          {/* This fortnight — editorial feature, kept small */}
          {featuredFinal && (
            <div className="w-full mx-auto" style={{ maxWidth: 420 }}>
              <div className="rule-divider mb-2">
                <span className="eyebrow" style={{ fontSize: 8, color: "rgba(236,229,216,0.45)" }}>
                  This fortnight — {(featuredFinal.tournament as string).replace(/\s+\d{4}$/, "")}
                </span>
              </div>
              <Link
                href={`/matches/${featuredFinal.id}`}
                className="flex items-baseline justify-between gap-x-3 gap-y-0.5 flex-wrap transition-colors duration-150"
              >
                <span className="bill-name" style={{ fontSize: 14 }}>
                  <span style={{ fontWeight: 500, color: "#ece5d8" }}>
                    {(featuredFinal.player1 as { name?: string } | null)?.name}
                  </span>
                  <span className="italic" style={{ fontWeight: 300, fontSize: 12, color: "rgba(236,229,216,0.4)" }}>
                    {" "}v.{" "}
                  </span>
                  <span style={{ fontWeight: 500, color: "#ece5d8" }}>
                    {(featuredFinal.player2 as { name?: string } | null)?.name}
                  </span>
                </span>
                <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.08em", color: "rgba(236,229,216,0.45)" }}>
                  FINAL
                  {featuredFinal.surface && (
                    <> · <span style={{ color: SURFACE_COLOR[featuredFinal.surface as string] ?? "inherit" }}>
                      {(featuredFinal.surface as string).toUpperCase()}
                    </span></>
                  )}
                  {featuredFinal.match_date && <> · {(featuredFinal.match_date as string).slice(0, 4)}</>}
                </span>
              </Link>
            </div>
          )}

          {/* Scroll cue — desktop only; on mobile the screen already reads clean */}
          <div className="hidden sm:flex flex-col items-center gap-1.5 opacity-40">
            <div className="w-px h-8" style={{ background: "linear-gradient(to bottom, rgba(236,229,216,0), rgba(236,229,216,0.4))" }} />
            <span className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.6)" }}>Scroll</span>
          </div>
        </div>
      </section>

      {/* ── Top of the Draw ─────────────────────────────────────────────────── */}
      {players.length > 0 && (
        <section className="py-16 px-4" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="bill-name text-2xl" style={{ fontWeight: 500 }}>Top of the Draw</h2>
              <Link
                href="/players"
                className="eyebrow shrink-0 transition-colors duration-150"
                style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}
              >
                The Field →
              </Link>
            </div>
            <p className="bill-name italic mb-7" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}>
              The world&apos;s best — rate their skills, read their form
            </p>

            {/* Horizontal scroll on mobile, wrap on desktop */}
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5 lg:grid-cols-10">
              {players.map((p) => (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="group shrink-0 sm:shrink flex flex-col items-center gap-2 py-2 transition-all duration-150"
                  style={{ minWidth: 88 }}
                >
                  {/* Photo / initials with rank-tier ring */}
                  <div
                    className="w-14 h-14 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                    style={{
                      border: p.current_rank <= 10
                        ? "2px solid rgba(201,169,106,0.85)"
                        : p.current_rank <= 50
                        ? "2px solid rgba(192,192,192,0.55)"
                        : "2px solid rgba(236,229,216,0.2)",
                      background: "rgba(236,229,216,0.04)",
                    }}
                  >
                    {(p.photo_url || p.image_url) ? (
                      <Image
                        src={p.photo_url ?? p.image_url}
                        alt={p.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover object-top"
                        unoptimized
                      />
                    ) : (
                      <span className="bill-name" style={{ fontSize: 16, color: "rgba(236,229,216,0.45)" }}>
                        {p.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Rank */}
                  <span
                    className="eyebrow"
                    style={{
                      fontSize: 9,
                      color: p.current_rank <= 10 ? "#c9a96a"
                           : p.current_rank <= 50 ? "rgba(192,192,192,0.7)"
                           : "rgba(236,229,216,0.4)",
                    }}
                  >
                    No. {p.current_rank}
                  </span>

                  {/* Name */}
                  <span
                    className="bill-name text-center leading-tight line-clamp-2"
                    style={{ fontSize: 14, color: "#ece5d8" }}
                  >
                    {p.name.split(" ").pop()}
                  </span>

                  {/* Country */}
                  {p.country && (
                    <CountryFlag code={p.country} size={20} />
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Notes from the gallery ──────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <section className="py-16 px-4" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
          <div className="max-w-3xl mx-auto">
            <div className="rule-divider mb-7">
              <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>
                Notes from the gallery
              </span>
            </div>

            <div>
              {reviews.map((r) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const m = r.match as any;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const prof = r.profile as any;
                if (!m) return null;
                return (
                  <Link
                    key={r.id}
                    href={`/matches/${m.id}`}
                    className="flex items-baseline justify-between gap-x-4 gap-y-1 flex-wrap py-3.5 px-1 transition-colors duration-150"
                    style={{ borderBottom: "1px solid var(--hairline-soft)" }}
                  >
                    <span className="min-w-0">
                      <span className="bill-name block" style={{ fontSize: 16 }}>
                        <span style={{ color: "#ece5d8" }}>{m.player1?.name?.split(" ").pop()}</span>
                        <span className="italic" style={{ fontWeight: 300, fontSize: 13, color: "rgba(236,229,216,0.4)" }}> v. </span>
                        <span style={{ color: "#ece5d8" }}>{m.player2?.name?.split(" ").pop()}</span>
                        {m.surface && (
                          <span
                            className="font-mono"
                            style={{ fontSize: 10, letterSpacing: "0.1em", color: SURFACE_COLOR[m.surface] ?? "rgba(236,229,216,0.4)" }}
                          >
                            {"  "}{m.surface.toUpperCase()}
                          </span>
                        )}
                      </span>
                      {r.comment && (
                        <span
                          className="bill-name italic block truncate mt-0.5"
                          style={{ fontWeight: 300, fontSize: 13, color: "rgba(236,229,216,0.5)", maxWidth: 440 }}
                        >
                          &ldquo;{r.comment}&rdquo;
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-mono font-semibold block" style={{ fontSize: 17, color: "#c9a96a" }}>
                        {fmt(r.match_rating)}
                      </span>
                      <span className="eyebrow block mt-0.5" style={{ fontSize: 8, color: "rgba(236,229,216,0.35)" }}>
                        {prof?.display_name ?? prof?.username ?? "Community"} · {timeAgo(r.created_at)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="text-center mt-6">
              <Link
                href="/matches"
                className="eyebrow transition-colors duration-150"
                style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}
              >
                The Order of Play →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="bill-name text-2xl mb-1" style={{ fontWeight: 500 }}>How it works</h2>
          <p className="bill-name italic mb-3" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}>
            Three ways to engage with the tennis you watch
          </p>
          <Link
            href="/guide"
            className="eyebrow inline-block mb-12 transition-colors duration-150"
            style={{ fontSize: 10, color: "#c9a96a" }}
          >
            The Guide →
          </Link>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                num:   "No. 01",
                title: "Rate Skills",
                body:  "Score any player across 17 attributes — serve, footspeed, clutch, and more. See how your view compares with the community radar.",
                href:  "/players",
                cta:   "Find a player",
              },
              {
                num:   "No. 02",
                title: "Review Matches",
                body:  "Rate match quality and both players' performances. Leave a comment, mark favourites, react to others' takes.",
                href:  "/matches",
                cta:   "Browse matches",
              },
              {
                num:   "No. 03",
                title: "Compare & Debate",
                body:  "Head-to-head pages overlay two players' community radars side by side. Who really has the better backhand?",
                href:  "/players",
                cta:   "Start a comparison",
              },
            ].map(({ num, title, body, href, cta }) => (
              <div key={num} className="flex flex-col items-center text-center gap-3">
                <span className="eyebrow" style={{ fontSize: 10, color: "rgba(201,169,106,0.7)" }}>
                  {num}
                </span>
                <div>
                  <h3 className="bill-name mb-2" style={{ fontSize: 18, fontWeight: 500 }}>{title}</h3>
                  <p className="font-sans text-sm leading-relaxed" style={{ color: "rgba(236,229,216,0.45)" }}>{body}</p>
                </div>
                <Link
                  href={href}
                  className="eyebrow mt-auto transition-colors duration-150"
                  style={{ fontSize: 9, color: "#c9a96a" }}
                >
                  {cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA (guests only) ─────────────────────────────────────────── */}
      {!clerkId && (
        <section className="py-16 px-4 text-center" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
          <h2 className="bill-name text-2xl mb-2" style={{ fontWeight: 500 }}>Start your catalogue</h2>
          <p className="bill-name italic mb-8 max-w-sm mx-auto" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}>
            Free to join. Rate players, review matches, follow other fans.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/sign-up"
              className="eyebrow btn-paper rounded-md px-6 py-3 font-semibold"
              style={{ fontSize: 11 }}
            >
              Create Account
            </Link>
            <Link
              href="/sign-in"
              className="eyebrow btn-ghost rounded-md px-6 py-3"
              style={{ fontSize: 11 }}
            >
              Sign In
            </Link>
          </div>
        </section>
      )}

      {/* ── Colophon ─────────────────────────────────────────────────────────── */}
      <div className="text-center pb-12" style={{ paddingTop: 8 }}>
        <span className="eyebrow" style={{ fontSize: 10, color: "rgba(201,169,106,0.6)" }}>
          — Courtside · Est. MMXXVI —
        </span>
      </div>

    </div>
  );
}
