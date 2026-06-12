import { getTournamentTier, TIER_STYLES, type TournamentTier } from "@/lib/tournamentTiers";

interface Props {
  tournamentName: string;
  /** If you already know the tier (e.g. from a DB column), pass it directly */
  tier?: TournamentTier;
  size?: "sm" | "md";
}

/**
 * Renders a visual tier badge for Grand Slams and Masters 1000 events.
 * Returns null for regular tournaments — callers don't need to check.
 *
 * Usage:
 *   <TournamentBadge tournamentName={match.tournament} />
 *   <TournamentBadge tournamentName={match.tournament} tier={match.tournament_tier} />
 */
export default function TournamentBadge({ tournamentName, tier, size = "sm" }: Props) {
  const resolvedTier = tier ?? getTournamentTier(tournamentName);
  const style = TIER_STYLES[resolvedTier];

  if (!style) return null;

  const isSlam = resolvedTier === "grand_slam";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-mono font-semibold leading-none"
      style={{
        fontSize:   size === "md" ? "11px" : "9px",
        padding:    size === "md" ? "3px 8px" : "2px 6px",
        color:      style.color,
        background: style.background,
        border:     style.border,
        boxShadow:  style.glow,
      }}
    >
      {/* Icon */}
      {isSlam ? (
        // Gold crown SVG
        <svg
          width={size === "md" ? 11 : 9}
          height={size === "md" ? 11 : 9}
          viewBox="0 0 16 16"
          fill={style.color}
        >
          <path d="M2 13h12v1.5H2V13zm0-1.5L4.5 5l3.5 3 3.5-5L14 11.5H2z" />
        </svg>
      ) : (
        // Silver trophy SVG
        <svg
          width={size === "md" ? 10 : 8}
          height={size === "md" ? 10 : 8}
          viewBox="0 0 16 16"
          fill={style.color}
        >
          <path d="M5 1h6v5a3 3 0 0 1-6 0V1zm-3 1h2v2.5A5.01 5.01 0 0 1 5 7.9V9H7v2H5v2h6v-2h-2V9h2V7.9A5.01 5.01 0 0 1 12 4.5V2h2V1h-2V0H4v1H2v1z" />
        </svg>
      )}
      {style.label}
    </span>
  );
}
