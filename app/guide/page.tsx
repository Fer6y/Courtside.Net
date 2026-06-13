import Link from "next/link";
import { Flame, Zap, ThumbsDown, type LucideIcon } from "lucide-react";
import RadarChart from "@/components/radar/RadarChart";
import GuideSidebar from "@/components/GuideSidebar";

// Maps the legacy emoji keys in the mock data to the real line icons the
// app now uses, so the guide demonstrates what users actually see.
const RX_ICON: Record<string, LucideIcon> = {
  "🔥": Flame,
  "😲": Zap,
  "👎": ThumbsDown,
};

export const metadata = {
  title: "How it works — Courtside",
  description: "A full guide to rating players, reviewing matches, and building your tennis catalogue on Courtside.",
};

// ── Demo data for radar visuals ────────────────────────────────────────────────

const DEMO_PLAYER_A: Record<string, number> = {
  focus: 4.2, clutch: 3.8, resilience: 4.5, processing_time: 4.0,
  serve: 4.8, forehand: 4.6, backhand: 3.9, shot_variety: 3.5,
  net_play: 3.2, touch: 3.8, return_play: 4.1, reaction_time: 4.3, deception: 3.4,
  speed: 4.7, court_coverage: 4.5, positioning: 4.2, anticipation: 4.4,
};

const DEMO_PLAYER_B: Record<string, number> = {
  focus: 3.5, clutch: 4.4, resilience: 3.8, processing_time: 3.6,
  serve: 3.9, forehand: 4.8, backhand: 4.5, shot_variety: 4.2,
  net_play: 4.3, touch: 4.5, return_play: 3.7, reaction_time: 3.8, deception: 4.1,
  speed: 3.9, court_coverage: 3.8, positioning: 3.6, anticipation: 3.5,
};

// ── Shared section wrapper ─────────────────────────────────────────────────────

function Section({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="py-16 scroll-mt-24"
      style={{ borderBottom: "1px solid var(--hairline-soft)" }}
    >
      <div className="flex items-baseline gap-3 mb-8">
        <span className="eyebrow" style={{ fontSize: 10, color: "rgba(201,169,106,0.7)" }}>No. {num}</span>
        <h2 className="bill-name text-2xl" style={{ fontWeight: 500 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── Category pills ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: "Mental",    color: "#d4734e", skills: "Focus · Clutch · Resilience · Processing Speed" },
  { label: "Technique", color: "#22d68a", skills: "Serve · Forehand · Backhand · Shot Variety"      },
  { label: "Skill",     color: "#f5c518", skills: "Net Play · Touch · Return · Reaction · Deception" },
  { label: "Movement",  color: "#4a9eff", skills: "Speed · Coverage · Positioning · Anticipation"   },
];

// ── Slider mockup ─────────────────────────────────────────────────────────────

function SliderMockup({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="font-sans text-sm text-text-primary">{label}</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(236,229,216,0.08)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between mt-1">
        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
          <span key={n} className="font-mono text-[9px] text-text-dim">{n}</span>
        ))}
      </div>
    </div>
  );
}

// ── Review card mockup ─────────────────────────────────────────────────────────

function ReviewMockup() {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "rgba(236,229,216,0.03)", border: "1px solid rgba(236,229,216,0.08)" }}
    >
      {/* Match header */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="font-sans text-base font-semibold text-text-primary">Sinner</span>
        <span className="font-mono text-xs text-text-dim">vs</span>
        <span className="font-sans text-base font-semibold text-text-primary">Alcaraz</span>
        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(74,144,217,0.15)", color: "#4a90d9" }}>Hard</span>
        <span className="font-mono text-xs text-text-dim">· Australian Open 2025</span>
      </div>

      {/* Sliders */}
      <SliderMockup label="Match Quality"   value={9.2} color="#f5c518" />
      <SliderMockup label="Sinner"          value={8.7} color="#22d68a" />
      <SliderMockup label="Alcaraz"         value={8.1} color="#4a9eff" />

      {/* Comment */}
      <div
        className="rounded-lg px-4 py-3 mt-4"
        style={{ background: "rgba(236,229,216,0.03)", border: "1px solid rgba(236,229,216,0.06)" }}
      >
        <p className="font-sans text-sm text-text-mid italic leading-relaxed">
          &ldquo;Incredible match from both. Sinner&apos;s serve in the fifth was untouchable.&rdquo;
        </p>
      </div>

      {/* Reactions row */}
      <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: "1px solid rgba(236,229,216,0.05)" }}>
        {[
          { emoji: "🔥", count: 14, active: true },
          { emoji: "😲", count: 6,  active: false },
          { emoji: "👎", count: 1,  active: false },
        ].map(({ emoji, count, active }) => {
          const Icon = RX_ICON[emoji];
          return (
            <div
              key={emoji}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs"
              style={{
                background: active ? "rgba(201,169,106,0.12)" : "rgba(236,229,216,0.04)",
                border:     active ? "1px solid rgba(201,169,106,0.4)" : "1px solid rgba(236,229,216,0.12)",
                color:      active ? "#c9a96a" : "rgba(236,229,216,0.45)",
              }}
            >
              <Icon size={13} strokeWidth={1.7} />
              <span>{count}</span>
            </div>
          );
        })}
        <span className="font-mono text-xs text-text-dim ml-2">3 comments</span>
      </div>
    </div>
  );
}

// ── Comment thread mockup ──────────────────────────────────────────────────────

function CommentMockup() {
  return (
    <div className="space-y-4">
      {[
        { name: "TennisNerd92",  time: "2h ago",  text: "That fifth set was something else. Pure grit from Sinner.", reactions: { "🔥": 8, "😲": 2 } },
        { name: "CourtKing",     time: "1h ago",  text: "Disagree — Alcaraz was the better player but nerves got him.", reactions: { "👎": 3 } },
        { name: "BackhandQueen", time: "45m ago", text: "Both deserve a 9+. Match of the year contender.", reactions: { "🔥": 11 } },
      ].map(({ name, time, text, reactions }) => (
        <div
          key={name}
          className="rounded-lg p-3"
          style={{ background: "rgba(236,229,216,0.02)", border: "1px solid rgba(236,229,216,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold"
              style={{ background: "rgba(34,214,138,0.15)", color: "#22d68a" }}
            >
              {name[0]}
            </div>
            <span className="font-sans text-xs font-medium text-text-primary">{name}</span>
            <span className="font-mono text-[9px] text-text-dim ml-auto">{time}</span>
          </div>
          <p className="font-sans text-xs text-text-mid leading-relaxed">{text}</p>
          <div className="flex items-center gap-1.5 mt-2">
            {Object.entries(reactions).map(([emoji, count]) => {
              const Icon = RX_ICON[emoji];
              return (
                <div
                  key={emoji}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono text-[9px]"
                  style={{ background: "rgba(236,229,216,0.04)", border: "1px solid rgba(236,229,216,0.1)", color: "rgba(236,229,216,0.5)" }}
                >
                  <Icon size={10} strokeWidth={1.7} /> {count}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Avatar grid mockup ─────────────────────────────────────────────────────────

function AvatarGridMockup() {
  const combos = [
    { bg: "#0e1116", fg: "#22d68a", label: "Ball",    type: "ball"    },
    { bg: "#0b1f12", fg: "#4a9eff", label: "Racquet", type: "racquet" },
    { bg: "#14081e", fg: "#f5c518", label: "Net",     type: "net"     },
    { bg: "#1e0e07", fg: "#d4734e", label: "Initials",type: "text"    },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {combos.map(({ bg, fg, label, type }) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center border-2"
            style={{
              background:  bg,
              borderColor: `${fg}44`,
              boxShadow:   `0 0 12px ${fg}22`,
            }}
          >
            {type === "text" ? (
              <span className="font-mono text-sm font-bold" style={{ color: fg }}>JD</span>
            ) : type === "ball" ? (
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="44" fill={fg} />
                <path d="M6 50 C6 24,28 8,50 50 C72 92,94 76,94 50" stroke={bg} strokeWidth="8" strokeLinecap="round" fill="none"/>
                <path d="M6 50 C6 76,28 92,50 50 C72 8,94 24,94 50" stroke={bg} strokeWidth="8" strokeLinecap="round" fill="none"/>
              </svg>
            ) : type === "racquet" ? (
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                <ellipse cx="50" cy="37" rx="23" ry="28" stroke={fg} strokeWidth="6" fill="none"/>
                <line x1="28" y1="37" x2="72" y2="37" stroke={fg} strokeWidth="3"/>
                <line x1="50" y1="9" x2="50" y2="65" stroke={fg} strokeWidth="3"/>
                <rect x="44" y="76" width="12" height="16" rx="4" fill={fg}/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                <rect x="9" y="26" width="8" height="55" rx="4" fill={fg}/>
                <rect x="83" y="26" width="8" height="55" rx="4" fill={fg}/>
                <path d="M17 30 Q50 42 83 30" stroke={fg} strokeWidth="5" strokeLinecap="round" fill="none"/>
                <line x1="17" y1="49" x2="83" y2="49" stroke={fg} strokeWidth="2.5"/>
                <line x1="17" y1="62" x2="83" y2="62" stroke={fg} strokeWidth="2.5"/>
                <line x1="17" y1="75" x2="83" y2="75" stroke={fg} strokeWidth="2.5"/>
              </svg>
            )}
          </div>
          <span className="font-mono text-[9px] text-text-dim">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Feed mockup ────────────────────────────────────────────────────────────────

function FeedMockup() {
  const items = [
    { name: "CourtKing",     action: "reviewed",  subject: "Djokovic vs Zverev",       time: "12m ago",  extra: "8.9" },
    { name: "TennisNerd92",  action: "rated",     subject: "Carlos Alcaraz",            time: "34m ago",  extra: "Forehand 4.8" },
    { name: "BackhandQueen", action: "reviewed",  subject: "Sinner vs Medvedev",        time: "1h ago",   extra: "7.4" },
    { name: "ServeAce",      action: "rated",     subject: "Novak Djokovic",            time: "2h ago",   extra: "Clutch 4.5" },
  ];
  const colors = ["#22d68a","#4a9eff","#f5c518","#d4734e"];
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(236,229,216,0.08)" }}
    >
      {items.map(({ name, action, subject, time, extra }, i) => (
        <div
          key={name}
          className="flex items-start gap-3 px-4 py-3"
          style={{ borderBottom: i < items.length - 1 ? "1px solid rgba(236,229,216,0.05)" : "none" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5"
            style={{ background: `${colors[i]}18`, color: colors[i] }}
          >
            {name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-sans text-sm font-medium text-text-primary">{name}</span>
              <span className="font-sans text-xs text-text-dim">{action}</span>
              <span className="font-sans text-sm text-text-primary truncate">{subject}</span>
              <span className="font-mono text-[9px] text-text-dim ml-auto shrink-0">{time}</span>
            </div>
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block"
              style={{ background: "rgba(236,229,216,0.06)", color: "#9ca3af", border: "1px solid rgba(236,229,216,0.08)" }}
            >
              {extra}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Search mockup ─────────────────────────────────────────────────────────────

function SearchMockup() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(236,229,216,0.1)", background: "#1a1e26" }}
    >
      {/* Input */}
      <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(236,229,216,0.07)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span className="font-sans text-sm text-text-dim">Search players or profiles…</span>
        <kbd className="ml-auto font-mono text-[9px] px-1.5 py-0.5 rounded border" style={{ color: "#6b7280", borderColor: "rgba(236,229,216,0.12)", background: "rgba(236,229,216,0.04)" }}>esc</kbd>
      </div>
      {/* Players */}
      <div className="px-4 pt-2 pb-1">
        <p className="eyebrow mb-1.5 text-[9px] text-text-dim">Players</p>
        {[
          { name: "Jannik Sinner",   rank: "#1",  country: "ITA" },
          { name: "Carlos Alcaraz",  rank: "#2",  country: "ESP" },
          { name: "Alexander Zverev",rank: "#3",  country: "GER" },
        ].map(({ name, rank, country }, i) => (
          <div
            key={name}
            className="flex items-center gap-3 px-2 py-2 rounded-lg"
            style={{ background: i === 0 ? "rgba(236,229,216,0.06)" : "transparent" }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(34,214,138,0.12)" }}>
              <svg width="12" height="12" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="44" fill="#22d68a"/>
                <path d="M6 50 C6 24,28 8,50 50 C72 92,94 76,94 50" stroke="#0e1116" strokeWidth="10" strokeLinecap="round" fill="none"/>
                <path d="M6 50 C6 76,28 92,50 50 C72 8,94 24,94 50" stroke="#0e1116" strokeWidth="10" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-sans text-sm text-text-primary">{name}</span>
              <span className="font-mono text-[10px] text-text-dim ml-2">{country} · {rank}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Members */}
      <div className="px-4 pt-1 pb-3">
        <p className="eyebrow mb-1.5 text-[9px] text-text-dim">Members</p>
        {[
          { name: "CourtKing",     username: "@courtking"     },
          { name: "TennisNerd92",  username: "@tennisnerd92"  },
        ].map(({ name, username }, i) => (
          <div key={name} className="flex items-center gap-3 px-2 py-2 rounded-lg" style={{ background: i === 0 ? "rgba(236,229,216,0.04)" : "transparent" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0" style={{ background: "rgba(34,214,138,0.12)", color: "#22d68a" }}>
              {name[0]}
            </div>
            <div>
              <span className="font-sans text-sm text-text-primary">{name}</span>
              <span className="font-mono text-[10px] text-text-dim ml-2">{username}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trophies mockup ────────────────────────────────────────────────────────────

const TROPHY_TIERS = [
  { tier: "Common",    color: "#9ca3af", glow: "rgba(156,163,175,0.3)", description: "Submit your first skill rating." },
  { tier: "Uncommon",  color: "#22d68a", glow: "rgba(34,214,138,0.4)",  description: "Rate 10 different players."      },
  { tier: "Rare",      color: "#4a9eff", glow: "rgba(74,158,255,0.45)", description: "Write 25 match reviews."         },
  { tier: "Grail",     color: "#f5c518", glow: "rgba(245,197,24,0.5)",  description: "Be among the top community contributors." },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="mb-12">
        <Link
          href="/"
          className="eyebrow mb-6 inline-block transition-colors duration-150"
          style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}
        >
          ← Home
        </Link>
        <div className="eyebrow mb-2" style={{ fontSize: 10, color: "#c9a96a" }}>The Programme</div>
        <h1 className="bill-name mb-3" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.05 }}>How Courtside works</h1>
        <p className="bill-name italic max-w-xl" style={{ fontWeight: 300, fontSize: 17, color: "rgba(236,229,216,0.6)" }}>
          A community platform for tennis fans. Rate players&apos; skills, review matches,
          compare head-to-head, and build a living catalogue of your tennis fandom.
        </p>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-10 items-start">

        {/* Sticky sidebar */}
        <div className="hidden lg:block sticky top-24">
          <p className="eyebrow mb-3 px-3" style={{ fontSize: 9, color: "rgba(236,229,216,0.4)" }}>Contents</p>
          <GuideSidebar />
        </div>

        {/* Content */}
        <div className="min-w-0">

          {/* ── 1. Rate Skills ────────────────────────────────────────────── */}
          <Section id="rate-skills" num="01" title="Rate Player Skills">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-6">
                  Every player in the database can be rated across <strong className="text-text-primary">17 skill attributes</strong> organised
                  into 4 categories. Each attribute is scored on a <strong className="text-text-primary">1.0 – 5.0 scale</strong>. As more
                  fans submit ratings, the community average forms the player&apos;s radar chart — a real-time
                  snapshot of collective opinion.
                </p>

                <div className="space-y-3 mb-6">
                  {CATEGORIES.map(({ label, color, skills }) => (
                    <div key={label} className="rounded-lg px-4 py-3" style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
                      <p className="font-mono text-xs font-semibold mb-0.5" style={{ color }}>{label}</p>
                      <p className="font-sans text-xs text-text-dim">{skills}</p>
                    </div>
                  ))}
                </div>

                <p className="font-sans text-xs text-text-dim leading-relaxed mb-4">
                  When you submit a rating you can also choose a <strong className="text-text-primary">Featured Skill</strong> — one
                  attribute that highlights your take. This appears next to your name in the Activity feed.
                </p>

                <Link href="/players" className="eyebrow btn-paper rounded-md px-4 py-2 inline-block" style={{ fontSize: 10 }}>
                  Browse Players →
                </Link>
              </div>

              {/* Live radar */}
              <div>
                <RadarChart
                  ratings={DEMO_PLAYER_A}
                  playerName="Community Average"
                  ratingCount={47}
                />
              </div>
            </div>
          </Section>

          {/* ── 2. Review Matches ─────────────────────────────────────────── */}
          <Section id="review-matches" num="02" title="Review Matches">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-4">
                  Every match in the database can be reviewed. A review consists of three <strong className="text-text-primary">1.0 – 10.0</strong> scores:
                </p>
                <ul className="space-y-2 mb-5">
                  {[
                    { label: "Match Quality",  color: "#f5c518", desc: "How good was the match itself? Tension, quality, spectacle."     },
                    { label: "Player 1 Perf.", color: "#22d68a", desc: "How well did Player 1 play, irrespective of result."            },
                    { label: "Player 2 Perf.", color: "#4a9eff", desc: "How well did Player 2 play, irrespective of result."            },
                  ].map(({ label, color, desc }) => (
                    <li key={label} className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: color }} />
                      <div>
                        <span className="font-mono text-xs font-semibold" style={{ color }}>{label}</span>
                        <span className="font-sans text-xs text-text-dim ml-2">{desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="font-sans text-xs text-text-dim leading-relaxed mb-4">
                  You can also add a written comment, mark the match as a <strong className="text-text-primary">Favourite</strong> (it appears
                  on your profile), and track how many sets you watched. One review per user per match — you
                  can edit it any time.
                </p>
                <Link href="/matches" className="eyebrow transition-colors duration-150" style={{ fontSize: 10, color: "#c9a96a" }}>
                  Browse Matches →
                </Link>
              </div>
              <ReviewMockup />
            </div>
          </Section>

          {/* ── 3. Reactions & Comments ───────────────────────────────────── */}
          <Section id="reactions" num="03" title="Reactions & Comments">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-5">
                  Every review and comment has three reaction buttons — <strong className="text-text-primary">Fire</strong>,{" "}
                  <strong className="text-text-primary">Surprised</strong>, and <strong className="text-text-primary">Disagree</strong>. Tap to react, tap again to undo.
                  Counts are always visible so you can see how the community responded.
                </p>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-5">
                  Below each review is a <strong className="text-text-primary">comment thread</strong> — one level deep.
                  You can reply to the original review or to another comment. Comments also have their own reactions.
                </p>
                <p className="font-sans text-xs text-text-dim">
                  You need to be signed in to react or comment. Guests can read everything.
                </p>
              </div>
              <CommentMockup />
            </div>
          </Section>

          {/* ── 4. Your Profile ───────────────────────────────────────────── */}
          <Section id="your-profile" num="04" title="Your Profile">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-4">
                  Your profile page is your public tennis catalogue. It shows your review history,
                  skill ratings, favourite matches, collections, trophy case, and who you follow.
                </p>
                <div className="space-y-3 mb-5">
                  {[
                    { title: "Display Name",     desc: "Set any name — alias, nickname, or real name — that shows on reviews, comments, and in the feed. Changing it updates all your past posts instantly."  },
                    { title: "Avatar",            desc: "Choose from Initials, Tennis Ball, Racquet, or Net — each with 7 background colours and 7 icon colours."                                                },
                    { title: "Customize Layout",  desc: "Reorder the sections on your profile, hide ones you don't want, and pick display variants (carousel vs grid, cards vs compact list)."                   },
                    { title: "Collections",       desc: "When logging a watched match you can assign it to a named collection. Collections appear as folders on your profile."                                   },
                  ].map(({ title, desc }) => (
                    <div key={title} className="rounded-lg p-3" style={{ background: "rgba(236,229,216,0.02)", border: "1px solid rgba(236,229,216,0.06)" }}>
                      <p className="font-mono text-xs font-semibold text-text-primary mb-1">{title}</p>
                      <p className="font-sans text-xs text-text-dim leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="eyebrow mb-3 text-[10px] text-text-dim">Avatar Templates</p>
                  <AvatarGridMockup />
                </div>
                <div
                  className="rounded-xl p-4"
                  style={{ background: "rgba(236,229,216,0.02)", border: "1px solid rgba(236,229,216,0.07)" }}
                >
                  <p className="eyebrow mb-3 text-[10px] text-text-dim">Profile Sections</p>
                  {["Favorites", "Trophy Case", "Featured Comments", "Collections", "Recent Activity", "All Reviews"].map((s, i) => (
                    <div key={s} className="flex items-center gap-2 py-1.5" style={{ borderBottom: i < 5 ? "1px solid rgba(236,229,216,0.04)" : "none" }}>
                      <div className="w-3.5 h-3.5 rounded flex flex-col justify-center gap-0.5 shrink-0">
                        <div className="h-0.5 rounded-full bg-[rgba(236,229,216,0.18)]" />
                        <div className="h-0.5 rounded-full bg-[rgba(236,229,216,0.18)]" />
                      </div>
                      <span className="font-sans text-xs text-text-mid">{s}</span>
                      <span className="ml-auto font-mono text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,214,138,0.1)", color: "#22d68a" }}>Visible</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── 5. Compare & H2H ──────────────────────────────────────────── */}
          <Section id="compare" num="05" title="Compare & H2H">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-4">
                  Any two players can be compared head to head. The H2H page overlays both community
                  radars on the same chart so you can see where each player is rated higher.
                </p>
                <div className="space-y-3 mb-5">
                  {[
                    { label: "Radar Overlay",    desc: "Two translucent polygons — green for Player 1, cyan for Player 2 — showing where each excels."  },
                    { label: "Win/Loss Record",  desc: "All-time head-to-head wins, sets won, and win percentage side by side."                          },
                    { label: "Surface Split",    desc: "H2H records broken down by Hard, Clay, and Grass separately."                                    },
                    { label: "Match History",    desc: "Scrollable list of every match between the two, with scores, tournament, and surface."           },
                  ].map(({ label, desc }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ background: "#4a9eff" }} />
                      <div>
                        <span className="font-mono text-xs font-semibold text-text-primary">{label} — </span>
                        <span className="font-sans text-xs text-text-dim">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="font-sans text-xs text-text-dim mb-4">
                  Reach H2H from any player&apos;s profile page via the <strong className="text-text-primary">H2H button</strong>, or from the Compare link in the nav.
                </p>
              </div>

              {/* Live compare radar */}
              <div>
                <RadarChart
                  ratings={DEMO_PLAYER_A}
                  playerName="Player A"
                  compareRatings={DEMO_PLAYER_B}
                  comparePlayerName="Player B"
                  ratingCount={38}
                />
              </div>
            </div>
          </Section>

          {/* ── 6. Activity Feed ──────────────────────────────────────────── */}
          <Section id="activity-feed" num="06" title="Activity Feed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-4">
                  The <strong className="text-text-primary">Activity</strong> tab in the nav is the community pulse. Every review posted and every
                  player rated appears here in real time.
                </p>
                <div className="space-y-3 mb-5">
                  {[
                    { label: "Following tab",     color: "#22d68a", desc: "Only shows activity from people you follow — your personal feed."           },
                    { label: "Everyone tab",      color: "#4a9eff", desc: "All community activity. Good for discovering new players and opinions."     },
                    { label: "Trending Players",  color: "#9ca3af", desc: "Most-rated players over the last 14 days, ranked by community attention."   },
                    { label: "Top 25 Clashes",    color: "#4a9eff", desc: "Recent matches where both players were ranked in the top 25."               },
                    { label: "Hot Matches",       color: "#c9a96a", desc: "Most-reviewed matches in the last 14 days. Flame count scales with reviews × rating." },
                  ].map(({ label, color, desc }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ background: color }} />
                      <div>
                        <span className="font-mono text-xs font-semibold" style={{ color }}>{label} — </span>
                        <span className="font-sans text-xs text-text-dim">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/feed" className="eyebrow transition-colors duration-150" style={{ fontSize: 10, color: "#c9a96a" }}>
                  Go to Activity Feed →
                </Link>
              </div>
              <FeedMockup />
            </div>
          </Section>

          {/* ── 7. Search ─────────────────────────────────────────────────── */}
          <Section id="search" num="07" title="Search">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-4">
                  Press <kbd className="font-mono text-xs px-1.5 py-0.5 rounded border" style={{ borderColor: "rgba(236,229,216,0.15)", background: "rgba(236,229,216,0.06)", color: "#9ca3af" }}>⌘K</kbd>{" "}
                  (or <kbd className="font-mono text-xs px-1.5 py-0.5 rounded border" style={{ borderColor: "rgba(236,229,216,0.15)", background: "rgba(236,229,216,0.06)", color: "#9ca3af" }}>Ctrl+K</kbd> on Windows)
                  from anywhere to open the global search. The search icon in the nav also opens it.
                </p>
                <div className="space-y-2 mb-5">
                  {[
                    { label: "Players",  desc: "Search by player name. Results show country flag and ATP/WTA rank."        },
                    { label: "Members",  desc: "Search by display name or username to find other Courtside fans."          },
                  ].map(({ label, desc }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2 bg-[rgba(236,229,216,0.3)]" />
                      <div>
                        <span className="font-mono text-xs font-semibold text-text-primary">{label} — </span>
                        <span className="font-sans text-xs text-text-dim">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="font-sans text-xs text-text-dim">
                  Use <strong className="text-text-primary">↑ ↓</strong> to navigate results, <strong className="text-text-primary">Enter</strong> to open, <strong className="text-text-primary">Esc</strong> to close.
                </p>
              </div>
              <SearchMockup />
            </div>
          </Section>

          {/* ── 8. Trophies ───────────────────────────────────────────────── */}
          <Section id="trophies" num="08" title="Trophies">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <p className="font-sans text-sm text-text-mid leading-relaxed mb-5">
                  Trophies are earned automatically as you contribute to Courtside. They appear in your
                  profile&apos;s Trophy Case and can be shown or hidden via the Customize Layout page.
                  There are four rarity tiers:
                </p>
                <div className="space-y-3">
                  {TROPHY_TIERS.map(({ tier, color, description }) => (
                    <div key={tier} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ background: `${color}0a`, border: `1px solid ${color}22` }}>
                      <span className="font-mono text-xs font-bold shrink-0 mt-0.5" style={{ color }}>{tier}</span>
                      <span className="font-sans text-xs text-text-dim">{description}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="rounded-xl p-6"
                style={{ background: "rgba(236,229,216,0.02)", border: "1px solid rgba(236,229,216,0.07)" }}
              >
                <p className="eyebrow mb-5 text-[10px] text-text-dim">Trophy Case Preview</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "First Rating",    color: "#9ca3af", tier: "Common"   },
                    { label: "Dedicated Fan",   color: "#22d68a", tier: "Uncommon" },
                    { label: "Match Analyst",   color: "#22d68a", tier: "Uncommon" },
                    { label: "Radar Expert",    color: "#4a9eff", tier: "Rare"     },
                    { label: "Top Reviewer",    color: "#4a9eff", tier: "Rare"     },
                    { label: "Grail Collector", color: "#f5c518", tier: "Grail"    },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          background: `${color}12`,
                          border:     `1px solid ${color}30`,
                          boxShadow:  `0 0 12px ${color}20`,
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={color} fillOpacity="0.8"/>
                        </svg>
                      </div>
                      <span className="font-mono text-[9px] text-text-dim text-center leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Bottom CTA ──────────────────────────────────────────────── */}
          <div className="py-12 text-center">
            <p className="bill-name italic mb-6" style={{ fontWeight: 300, fontSize: 16, color: "rgba(236,229,216,0.6)" }}>Ready to build your catalogue?</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/players" className="eyebrow btn-paper rounded-md px-6 py-3" style={{ fontSize: 11 }}>
                Rate a Player
              </Link>
              <Link href="/matches" className="eyebrow btn-ghost rounded-md px-6 py-3" style={{ fontSize: 11 }}>
                Review a Match
              </Link>
              <Link href="/sign-up" className="eyebrow btn-ghost rounded-md px-6 py-3" style={{ fontSize: 11 }}>
                Create Account
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
