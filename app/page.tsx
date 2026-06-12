import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import CountryFlag from "@/components/CountryFlag";
import GuideBanner from "@/components/GuideBanner";
import TournamentBadge from "@/components/TournamentBadge";

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

function rankFrameStyle(rank: number | null | undefined): React.CSSProperties {
  if (!rank) return { border: "2px solid rgba(34,214,138,0.2)" };
  if (rank <= 10) return {
    background: "linear-gradient(135deg, #f5c518, #e0a800, #f5c518)",
    boxShadow: "0 0 12px rgba(245,197,24,0.5), 0 0 24px rgba(245,197,24,0.15)",
    padding: "2px",
  };
  if (rank <= 50) return {
    background: "linear-gradient(135deg, #c0c0c0, #e8e8e8, #a8a8a8)",
    boxShadow: "0 0 8px rgba(192,192,192,0.35)",
    padding: "2px",
  };
  if (rank <= 100) return {
    background: "linear-gradient(135deg, #4a9eff, #6ab4ff, #3a8ef0)",
    boxShadow: "0 0 6px rgba(74,158,255,0.3)",
    padding: "2px",
  };
  return { border: "2px solid rgba(255,255,255,0.1)" };
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

// Public home page data, cached 5 minutes — top players, recent reviews,
// and site-wide counts change slowly and don't need 6 queries per visit.
const getHomeData = unstable_cache(
  async () => {
    const db = adminDb();
    const [
      { data: topPlayers },
      { data: rawReviews },
      { count: playerCount },
      { count: matchCount },
      { count: reviewCount },
      { count: ratingCount },
    ] = await Promise.all([
      db.from("players")
        .select("id, name, country, current_rank, photo_url, image_url")
        .not("current_rank", "is", null)
        .order("current_rank", { ascending: true })
        .limit(10),

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

      db.from("players").select("*", { count: "exact", head: true }),
      db.from("matches").select("*", { count: "exact", head: true }),
      db.from("reviews").select("*", { count: "exact", head: true }),
      db.from("skill_ratings").select("*", { count: "exact", head: true }),
    ]);
    return {
      topPlayers: topPlayers ?? [],
      rawReviews: rawReviews ?? [],
      playerCount, matchCount, reviewCount, ratingCount,
    };
  },
  ["home-page-data"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const { userId: clerkId } = await auth();
  const db = adminDb();

  const { topPlayers, rawReviews, playerCount, matchCount, reviewCount, ratingCount } =
    await getHomeData();

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

  function formatCount(n: number | null) {
    if (!n) return "0";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  return (
    <div>

      {/* ── Guide banner (shown to logged-in users with < 5 reviews) ─────── */}
      {clerkId && <GuideBanner reviewCount={userReviewCount ?? 0} />}

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        className="flex flex-col items-center justify-center text-center px-4"
        style={{
          minHeight: "calc(100vh - 60px)",
          background: "radial-gradient(ellipse 70% 50% at 50% 38%, rgba(100,200,20,0.16) 0%, rgba(14,17,22,0) 65%), #0e1116",
        }}
      >
        <Image
          src="/Homepage_Ball.png"
          alt="Tennis ball"
          width={280}
          height={280}
          priority
          style={{
            marginBottom: 32,
            filter: "drop-shadow(0 0 40px rgba(110,200,10,0.65)) drop-shadow(0 0 80px rgba(80,160,0,0.35))",
          }}
        />

        <h1
          className="font-mono font-bold text-white"
          style={{ fontSize: 56, letterSpacing: "-0.01em", marginBottom: 12, lineHeight: 1 }}
        >
          Courtside
        </h1>

        <p
          className="font-sans mb-10 max-w-sm"
          style={{ fontSize: 18, color: "#9ca3af", letterSpacing: "0.01em", lineHeight: 1.5 }}
        >
          Rate players. Review matches.<br />Build your tennis catalogue.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/players"
            className="font-mono text-sm font-semibold px-6 py-3 rounded-xl transition-all duration-150"
            style={{ background: "#22d68a", color: "#0e1116" }}
          >
            Browse Players
          </Link>
          {clerkId ? (
            <Link
              href="/feed"
              className="font-mono text-sm font-semibold px-6 py-3 rounded-xl transition-all duration-150 border border-white/15 text-text-primary hover:border-white/30"
            >
              View Activity
            </Link>
          ) : (
            <Link
              href="/sign-up"
              className="font-mono text-sm font-semibold px-6 py-3 rounded-xl transition-all duration-150 border border-white/15 text-text-primary hover:border-white/30"
            >
              Join Free
            </Link>
          )}
        </div>

        {/* Stats bar */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-16 pt-10"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {[
            { value: formatCount(playerCount), label: "Players" },
            { value: formatCount(matchCount),  label: "Matches"  },
            { value: formatCount(reviewCount), label: "Reviews"  },
            { value: formatCount(ratingCount), label: "Skill Ratings" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="font-mono text-2xl font-bold text-text-primary">{value}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-text-dim mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="mt-10 flex flex-col items-center gap-1.5 opacity-40">
          <div className="w-px h-8" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.4))" }} />
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-dim">Scroll</span>
        </div>
      </section>

      {/* ── Top Players ─────────────────────────────────────────────────────── */}
      {players.length > 0 && (
        <section className="py-16 px-4" style={{ background: "#0e1116", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-mono text-xl font-bold text-text-primary">Top Ranked</h2>
                <p className="font-sans text-sm text-text-dim mt-0.5">The world&apos;s best players — rate their skills, explore their history</p>
              </div>
              <Link
                href="/players"
                className="font-mono text-xs text-text-dim hover:text-text-primary transition-colors duration-150 shrink-0"
              >
                All Players →
              </Link>
            </div>

            {/* Horizontal scroll on mobile, wrap on desktop */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5 lg:grid-cols-10">
              {players.map((p) => (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="group shrink-0 sm:shrink flex flex-col items-center gap-2 rounded-xl py-4 px-3 transition-all duration-150 border border-white/[0.05] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04]"
                  style={{ minWidth: 100 }}
                >
                  {/* Photo / initials */}
                  <div
                    className="w-14 h-14 rounded-full shrink-0"
                    style={rankFrameStyle(p.current_rank)}
                  >
                    {(p.photo_url || p.image_url) ? (
                      <Image
                        src={p.photo_url ?? p.image_url}
                        alt={p.name}
                        width={56}
                        height={56}
                        className="w-full h-full rounded-full object-cover object-top"
                        unoptimized
                      />
                    ) : (
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center font-mono text-sm font-bold"
                        style={{ background: "rgba(34,214,138,0.1)", color: "#22d68a" }}
                      >
                        {p.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Rank */}
                  <span
                    className="font-mono text-xs font-bold"
                    style={{
                      color: p.current_rank <= 10 ? "#f5c518"
                           : p.current_rank <= 50 ? "#c0c0c0"
                           : p.current_rank <= 100 ? "#4a9eff"
                           : "#6b7280",
                    }}
                  >
                    #{p.current_rank}
                  </span>

                  {/* Name */}
                  <span className="font-sans text-xs font-medium text-text-primary group-hover:text-primary transition-colors text-center leading-tight line-clamp-2">
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

      {/* ── Recent Reviews ──────────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <section className="py-16 px-4" style={{ background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-mono text-xl font-bold text-text-primary">Community Reviews</h2>
                <p className="font-sans text-sm text-text-dim mt-0.5">What fans are watching and rating right now</p>
              </div>
              <Link
                href="/matches"
                className="font-mono text-xs text-text-dim hover:text-text-primary transition-colors duration-150 shrink-0"
              >
                All Matches →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    className="group rounded-xl p-4 flex flex-col gap-3 transition-all duration-150"
                    style={{
                      background:  "rgba(255,255,255,0.02)",
                      border:      m.tournament_tier === "grand_slam"
                                     ? "1px solid rgba(245,197,24,0.18)"
                                     : m.tournament_tier === "masters_1000"
                                     ? "1px solid rgba(192,192,192,0.12)"
                                     : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {/* Match */}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="font-sans text-sm font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                          {m.player1?.name?.split(" ").pop()}
                        </span>
                        <span className="font-mono text-[10px] text-text-dim">vs</span>
                        <span className="font-sans text-sm font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                          {m.player2?.name?.split(" ").pop()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-text-dim truncate">{m.tournament}</span>
                        {m.surface && (
                          <span
                            className="font-mono text-[10px] shrink-0"
                            style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}
                          >
                            {m.surface}
                          </span>
                        )}
                        <TournamentBadge tournamentName={m.tournament} tier={m.tournament_tier} />
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-xl font-bold"
                        style={{
                          color: r.match_rating >= 8 ? "#22d68a"
                               : r.match_rating >= 6 ? "#f5c518"
                               : "#9ca3af",
                        }}
                      >
                        {fmt(r.match_rating)}
                      </span>
                      <div className="flex-1 rounded-full h-1 overflow-hidden bg-white/[0.06]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(r.match_rating / 10) * 100}%`,
                            background: r.match_rating >= 8 ? "#22d68a"
                                      : r.match_rating >= 6 ? "#f5c518"
                                      : "#9ca3af",
                          }}
                        />
                      </div>
                    </div>

                    {/* Comment */}
                    {r.comment && (
                      <p className="font-sans text-xs text-text-dim leading-relaxed italic line-clamp-2 flex-1">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                    )}

                    {/* Reviewer */}
                    <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <span className="font-sans text-[10px] text-text-dim">
                        {prof?.display_name ?? prof?.username ?? "Community"}
                      </span>
                      <span className="font-mono text-[9px] text-text-dim">{timeAgo(r.created_at)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-mono text-xl font-bold text-text-primary mb-2">How it works</h2>
          <p className="font-sans text-sm text-text-dim mb-3">Three ways to engage with the tennis you watch</p>
          <Link
            href="/guide"
            className="font-mono text-xs text-text-dim hover:text-primary transition-colors duration-150 inline-block mb-12"
          >
            Full guide →
          </Link>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                num:   "01",
                title: "Rate Skills",
                body:  "Score any player across 17 attributes — serve, footspeed, clutch, and more. See how your view compares with the community radar.",
                color: "#22d68a",
                href:  "/players",
                cta:   "Find a player",
              },
              {
                num:   "02",
                title: "Review Matches",
                body:  "Rate match quality and both players' performances. Leave a comment, mark favourites, react to others' takes.",
                color: "#f5c518",
                href:  "/matches",
                cta:   "Browse matches",
              },
              {
                num:   "03",
                title: "Compare & Debate",
                body:  "Head-to-head pages overlay two players' community radars side by side. Who really has the better backhand?",
                color: "#4a9eff",
                href:  "/players",
                cta:   "Start a comparison",
              },
            ].map(({ num, title, body, color, href, cta }) => (
              <div key={num} className="flex flex-col items-center text-center gap-4">
                <span
                  className="font-mono text-4xl font-bold"
                  style={{ color, opacity: 0.25 }}
                >
                  {num}
                </span>
                <div>
                  <h3 className="font-mono text-base font-semibold text-text-primary mb-2">{title}</h3>
                  <p className="font-sans text-sm text-text-dim leading-relaxed">{body}</p>
                </div>
                <Link
                  href={href}
                  className="font-mono text-xs transition-colors duration-150 mt-auto"
                  style={{ color }}
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
        <section
          className="py-16 px-4 text-center"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.04)",
            background: "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(34,214,138,0.06) 0%, rgba(14,17,22,0) 70%), #0e1116",
          }}
        >
          <h2 className="font-mono text-2xl font-bold text-text-primary mb-3">Start your catalogue</h2>
          <p className="font-sans text-sm text-text-dim mb-8 max-w-sm mx-auto">
            Free to join. Rate players, review matches, follow other fans.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/sign-up"
              className="font-mono text-sm font-semibold px-6 py-3 rounded-xl transition-all duration-150"
              style={{ background: "#22d68a", color: "#0e1116" }}
            >
              Create Account
            </Link>
            <Link
              href="/sign-in"
              className="font-mono text-sm px-6 py-3 rounded-xl transition-all duration-150 border border-white/15 text-text-dim hover:text-text-primary hover:border-white/25"
            >
              Sign In
            </Link>
          </div>
        </section>
      )}

    </div>
  );
}
