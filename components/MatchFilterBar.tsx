"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUND_ORDER = ["R128", "R64", "R32", "R16", "QF", "SF", "F", "RR"];

const SETS_OPTIONS = [
  { label: "3 Sets",   value: "3" },
  { label: "4 Sets",   value: "4" },
  { label: "5 Sets",   value: "5" },
  { label: "Tiebreak", value: "tb" },
];

const MIN_RATING_OPTIONS = [
  { label: "7.0+", value: "7" },
  { label: "8.0+", value: "8" },
  { label: "9.0+", value: "9" },
];

const LEVEL_OPTIONS = [
  { label: "Grand Slam",   value: "slam" },
  { label: "Masters 1000", value: "masters" },
];

export interface MatchFilters {
  round?:      string;
  tournament?: string;
  surface?:    string;
  year?:       string;
  player?:     string;      // UUID
  playerName?: string;      // display name stored in URL
  level?:      string;      // "slam" | "masters"
  sets?:       string;      // "3" | "4" | "5" | "tb"
  minRating?:  string;      // "7" | "8" | "9"
}

interface Props {
  filters: MatchFilters;
  options: {
    tournaments: string[];
    surfaces: string[];
    years: string[];
  };
  basePath: string;
  hidePlayer?: boolean;
}

interface PlayerResult {
  id: string;
  name: string;
  country: string | null;
  current_rank: number | null;
}

const ALL_FILTER_KEYS: (keyof MatchFilters)[] = [
  "round", "tournament", "surface", "year",
  "player", "playerName", "level", "sets", "minRating",
];

export default function MatchFilterBar({ filters, options, basePath, hidePlayer }: Props) {
  const router = useRouter();
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Player search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!playerQuery.trim() || playerQuery.length < 2) {
      setPlayerResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(playerQuery)}`);
      const data = await res.json();
      setPlayerResults(Array.isArray(data) ? data : []);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [playerQuery]);

  function navigate(updates: Partial<MatchFilters>) {
    const next: Record<string, string> = {};
    const merged = { ...filters, ...updates };
    for (const k of ALL_FILTER_KEYS) {
      const v = merged[k];
      if (v) next[k] = v;
    }
    const qs = new URLSearchParams(next).toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    setOpenChip(null);
    setTournamentSearch("");
    setPlayerQuery("");
  }

  function clearFilter(...keys: string[]) {
    const next: Record<string, string> = {};
    for (const k of ALL_FILTER_KEYS) {
      if (!keys.includes(k)) {
        const v = filters[k];
        if (v) next[k] = v;
      }
    }
    const qs = new URLSearchParams(next).toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    setOpenChip(null);
  }

  function clearAll() {
    router.push(basePath);
    setOpenChip(null);
  }

  const hasAnyFilter = ALL_FILTER_KEYS.some(
    (k) => k !== "playerName" && !!filters[k]
  );

  const filteredTournaments = tournamentSearch.trim()
    ? options.tournaments.filter((t) => t.toLowerCase().includes(tournamentSearch.toLowerCase()))
    : options.tournaments;

  const setsLabel = SETS_OPTIONS.find((o) => o.value === filters.sets)?.label;
  const levelLabel = LEVEL_OPTIONS.find((o) => o.value === filters.level)?.label;
  const ratingLabel = MIN_RATING_OPTIONS.find((o) => o.value === filters.minRating)?.label;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >

        {/* Level */}
        <Chip
          label="Level"
          value={levelLabel}
          isOpen={openChip === "level"}
          onToggle={() => setOpenChip(openChip === "level" ? null : "level")}
          onClear={() => clearFilter("level")}
        >
          <div className="flex flex-col gap-0.5" style={{ minWidth: 140 }}>
            {LEVEL_OPTIONS.map((o) => (
              <OptionButton
                key={o.value}
                label={o.label}
                active={filters.level === o.value}
                onClick={() =>
                  filters.level === o.value ? clearFilter("level") : navigate({ level: o.value })
                }
              />
            ))}
          </div>
        </Chip>

        {/* Round */}
        <Chip
          label="Round"
          value={filters.round}
          isOpen={openChip === "round"}
          onToggle={() => setOpenChip(openChip === "round" ? null : "round")}
          onClear={() => clearFilter("round")}
        >
          <div className="flex flex-col gap-0.5" style={{ minWidth: 110 }}>
            {ROUND_ORDER.map((r) => (
              <OptionButton
                key={r}
                label={r}
                active={filters.round === r}
                onClick={() =>
                  filters.round === r ? clearFilter("round") : navigate({ round: r })
                }
              />
            ))}
          </div>
        </Chip>

        {/* Tournament */}
        <Chip
          label="Tournament"
          value={filters.tournament}
          isOpen={openChip === "tournament"}
          onToggle={() => setOpenChip(openChip === "tournament" ? null : "tournament")}
          onClear={() => clearFilter("tournament")}
        >
          <div style={{ minWidth: 220 }}>
            <input
              autoFocus
              type="text"
              placeholder="Search tournaments…"
              value={tournamentSearch}
              onChange={(e) => setTournamentSearch(e.target.value)}
              className="w-full font-mono text-xs text-text-primary placeholder:text-text-dim px-2 py-1.5 mb-2 rounded"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                outline: "none",
              }}
            />
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
              {filteredTournaments.length === 0 ? (
                <span className="font-mono text-xs text-text-dim px-2 py-1">No results</span>
              ) : (
                filteredTournaments.map((t) => (
                  <OptionButton
                    key={t}
                    label={t}
                    active={filters.tournament === t}
                    onClick={() =>
                      filters.tournament === t ? clearFilter("tournament") : navigate({ tournament: t })
                    }
                  />
                ))
              )}
            </div>
          </div>
        </Chip>

        {/* Surface */}
        <Chip
          label="Surface"
          value={filters.surface}
          isOpen={openChip === "surface"}
          onToggle={() => setOpenChip(openChip === "surface" ? null : "surface")}
          onClear={() => clearFilter("surface")}
        >
          <div className="flex flex-col gap-0.5" style={{ minWidth: 130 }}>
            {options.surfaces.map((s) => (
              <OptionButton
                key={s}
                label={s}
                active={filters.surface === s}
                onClick={() =>
                  filters.surface === s ? clearFilter("surface") : navigate({ surface: s })
                }
              />
            ))}
          </div>
        </Chip>

        {/* Year */}
        <Chip
          label="Year"
          value={filters.year}
          isOpen={openChip === "year"}
          onToggle={() => setOpenChip(openChip === "year" ? null : "year")}
          onClear={() => clearFilter("year")}
        >
          <div className="flex flex-col gap-0.5" style={{ minWidth: 90 }}>
            {options.years.map((y) => (
              <OptionButton
                key={y}
                label={y}
                active={filters.year === y}
                onClick={() =>
                  filters.year === y ? clearFilter("year") : navigate({ year: y })
                }
              />
            ))}
          </div>
        </Chip>

        {/* Sets */}
        <Chip
          label="Sets"
          value={setsLabel}
          isOpen={openChip === "sets"}
          onToggle={() => setOpenChip(openChip === "sets" ? null : "sets")}
          onClear={() => clearFilter("sets")}
        >
          <div className="flex flex-col gap-0.5" style={{ minWidth: 120 }}>
            {SETS_OPTIONS.map((o) => (
              <OptionButton
                key={o.value}
                label={o.label}
                active={filters.sets === o.value}
                onClick={() =>
                  filters.sets === o.value ? clearFilter("sets") : navigate({ sets: o.value })
                }
              />
            ))}
          </div>
        </Chip>

        {/* Min Community Rating */}
        <Chip
          label="Min Rating"
          value={ratingLabel}
          isOpen={openChip === "minRating"}
          onToggle={() => setOpenChip(openChip === "minRating" ? null : "minRating")}
          onClear={() => clearFilter("minRating")}
        >
          <div className="flex flex-col gap-0.5" style={{ minWidth: 100 }}>
            {MIN_RATING_OPTIONS.map((o) => (
              <OptionButton
                key={o.value}
                label={o.label}
                active={filters.minRating === o.value}
                onClick={() =>
                  filters.minRating === o.value
                    ? clearFilter("minRating")
                    : navigate({ minRating: o.value })
                }
              />
            ))}
          </div>
        </Chip>

        {/* Player search — hidden on player profile page */}
        {!hidePlayer && (
          <Chip
            label="Player"
            value={filters.playerName}
            isOpen={openChip === "player"}
            onToggle={() => setOpenChip(openChip === "player" ? null : "player")}
            onClear={() => clearFilter("player", "playerName")}
          >
            <div style={{ minWidth: 220 }}>
              <input
                autoFocus
                type="text"
                placeholder="Search players…"
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                className="w-full font-mono text-xs text-text-primary placeholder:text-text-dim px-2 py-1.5 mb-2 rounded"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  outline: "none",
                }}
              />
              <div className="flex flex-col gap-0.5">
                {playerQuery.length < 2 ? (
                  <span className="font-mono text-xs text-text-dim px-2 py-1">Type to search…</span>
                ) : playerResults.length === 0 ? (
                  <span className="font-mono text-xs text-text-dim px-2 py-1">No players found</span>
                ) : (
                  playerResults.map((p) => (
                    <OptionButton
                      key={p.id}
                      label={p.name}
                      sublabel={p.current_rank ? `#${p.current_rank}` : undefined}
                      active={filters.player === p.id}
                      onClick={() => navigate({ player: p.id, playerName: p.name })}
                    />
                  ))
                )}
              </div>
            </div>
          </Chip>
        )}

        {/* Clear all */}
        {hasAnyFilter && (
          <button
            onClick={clearAll}
            className="font-mono text-xs text-text-dim hover:text-text-primary transition-colors duration-150 shrink-0 px-2"
            style={{ whiteSpace: "nowrap" }}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Chip({
  label,
  value,
  isOpen,
  onToggle,
  onClear,
  children,
}: {
  label: string;
  value?: string;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const active = !!value;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          onClick={onToggle}
          className="font-mono text-xs transition-colors duration-150"
          style={{
            padding: "6px 12px",
            borderRadius: active ? "20px 0 0 20px" : 20,
            border: `1px solid ${active ? "rgba(34,214,138,0.4)" : "rgba(255,255,255,0.1)"}`,
            borderRight: active ? "none" : undefined,
            background: active ? "rgba(34,214,138,0.08)" : "transparent",
            color: active ? "#22d68a" : "#9ca3af",
            cursor: "pointer",
            whiteSpace: "nowrap",
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {active ? value : label}
        </button>
        {active && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="font-mono text-xs transition-colors duration-150 hover:opacity-100"
            style={{
              padding: "6px 8px",
              borderRadius: "0 20px 20px 0",
              border: "1px solid rgba(34,214,138,0.4)",
              borderLeft: "none",
              background: "rgba(34,214,138,0.08)",
              color: "#22d68a",
              cursor: "pointer",
              opacity: 0.7,
            }}
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "#1a1e26",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: 8,
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function OptionButton({
  label,
  sublabel,
  active,
  onClick,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left font-mono text-xs px-2 py-1.5 rounded transition-colors duration-100"
      style={{
        background: active ? "rgba(34,214,138,0.12)" : "transparent",
        color: active ? "#22d68a" : "#9ca3af",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {sublabel && <span style={{ opacity: 0.5, flexShrink: 0 }}>{sublabel}</span>}
      {active && <span style={{ marginLeft: "auto", opacity: 0.6 }}>✓</span>}
    </button>
  );
}
