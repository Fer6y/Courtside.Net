/**
 * CourtsideMark — the brand tennis-ball mark, turned so the seam reads as a "C".
 *
 * Drawn as fine line-art for the Programme aesthetic: a cream ball outline over
 * a barely-there muted-sage fill, with a gold seam curving open to the right to
 * form the "C". No neon, no glow — engraved, not lit. Pure SVG, no interactivity.
 */
export default function CourtsideMark({
  size = 72,
  className,
  gradientId = "csmark-fill",
}: {
  size?: number;
  className?: string;
  /** Unique per instance — two marks on one page can't share a gradient id. */
  gradientId?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Courtside"
    >
      <defs>
        {/* Muted sage fill — reads as a tennis ball without the neon. */}
        <radialGradient id={gradientId} cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="rgba(170,205,150,0.16)" />
          <stop offset="100%" stopColor="rgba(150,185,140,0.03)" />
        </radialGradient>
      </defs>

      {/* Ball body */}
      <circle
        cx="32"
        cy="32"
        r="27.5"
        fill={`url(#${gradientId})`}
        stroke="rgba(236,229,216,0.55)"
        strokeWidth="1"
      />

      {/* Gold seam — a tight "C" whose belly curves in toward the centre,
         still reaching top and bottom so it reads as a tennis seam */}
      <path
        d="M 42 11 C 19 20, 19 44, 42 53"
        stroke="#c9a96a"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Faint companion seam — the tennis ball's double curve */}
      <path
        d="M 46 13 C 26 21, 26 43, 46 51"
        stroke="rgba(236,229,216,0.22)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
