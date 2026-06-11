// Trophy case component — shows Grand Slam titles on player profiles

const SLAMS = [
  { key: "Australian Open", short: "AO",   color: "#4a90d9" },
  { key: "Roland Garros",   short: "RG",   color: "#d4734e" },
  { key: "Wimbledon",       short: "W",    color: "#5cb85c" },
  { key: "US Open",         short: "USO",  color: "#f5c518" },
] as const;

type SlamWins = Partial<Record<string, number>>;

function TrophyIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cup body */}
      <path
        d="M8 4h16v12a8 8 0 0 1-16 0V4z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Handles */}
      <path d="M8 7H5a3 3 0 0 0 0 6h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 7h3a3 3 0 0 1 0 6h-3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Stem */}
      <path d="M16 20v6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Base */}
      <rect x="10" y="26" width="12" height="3" rx="1.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" />
      {/* Shine */}
      <path d="M12 7v5" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  );
}

export default function PlayerTrophyCase({ slamWins }: { slamWins: SlamWins }) {
  const earned = SLAMS.filter((s) => (slamWins[s.key] ?? 0) > 0);
  if (earned.length === 0) return null;

  const total = earned.reduce((sum, s) => sum + (slamWins[s.key] ?? 0), 0);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 mb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-text-dim">
          Grand Slam Titles
        </h2>
        <span className="font-mono text-xs text-text-dim">
          {total} {total === 1 ? "title" : "titles"}
        </span>
      </div>

      {/* Trophy badges */}
      <div className="flex flex-wrap gap-3">
        {earned.map((slam) => {
          const count = slamWins[slam.key] ?? 0;
          return (
            <div
              key={slam.key}
              className="flex flex-col items-center gap-2 rounded-xl px-5 py-4 min-w-[100px]"
              style={{
                background: `${slam.color}08`,
                border: `1px solid ${slam.color}30`,
              }}
            >
              <TrophyIcon color={slam.color} />
              <span
                className="font-mono text-xs font-semibold text-center leading-tight"
                style={{ color: "#f5c518" }}
              >
                {slam.key}
              </span>
              <span
                className="font-mono text-2xl font-bold leading-none"
                style={{ color: slam.color }}
              >
                ×{count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
