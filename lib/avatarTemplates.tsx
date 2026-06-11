// Avatar template system — SVG icons + color palettes for profile avatars

export type AvatarTemplate = "initials" | "ball" | "racquet" | "net";

export interface AvatarConfig {
  template: AvatarTemplate;
  bgColor:  string;
  fgColor:  string;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  template: "initials",
  bgColor:  "#0e1116",
  fgColor:  "#22d68a",
};

export const AVATAR_TEMPLATES = [
  { key: "initials" as const, label: "Initials"  },
  { key: "ball"     as const, label: "Ball"       },
  { key: "racquet"  as const, label: "Racquet"    },
  { key: "net"      as const, label: "Net"        },
];

export const BG_COLORS = [
  { key: "midnight", label: "Midnight", value: "#0e1116" },
  { key: "forest",   label: "Forest",   value: "#0b1f12" },
  { key: "navy",     label: "Navy",     value: "#0b1222" },
  { key: "clay",     label: "Clay",     value: "#1e0e07" },
  { key: "plum",     label: "Plum",     value: "#14081e" },
  { key: "slate",    label: "Slate",    value: "#111820" },
  { key: "graphite", label: "Graphite", value: "#1c1c1c" },
] as const;

export const FG_COLORS = [
  { key: "green",  label: "Green",  value: "#22d68a" },
  { key: "blue",   label: "Blue",   value: "#4a9eff" },
  { key: "amber",  label: "Amber",  value: "#f5c518" },
  { key: "coral",  label: "Coral",  value: "#d4734e" },
  { key: "purple", label: "Purple", value: "#a78bfa" },
  { key: "red",    label: "Red",    value: "#e74c3c" },
  { key: "white",  label: "White",  value: "#e8eaed" },
] as const;

// ── SVG Icons ─────────────────────────────────────────────────────────────────
// Each component: transparent bg, viewBox 0 0 100 100
// The wrapper div supplies the background color circle.

export function BallSVG({ fg, bg, size }: { fg: string; bg: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {/* Ball body */}
      <circle cx="50" cy="50" r="44" fill={fg} />
      {/* Seam — two mirrored S-curves, bg color over the fill */}
      <path
        d="M6 50 C6 24, 28 8, 50 50 C72 92, 94 76, 94 50"
        stroke={bg} strokeWidth="7" strokeLinecap="round" fill="none"
      />
      <path
        d="M6 50 C6 76, 28 92, 50 50 C72 8, 94 24, 94 50"
        stroke={bg} strokeWidth="7" strokeLinecap="round" fill="none"
      />
    </svg>
  );
}

export function RacquetSVG({ fg, bg, size }: { fg: string; bg: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {/* Oval head outline */}
      <ellipse cx="50" cy="37" rx="23" ry="28" stroke={fg} strokeWidth="5" fill="none" />
      {/* Horizontal strings */}
      <line x1="31" y1="29" x2="69" y2="29" stroke={fg} strokeWidth="2.5" />
      <line x1="28" y1="37" x2="72" y2="37" stroke={fg} strokeWidth="2.5" />
      <line x1="31" y1="45" x2="69" y2="45" stroke={fg} strokeWidth="2.5" />
      {/* Vertical strings */}
      <line x1="40" y1="11" x2="40" y2="63" stroke={fg} strokeWidth="2.5" />
      <line x1="50" y1="9"  x2="50" y2="65" stroke={fg} strokeWidth="2.5" />
      <line x1="60" y1="11" x2="60" y2="63" stroke={fg} strokeWidth="2.5" />
      {/* Throat */}
      <path d="M43 65 L44 76 L56 76 L57 65" fill={fg} />
      {/* Handle */}
      <rect x="44" y="76" width="12" height="16" rx="4" fill={fg} />
      {/* Grip wrap bands */}
      <rect x="44" y="80" width="12" height="2.5" rx="1" fill={bg} opacity="0.35" />
      <rect x="44" y="85" width="12" height="2.5" rx="1" fill={bg} opacity="0.35" />
      <rect x="44" y="90" width="12" height="2.5" rx="1" fill={bg} opacity="0.35" />
    </svg>
  );
}

export function NetSVG({ fg, bg: _bg, size }: { fg: string; bg: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {/* Left post */}
      <rect x="9"  y="26" width="8" height="55" rx="4" fill={fg} />
      {/* Right post */}
      <rect x="83" y="26" width="8" height="55" rx="4" fill={fg} />
      {/* Top cable — slight sag */}
      <path d="M17 30 Q50 42 83 30" stroke={fg} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Horizontal net lines */}
      <line x1="17" y1="49" x2="83" y2="49" stroke={fg} strokeWidth="2"   />
      <line x1="17" y1="59" x2="83" y2="59" stroke={fg} strokeWidth="2"   />
      <line x1="17" y1="69" x2="83" y2="69" stroke={fg} strokeWidth="2"   />
      <line x1="17" y1="79" x2="83" y2="79" stroke={fg} strokeWidth="2"   />
      {/* Vertical net lines */}
      <line x1="30" y1="40" x2="30" y2="81" stroke={fg} strokeWidth="1.5" />
      <line x1="43" y1="42" x2="43" y2="81" stroke={fg} strokeWidth="1.5" />
      <line x1="57" y1="42" x2="57" y2="81" stroke={fg} strokeWidth="1.5" />
      <line x1="70" y1="40" x2="70" y2="81" stroke={fg} strokeWidth="1.5" />
      {/* Ground bar */}
      <rect x="7" y="79" width="86" height="6" rx="3" fill={fg} opacity="0.4" />
    </svg>
  );
}
