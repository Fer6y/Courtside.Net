"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import RadarChart from "@/components/radar/RadarChart";

const PRESET_COLORS = [
  "#22d68a", // green
  "#4a9eff", // blue
  "#f5c518", // amber
  "#d4734e", // coral
  "#e74c3c", // red
  "#a78bfa", // purple
  "#fb923c", // orange
  "#38bdf8", // sky
];

const SKILL_LABELS: Record<string, string> = {
  focus: "Focus", clutch: "Clutch", resilience: "Resilience",
  serve: "Serve", forehand: "Forehand", backhand: "Backhand",
  net_play: "Net Play", touch: "Touch", return_play: "Return",
  reaction_time: "Reaction", speed: "Speed",
  court_coverage: "Coverage", positioning: "Positioning",
};

const SURFACE_COLOR: Record<string, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c",
};

interface PlayerData {
  id: string;
  name: string;
  country: string | null;
  current_rank: number | null;
  ratings: Record<string, number>;
  ratingCount: number;
}

interface H2HMatch {
  id: string;
  winner_id: string | null;
  player1_id: string;
  player2_id: string;
  match_date: string | null;
  tournament: string;
  surface: string | null;
  score: string | null;
}

interface Props {
  p1: PlayerData;
  p2: PlayerData;
  h2hMatches: H2HMatch[];
  showH2HCard?: boolean;
}

export default function CompareView({ p1, p2, h2hMatches, showH2HCard = true }: Props) {
  const [p1Color, setP1Color] = useState("#22d68a");
  const [p2Color, setP2Color] = useState("#4a9eff");

  // Restore per-player color preferences from localStorage
  useEffect(() => {
    const c1 = localStorage.getItem(`courtside_color_${p1.id}`);
    const c2 = localStorage.getItem(`courtside_color_${p2.id}`);
    if (c1) setP1Color(c1);
    if (c2) setP2Color(c2);
  }, [p1.id, p2.id]);

  const updateColor = (
    which: "p1" | "p2",
    color: string,
    playerId: string
  ) => {
    if (which === "p1") setP1Color(color);
    else setP2Color(color);
    localStorage.setItem(`courtside_color_${playerId}`, color);
  };

  // Top 3 skills per player
  const topSkills = (ratings: Record<string, number>) =>
    Object.entries(ratings)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k, v]) => ({ key: k, label: SKILL_LABELS[k] ?? k, value: v }));

  const p1Top = topSkills(p1.ratings);
  const p2Top = topSkills(p2.ratings);

  // Skills with biggest gap between the two
  const allKeys = [
    ...new Set([...Object.keys(p1.ratings), ...Object.keys(p2.ratings)]),
  ];
  const diffs = allKeys
    .map((k) => ({
      key: k,
      label: SKILL_LABELS[k] ?? k,
      p1Val: p1.ratings[k] ?? 0,
      p2Val: p2.ratings[k] ?? 0,
      diff: Math.abs((p1.ratings[k] ?? 0) - (p2.ratings[k] ?? 0)),
    }))
    .filter((d) => d.diff > 0.05)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 4);

  // H2H record
  const p1Wins = h2hMatches.filter((m) => m.winner_id === p1.id).length;
  const p2Wins = h2hMatches.filter((m) => m.winner_id === p2.id).length;

  const hasRatings = p1.ratingCount > 0 || p2.ratingCount > 0;

  return (
    <div>
      {/* ── Player headers with color pickers ──────────────────── */}
      <div className="flex items-start justify-between gap-6 mb-10">
        {/* P1 */}
        <div className="flex-1 min-w-0">
          <Link href={`/players/${p1.id}`} className="hover:opacity-80 transition-opacity">
            <div
              className="font-mono text-2xl font-bold truncate mb-1"
              style={{ color: p1Color }}
            >
              {p1.name}
            </div>
          </Link>
          <div className="font-mono text-xs text-text-dim mb-3">
            {p1.country && <span className="mr-2">{p1.country}</span>}
            {p1.current_rank && <span>#{p1.current_rank}</span>}
          </div>
          <ColorPicker
            value={p1Color}
            onChange={(c) => updateColor("p1", c, p1.id)}
          />
        </div>

        {/* VS */}
        <div className="font-mono text-xl text-text-dim pt-1.5 shrink-0">vs</div>

        {/* P2 */}
        <div className="flex-1 min-w-0 text-right">
          <Link href={`/players/${p2.id}`} className="hover:opacity-80 transition-opacity">
            <div
              className="font-mono text-2xl font-bold truncate mb-1"
              style={{ color: p2Color }}
            >
              {p2.name}
            </div>
          </Link>
          <div className="font-mono text-xs text-text-dim mb-3">
            {p2.current_rank && <span className="mr-2">#{p2.current_rank}</span>}
            {p2.country && <span>{p2.country}</span>}
          </div>
          <div className="flex justify-end">
            <ColorPicker
              value={p2Color}
              onChange={(c) => updateColor("p2", c, p2.id)}
            />
          </div>
        </div>
      </div>

      {/* ── Dual radar overlay ──────────────────────────────────── */}
      <div className="flex justify-center mb-10">
        <RadarChart
          ratings={p1.ratings}
          playerColor={p1Color}
          playerName={p1.name}
          compareRatings={p2.ratings}
          compareColor={p2Color}
          comparePlayerName={p2.name}
        />
      </div>

      {/* ── Stats grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Top skills */}
        <StatCard title="Top Skills">
          {hasRatings ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div
                  className="font-mono text-[10px] uppercase tracking-widest mb-3"
                  style={{ color: p1Color }}
                >
                  {p1.name.split(" ").pop()}
                </div>
                {p1Top.length > 0 ? (
                  p1Top.map((s) => (
                    <SkillRow key={s.key} label={s.label} value={s.value} color={p1Color} />
                  ))
                ) : (
                  <span className="font-mono text-xs text-text-dim">No ratings</span>
                )}
              </div>
              <div>
                <div
                  className="font-mono text-[10px] uppercase tracking-widest mb-3"
                  style={{ color: p2Color }}
                >
                  {p2.name.split(" ").pop()}
                </div>
                {p2Top.length > 0 ? (
                  p2Top.map((s) => (
                    <SkillRow key={s.key} label={s.label} value={s.value} color={p2Color} />
                  ))
                ) : (
                  <span className="font-mono text-xs text-text-dim">No ratings</span>
                )}
              </div>
            </div>
          ) : (
            <p className="font-mono text-xs text-text-dim">
              No community ratings yet. Rate both players to see this.
            </p>
          )}
        </StatCard>

        {/* Biggest edge */}
        <StatCard title="Biggest Edge">
          {diffs.length > 0 ? (
            <div className="flex flex-col gap-3">
              {diffs.map((d) => {
                const p1Leads = d.p1Val >= d.p2Val;
                const leaderName = (p1Leads ? p1 : p2).name.split(" ").pop()!;
                const leaderColor = p1Leads ? p1Color : p2Color;
                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs text-text-dim">{d.label}</span>
                      <span
                        className="font-mono text-xs font-bold"
                        style={{ color: leaderColor }}
                      >
                        +{d.diff.toFixed(1)} {leaderName}
                      </span>
                    </div>
                    {/* Mini comparison bar */}
                    <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
                      <div
                        className="rounded-l-full"
                        style={{
                          width: `${(d.p1Val / 5) * 100}%`,
                          background: p1Color,
                          opacity: 0.7,
                        }}
                      />
                      <div
                        className="rounded-r-full"
                        style={{
                          width: `${(d.p2Val / 5) * 100}%`,
                          background: p2Color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-mono text-xs text-text-dim">
              Rate both players to see skill gaps.
            </p>
          )}
        </StatCard>

        {/* H2H record */}
        {showH2HCard && <StatCard title="Head to Head">
          {h2hMatches.length > 0 ? (
            <>
              {/* Win counts */}
              <div className="flex items-center justify-between mb-5">
                <div className="text-center">
                  <div
                    className="font-mono text-4xl font-bold"
                    style={{ color: p1Color }}
                  >
                    {p1Wins}
                  </div>
                  <div className="font-mono text-[10px] text-text-dim mt-1">
                    {p1.name.split(" ").pop()}
                  </div>
                </div>
                <div className="font-mono text-sm text-text-dim">–</div>
                <div className="text-center">
                  <div
                    className="font-mono text-4xl font-bold"
                    style={{ color: p2Color }}
                  >
                    {p2Wins}
                  </div>
                  <div className="font-mono text-[10px] text-text-dim mt-1">
                    {p2.name.split(" ").pop()}
                  </div>
                </div>
              </div>

              {/* Recent encounters */}
              <div className="flex flex-col gap-2">
                {h2hMatches.slice(0, 4).map((m) => {
                  const winnerIsP1 = m.winner_id === p1.id;
                  const winnerColor = winnerIsP1 ? p1Color : p2Color;
                  const winnerLastName = (
                    winnerIsP1 ? p1 : p2
                  ).name
                    .split(" ")
                    .pop();
                  return (
                    <Link
                      key={m.id}
                      href={`/matches/${m.id}`}
                      className="flex items-center justify-between hover:bg-white/[0.02] rounded px-1 py-0.5 transition-colors duration-150"
                    >
                      <span
                        className="font-mono text-[11px] font-semibold"
                        style={{ color: winnerColor }}
                      >
                        {winnerLastName}
                      </span>
                      <div className="flex items-center gap-2">
                        {m.surface && (
                          <span
                            className="font-mono text-[10px]"
                            style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}
                          >
                            {m.surface}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-text-dim">
                          {m.match_date?.slice(0, 4)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="font-mono text-xs text-text-dim">
              No matches between these players in our dataset.
            </p>
          )}
        </StatCard>}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className="w-[44px] h-[44px] sm:w-7 sm:h-7 flex items-center justify-center shrink-0"
          title={c}
        >
          <div
            className="w-5 h-5 rounded-full transition-all duration-150"
            style={{
              background: c,
              outline: value === c ? `2px solid ${c}` : "2px solid transparent",
              outlineOffset: 2,
              opacity: value === c ? 1 : 0.4,
            }}
          />
        </button>
      ))}
    </div>
  );
}

function StatCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-5">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-text-dim mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SkillRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="font-mono text-xs text-text-dim">{label}</span>
      <span className="font-mono text-xs font-bold" style={{ color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}
