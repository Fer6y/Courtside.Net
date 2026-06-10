"use client";

import { useEffect, useState } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────

const CX = 300;
const CY = 300;
const GRID_RADIUS = 200;
const LABEL_RADIUS = GRID_RADIUS * 1.18;     // 236 — skill label ring
const CATEGORY_RADIUS = GRID_RADIUS * 1.38;  // 276 — category label ring

// Quadrant boundaries (degrees clockwise from 12 o'clock)
// Mental:    315° → 45°  (centered at   0° / 12 o'clock)
// Technique:  45° → 135° (centered at  90° /  3 o'clock)
// Skill:     135° → 225° (centered at 180° /  6 o'clock)
// Movement:  225° → 315° (centered at 270° /  9 o'clock)

const CATEGORIES = [
  {
    name: "MENTAL",
    startAngle: 315,
    skills: [
      { key: "focus",           label: "Focus"       },
      { key: "clutch",          label: "Clutch"      },
      { key: "resilience",      label: "Resilience"  },
      { key: "processing_time", label: "Proc. Time"  },
    ],
  },
  {
    name: "TECHNIQUE",
    startAngle: 45,
    skills: [
      { key: "serve",        label: "Serve"        },
      { key: "forehand",     label: "Forehand"     },
      { key: "backhand",     label: "Backhand"     },
      { key: "shot_variety", label: "Shot Variety" },
    ],
  },
  {
    name: "SKILL",
    startAngle: 135,
    skills: [
      { key: "net_play",      label: "Net Play"    },
      { key: "touch",         label: "Touch"       },
      { key: "return_play",   label: "Ret. Play"   },
      { key: "reaction_time", label: "React. Time" },
      { key: "deception",     label: "Deception"   },
    ],
  },
  {
    name: "MOVEMENT",
    startAngle: 225,
    skills: [
      { key: "speed",          label: "Speed"        },
      { key: "court_coverage", label: "Coverage"     },
      { key: "positioning",    label: "Positioning"  },
      { key: "anticipation",   label: "Anticipation" },
    ],
  },
] as const;

// Dashed divider lines at quadrant boundaries
const QUADRANT_DIVIDERS = [45, 135, 225, 315];

// Flat ordered axis list with precomputed angles
interface Axis {
  key: string;
  label: string;
  category: string;
  angle: number; // degrees clockwise from 12 o'clock
}

const AXES: Axis[] = CATEGORIES.flatMap((cat) =>
  cat.skills.map((skill, i) => {
    const spacing = 90 / cat.skills.length;
    return {
      key: skill.key,
      label: skill.label,
      category: cat.name,
      angle: (cat.startAngle + i * spacing + spacing / 2 + 360) % 360,
    };
  })
);

// The Clutch axis is at 0° (12 o'clock) — scale numbers go here
const CLUTCH_ANGLE = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function polarToXY(r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

function buildPolygonPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const n = points.length;
  const mid = (
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const start = mid(points[n - 1], points[0]);
  let d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const next = points[(i + 1) % n];
    const m = mid(curr, next);
    d += ` Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${m.x.toFixed(2)} ${m.y.toFixed(2)}`;
  }
  return d + " Z";
}

/** Returns SVG textAnchor based on position around the circle */
function textAnchor(angleDeg: number): "start" | "middle" | "end" {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a >= 30 && a <= 150) return "start";
  if (a >= 210 && a <= 330) return "end";
  return "middle";
}

/** Returns SVG dominantBaseline based on position around the circle */
function dominantBaseline(
  angleDeg: number
): "auto" | "middle" | "hanging" {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a > 135 && a < 225) return "hanging";
  if (a <= 45 || a >= 315) return "auto";
  return "middle";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadarChartProps {
  ratings: Record<string, number>;       // { focus: 4.6, clutch: 4.4, … }
  playerColor?: string;                  // default: #22d68a
  playerName?: string;
  ratingCount?: number;
  compareRatings?: Record<string, number>;
  compareColor?: string;                 // default: #00e5ff
  comparePlayerName?: string;
  showBreakdown?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RadarChart({
  ratings,
  playerColor = "#22d68a",
  playerName,
  ratingCount,
  compareRatings,
  compareColor = "#00e5ff",
  comparePlayerName,
  showBreakdown = false,
}: RadarChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const hasData = AXES.some((a) => ratings[a.key]);

  // Data points
  const primaryPoints = AXES.map((axis) => {
    const v = ratings[axis.key] ?? 0;
    return polarToXY((v / 5) * GRID_RADIUS, axis.angle);
  });

  const comparePoints = compareRatings
    ? AXES.map((axis) => {
        const v = compareRatings[axis.key] ?? 0;
        return polarToXY((v / 5) * GRID_RADIUS, axis.angle);
      })
    : null;

  const primaryPath = buildPolygonPath(primaryPoints);
  const comparePath = comparePoints ? buildPolygonPath(comparePoints) : null;

  return (
    <div style={{ width: "100%", maxWidth: 600 }}>
      <svg
        viewBox="0 0 600 600"
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        aria-label={
          playerName ? `Skill radar chart for ${playerName}` : "Skill radar chart"
        }
      >
        <defs>
          <filter id="radar-polygon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1" in="SourceGraphic" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── 1. Grid rings ────────────────────────────────────────────── */}
        {[1, 2, 3, 4, 5].map((ring) => (
          <circle
            key={ring}
            cx={CX}
            cy={CY}
            r={(ring / 5) * GRID_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5}
          />
        ))}

        {/* ── 2. Quadrant divider lines ─────────────────────────────────── */}
        {QUADRANT_DIVIDERS.map((angle) => {
          const end = polarToXY(GRID_RADIUS * 1.05, angle);
          return (
            <line
              key={angle}
              x1={CX} y1={CY}
              x2={end.x} y2={end.y}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* ── 3. Axis lines ────────────────────────────────────────────── */}
        {AXES.map((axis) => {
          const end = polarToXY(GRID_RADIUS, axis.angle);
          return (
            <line
              key={axis.key}
              x1={CX} y1={CY}
              x2={end.x} y2={end.y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* ── 4. Scale numbers (Clutch / 12 o'clock axis only) ─────────── */}
        {[1, 2, 3, 4, 5].map((n) => {
          const pt = polarToXY((n / 5) * GRID_RADIUS, CLUTCH_ANGLE);
          return (
            <text
              key={n}
              x={pt.x - 7}
              y={pt.y}
              fontFamily="var(--font-mono), monospace"
              fontSize={9}
              fill="rgba(255,255,255,0.18)"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {n}
            </text>
          );
        })}

        {/* ── 5. Compare player polygon (behind) ───────────────────────── */}
        {comparePath && (
          <path
            d={comparePath}
            fill={compareColor}
            fillOpacity={0.06}
            stroke={compareColor}
            strokeOpacity={0.7}
            strokeWidth={1.5}
            filter="url(#radar-polygon-glow)"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 300ms ease",
            }}
          />
        )}

        {/* ── 6. Primary player polygon ─────────────────────────────────── */}
        {hasData && (
          <path
            d={primaryPath}
            fill={playerColor}
            fillOpacity={0.06}
            stroke={playerColor}
            strokeOpacity={0.8}
            strokeWidth={1.5}
            filter="url(#radar-polygon-glow)"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 400ms ease 100ms",
            }}
          />
        )}

        {/* ── 7. Compare player dots ────────────────────────────────────── */}
        {comparePoints &&
          AXES.map((axis, i) => {
            const v = compareRatings?.[axis.key] ?? 0;
            if (!v) return null;
            const pt = comparePoints[i];
            return (
              <circle
                key={`cmp-dot-${axis.key}`}
                cx={pt.x} cy={pt.y} r={3.5}
                fill={compareColor}
                fillOpacity={0.75}
                stroke="#0e1116"
                strokeWidth={1.5}
                style={{
                  opacity: mounted ? 1 : 0,
                  transition: `opacity 200ms ease ${i * 50 + 150}ms`,
                }}
              />
            );
          })}

        {/* ── 8. Primary player dots ────────────────────────────────────── */}
        {AXES.map((axis, i) => {
          const v = ratings[axis.key] ?? 0;
          if (!v) return null;
          const pt = primaryPoints[i];
          return (
            <circle
              key={`dot-${axis.key}`}
              cx={pt.x} cy={pt.y} r={3.5}
              fill={playerColor}
              fillOpacity={0.85}
              stroke="#0e1116"
              strokeWidth={1.5}
              style={{
                opacity: mounted ? 1 : 0,
                transition: `opacity 200ms ease ${i * 50}ms`,
              }}
            />
          );
        })}

        {/* ── 9. Data values (numbers near each dot) ───────────────────── */}
        {AXES.map((axis, i) => {
          const v = ratings[axis.key];
          if (!v) return null;
          const r = (v / 5) * GRID_RADIUS;
          const pt = polarToXY(r + 18, axis.angle);
          return (
            <text
              key={`val-${axis.key}`}
              x={pt.x} y={pt.y}
              fontFamily="var(--font-mono), monospace"
              fontSize={10}
              fill={playerColor}
              fillOpacity={0.7}
              textAnchor={textAnchor(axis.angle)}
              dominantBaseline="middle"
              style={{
                opacity: mounted ? 1 : 0,
                transition: `opacity 200ms ease ${i * 50 + 50}ms`,
              }}
            >
              {v.toFixed(1)}
            </text>
          );
        })}

        {/* ── 10. Skill labels (inner text ring) ───────────────────────── */}
        {AXES.map((axis) => {
          const pt = polarToXY(LABEL_RADIUS, axis.angle);
          return (
            <text
              key={`label-${axis.key}`}
              x={pt.x} y={pt.y}
              fontFamily="var(--font-sans), sans-serif"
              fontSize={11}
              fontWeight={500}
              fill="#9ca3af"
              textAnchor={textAnchor(axis.angle)}
              dominantBaseline={dominantBaseline(axis.angle)}
            >
              {axis.label}
            </text>
          );
        })}

        {/* ── 11. Category labels (outer text ring) ────────────────────── */}
        {CATEGORIES.map((cat) => {
          const midAngle = (cat.startAngle + 45 + 360) % 360;
          const pt = polarToXY(CATEGORY_RADIUS, midAngle);
          return (
            <text
              key={`cat-${cat.name}`}
              x={pt.x} y={pt.y}
              fontFamily="var(--font-mono), monospace"
              fontSize={9}
              fontWeight={600}
              fill="rgba(255,255,255,0.18)"
              textAnchor={textAnchor(midAngle)}
              dominantBaseline={dominantBaseline(midAngle)}
              letterSpacing={3}
            >
              {cat.name}
            </text>
          );
        })}

        {/* Empty state label */}
        {!hasData && (
          <text
            x={CX} y={CY}
            fontFamily="var(--font-sans), sans-serif"
            fontSize={13}
            fill="rgba(255,255,255,0.2)"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            No ratings yet
          </text>
        )}
      </svg>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      {(playerName || ratingCount !== undefined) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 8,
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: playerColor,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {playerName && (
            <span style={{ color: "#9ca3af" }}>{playerName}</span>
          )}
          <span>·</span>
          <span>Community Average</span>
          {ratingCount !== undefined && (
            <>
              <span>·</span>
              <span>{ratingCount} ratings</span>
            </>
          )}
          {comparePlayerName && comparePoints && (
            <>
              <span style={{ marginLeft: 8 }}>vs</span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: compareColor,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#9ca3af" }}>{comparePlayerName}</span>
            </>
          )}
        </div>
      )}

      {/* ── Skill breakdown bars (optional) ────────────────────────────── */}
      {showBreakdown && hasData && (
        <div style={{ marginTop: 32 }}>
          {CATEGORIES.map((cat) => (
            <div key={cat.name} style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.18)",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {cat.name}
              </div>
              {cat.skills.map((skill) => {
                const v = ratings[skill.key];
                return (
                  <div
                    key={skill.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 88,
                        fontFamily: "var(--font-sans), sans-serif",
                        fontSize: 11,
                        color: "#9ca3af",
                        flexShrink: 0,
                      }}
                    >
                      {skill.label}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      {v && (
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 3,
                            width: `${(v / 5) * 100}%`,
                            background: `linear-gradient(to right, ${playerColor}4d, ${playerColor}99)`,
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        color: v ? playerColor : "rgba(255,255,255,0.15)",
                        width: 32,
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {v ? v.toFixed(1) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
