import Link from "next/link";
import Image from "next/image";
import CountryFlag from "@/components/CountryFlag";
import type { Player } from "@/types";
import type { TopSkill } from "@/lib/skillMeta";

// Surface-form stats the card needs (structurally compatible with the
// PlayerStats computed on the players page).
export interface PlayerCardStats {
  totalMatches: number;
  hardWins: number;  hardTotal: number;
  clayWins: number;  clayTotal: number;
  grassWins: number; grassTotal: number;
}

const SURFACE_META = {
  hard:  { label: "hard",  color: "#4a90d9" },
  clay:  { label: "clay",  color: "#d4734e" },
  grass: { label: "grass", color: "#5cb85c" },
} as const;

// Portrait ring carries rank tier: top 10 gold, top 50 silver, else hairline.
function portraitRing(rank: number | null | undefined): string {
  if (rank && rank <= 10) return "2px solid rgba(201,169,106,0.85)";
  if (rank && rank <= 50) return "2px solid rgba(192,192,192,0.55)";
  return "2px solid rgba(236,229,216,0.2)";
}

function rankColor(rank: number | null | undefined): string {
  if (rank && rank <= 10) return "#c9a96a";
  if (rank && rank <= 50) return "rgba(192,192,192,0.85)";
  return "rgba(236,229,216,0.45)";
}

// Best surface by win% (only surfaces with at least 3 matches qualify, so a
// 1–0 record doesn't masquerade as "100%").
function bestSurface(s: PlayerCardStats) {
  const rows = [
    { key: "hard"  as const, wins: s.hardWins,  total: s.hardTotal  },
    { key: "clay"  as const, wins: s.clayWins,  total: s.clayTotal  },
    { key: "grass" as const, wins: s.grassWins, total: s.grassTotal },
  ].filter((r) => r.total >= 3);
  if (rows.length === 0) return null;
  const best = rows.reduce((a, b) =>
    b.wins / b.total > a.wins / a.total ? b : a
  );
  return {
    ...SURFACE_META[best.key],
    pct: Math.round((best.wins / best.total) * 100),
  };
}

function Chip({
  children, color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="font-mono inline-flex items-center gap-1.5 shrink-0"
      style={{
        fontSize: 10,
        letterSpacing: "0.04em",
        padding: "3px 8px",
        borderRadius: 20,
        border: `0.5px solid ${color ? `${color}55` : "rgba(236,229,216,0.16)"}`,
        color: color ?? "rgba(236,229,216,0.7)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function PlayerCard({
  player,
  stats,
  topSkills,
  reviewExcerpt,
}: {
  player: Player;
  stats: PlayerCardStats | null;
  topSkills: TopSkill[];
  reviewExcerpt: string | null;
}) {
  const surface = stats ? bestSurface(stats) : null;
  const slamWins = (player.career_stats?.slam_wins ?? null) as Record<string, number> | null;
  const slamCount = slamWins ? Object.values(slamWins).reduce((a, b) => a + (b || 0), 0) : 0;
  const isRated = topSkills.length > 0;
  const photo = player.photo_url ?? player.image_url ?? null;

  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center gap-4 transition-colors duration-150"
      style={{
        padding: "14px 14px",
        border: "0.5px solid var(--hairline-soft)",
        borderRadius: 12,
        background: "rgba(236,229,216,0.018)",
        marginTop: 10,
      }}
    >
      {/* Portrait */}
      <div
        className="rounded-full overflow-hidden shrink-0 flex items-center justify-center"
        style={{
          width: 60, height: 60,
          border: portraitRing(player.current_rank),
          background: "rgba(236,229,216,0.05)",
        }}
      >
        {photo ? (
          <Image
            src={photo}
            alt={player.name}
            width={60}
            height={60}
            className="w-full h-full object-cover object-top"
            unoptimized
          />
        ) : (
          <span className="bill-name" style={{ fontSize: 20, color: "rgba(236,229,216,0.45)" }}>
            {player.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        )}
      </div>

      {/* Name + chips + excerpt */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="bill-name truncate" style={{ fontSize: 20, color: "#ece5d8" }}>
            {player.name}
          </span>
          {player.country && (
            <span className="flex items-center gap-1.5 shrink-0">
              <CountryFlag code={player.country} size={20} />
              <span className="font-mono hidden sm:inline" style={{ fontSize: 10, color: "rgba(236,229,216,0.4)", letterSpacing: "0.08em" }}>
                {player.country}
              </span>
            </span>
          )}
        </div>

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {isRated
            ? topSkills.map((sk) => (
                <Chip key={sk.key} color={sk.color}>
                  {sk.label} {sk.value.toFixed(1)}
                </Chip>
              ))
            : null}
          {surface && (
            <Chip color={isRated ? undefined : surface.color}>
              {surface.pct}% on {surface.label}
            </Chip>
          )}
          {!isRated && stats && stats.totalMatches > 0 && (
            <Chip>{stats.totalMatches} matches</Chip>
          )}
        </div>

        {reviewExcerpt && (
          <p
            className="bill-name italic truncate mt-2"
            style={{ fontWeight: 300, fontSize: 13, color: "rgba(236,229,216,0.55)" }}
          >
            &ldquo;{reviewExcerpt}&rdquo;
          </p>
        )}
      </div>

      {/* Right rail — rank + honours / nudge */}
      <div className="text-right shrink-0">
        {player.current_rank ? (
          <div className="font-mono" style={{ fontSize: 18, fontWeight: 600, color: rankColor(player.current_rank) }}>
            No. {player.current_rank}
          </div>
        ) : null}
        {slamCount > 0 ? (
          <div className="font-mono" style={{ fontSize: 11, color: "rgba(201,169,106,0.8)", marginTop: 4, letterSpacing: "0.1em" }}>
            {"✦".repeat(Math.min(slamCount, 4))} {slamCount} slam{slamCount !== 1 ? "s" : ""}
          </div>
        ) : !isRated ? (
          <div className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.35)", marginTop: 5 }}>
            be the first to rate
          </div>
        ) : null}
      </div>
    </Link>
  );
}
