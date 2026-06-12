/**
 * components/trophies/TrophyDecals.tsx
 *
 * Miniature stroke-drawn trophy silhouettes for the profile honours row,
 * trophy case, and anywhere a title deserves a mark. One per Grand Slam —
 * each mimics the real trophy's distinguishing shape — plus a smaller,
 * quieter generic cup for Masters 1000 titles.
 *
 *   Australian Open — squat lidded loving cup (Norman Brookes Cup)
 *   Roland Garros   — wide shallow bowl on a stem (Coupe des Mousquetaires)
 *   Wimbledon       — tall cup with ball finial (the "pineapple")
 *   US Open         — cup with oversized loop handles
 *   Masters         — plain small cup, muted gold
 *
 * Color comes from `currentColor`, so wrap or style with a text color
 * (gold #c9a96a in honours contexts). Size = rendered height in px.
 */

interface TrophyProps {
  size?: number;
  className?: string;
  title?: string;
}

function svgProps(size: number, title: string | undefined, className?: string) {
  return {
    viewBox: "0 0 24 22",
    width: Math.round(size * (24 / 22)),
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    role: "img" as const,
    "aria-label": title,
  };
}

export function AustralianOpenTrophy({ size = 20, className, title = "Australian Open title" }: TrophyProps) {
  return (
    <svg {...svgProps(size, title, className)}>
      <circle cx="12" cy="2.6" r="1" />
      <path d="M7.5 6 Q12 2.8 16.5 6" />
      <path d="M7 6.3 H17" />
      <path d="M7.5 6.6 C7.5 11.5 9 13.5 12 13.5 C15 13.5 16.5 11.5 16.5 6.6" />
      <path d="M7.5 7.6 C4.6 8.2 4.8 11 7.9 11.3" />
      <path d="M16.5 7.6 C19.4 8.2 19.2 11 16.1 11.3" />
      <path d="M12 13.5 V16" />
      <path d="M9.6 16 H14.4 L15.4 18.6 H8.6 Z" />
    </svg>
  );
}

export function RolandGarrosTrophy({ size = 20, className, title = "Roland Garros title" }: TrophyProps) {
  return (
    <svg {...svgProps(size, title, className)}>
      <path d="M4.5 7.5 H19.5" />
      <path d="M4.5 7.5 C5.5 12.5 8.5 14 12 14 C15.5 14 18.5 12.5 19.5 7.5" />
      <path d="M4.5 7.5 C3.2 6.2 3.8 4.8 5.8 5.6" />
      <path d="M19.5 7.5 C20.8 6.2 20.2 4.8 18.2 5.6" />
      <path d="M12 14 V16.2" />
      <path d="M9.6 16.2 H14.4 L15.4 18.6 H8.6 Z" />
    </svg>
  );
}

export function WimbledonTrophy({ size = 20, className, title = "Wimbledon title" }: TrophyProps) {
  return (
    <svg {...svgProps(size, title, className)}>
      <circle cx="12" cy="2.2" r="1.1" />
      <path d="M9 7 Q12 3.6 15 7" />
      <path d="M8.4 7.3 H15.6" />
      <path d="M8.6 7.6 C8.6 12.6 10 14.6 12 14.6 C14 14.6 15.4 12.6 15.4 7.6" />
      <path d="M8.6 8.4 C5.8 9.4 6.2 12.4 9.2 12.8" />
      <path d="M15.4 8.4 C18.2 9.4 17.8 12.4 14.8 12.8" />
      <path d="M12 14.6 V16.4" />
      <path d="M9.8 16.4 H14.2 L15.1 18.6 H8.9 Z" />
    </svg>
  );
}

export function USOpenTrophy({ size = 20, className, title = "US Open title" }: TrophyProps) {
  return (
    <svg {...svgProps(size, title, className)}>
      <circle cx="12" cy="3" r="0.9" />
      <path d="M9 5.6 Q12 4 15 5.6" />
      <path d="M8 6 H16" />
      <path d="M8.2 6.3 C8.2 11.3 9.6 13.3 12 13.3 C14.4 13.3 15.8 11.3 15.8 6.3" />
      <path d="M8.2 7 C3.8 6.2 3.8 12 8.8 11.6" />
      <path d="M15.8 7 C20.2 6.2 20.2 12 15.2 11.6" />
      <path d="M12 13.3 V16" />
      <path d="M9.6 16 H14.4 L15.4 18.6 H8.6 Z" />
    </svg>
  );
}

export function MastersTrophy({ size = 16, className, title = "Masters 1000 title" }: TrophyProps) {
  return (
    <svg {...svgProps(size, title, className)}>
      <path d="M8 6 H16" />
      <path d="M8.2 6.3 C8.2 10.5 9.6 12.3 12 12.3 C14.4 12.3 15.8 10.5 15.8 6.3" />
      <path d="M8.2 7 C6 7.4 6.2 10 8.6 10.3" />
      <path d="M15.8 7 C18 7.4 17.8 10 15.4 10.3" />
      <path d="M12 12.3 V15" />
      <path d="M9.8 15 H14.2 L15 17.4 H9 Z" />
    </svg>
  );
}

/**
 * Map from career_stats.slam_wins keys (API tournament names) to the
 * matching trophy component. "French Open" is the API's alternate name
 * for Roland Garros.
 */
export const SLAM_TROPHIES: Record<
  string,
  (props: TrophyProps) => React.JSX.Element
> = {
  "Australian Open": AustralianOpenTrophy,
  "Roland Garros":   RolandGarrosTrophy,
  "French Open":     RolandGarrosTrophy,
  "Wimbledon":       WimbledonTrophy,
  "US Open":         USOpenTrophy,
};

/** Display order for honours rows — calendar order */
export const SLAM_ORDER = ["Australian Open", "Roland Garros", "French Open", "Wimbledon", "US Open"];
