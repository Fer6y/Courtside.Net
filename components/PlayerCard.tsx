import Link from "next/link";
import Image from "next/image";
import CountryFlag from "@/components/CountryFlag";
import type { Player } from "@/types";
import type { TopSkill } from "@/lib/skillMeta";

// Card-form stats (structurally compatible with the PlayerStats computed on
// the players page). We intentionally do NOT surface a win% here: our match
// catalogue only spans 2020-onward, so a per-surface win rate is not a career
// figure and reads as a false claim for anyone with a small recent sample
// (e.g. a returning or retired player). Match count is honestly ours.
export interface PlayerCardStats {
  totalMatches: number;
}

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
  const slamWins = (player.career_stats?.slam_wins ?? null) as Record<string, number> | null;
  const slamCount = slamWins ? Object.values(slamWins).reduce((a, b) => a + (b || 0), 0) : 0;
  const isRated = topSkills.length > 0;
  const photo = player.photo_url ?? player.image_url ?? null;

  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center gap-3 sm:gap-4 transition-colors duration-150"
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
        className="rounded-full overflow-hidden shrink-0 flex items-center justify-center w-12 h-12 sm:w-[60px] sm:h-[60px]"
        style={{
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

      {/* Content — rank leads the line so it reads as a ranked list; no
          marooned right rail (that left a big empty gap mid-pill on mobile). */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-x-2 gap-y-1 flex-wrap min-w-0">
          {player.current_rank ? (
            <span
              className="font-mono shrink-0 text-[13px] sm:text-[15px]"
              style={{ fontWeight: 600, color: rankColor(player.current_rank), letterSpacing: "0.02em" }}
            >
              No. {player.current_rank}
            </span>
          ) : null}
          <span className="bill-name truncate min-w-0 text-[17px] sm:text-[20px]" style={{ color: "#ece5d8" }}>
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
          {slamCount > 0 && (
            <span
              className="font-mono shrink-0 whitespace-nowrap"
              style={{ fontSize: 11, color: "rgba(201,169,106,0.85)", letterSpacing: "0.1em" }}
            >
              ✦ {slamCount}
            </span>
          )}
        </div>

        <div className="flex gap-1.5 mt-2 flex-wrap items-center">
          {isRated
            ? topSkills.map((sk) => (
                <Chip key={sk.key} color={sk.color}>
                  {sk.label} {sk.value.toFixed(1)}
                </Chip>
              ))
            : null}
          {stats && stats.totalMatches > 0 && (
            <Chip>{stats.totalMatches} matches</Chip>
          )}
          {!isRated && (
            <span className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.4)" }}>
              be the first to rate
            </span>
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
    </Link>
  );
}
