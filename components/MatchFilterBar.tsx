"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Constants ──────────────────────────────────────────────────────────────────

const ROUND_ORDER = ["R128", "R64", "R32", "R16", "QF", "SF", "F", "RR"];

const ROUND_LABELS: Record<string, string> = {
  R128: "R128", R64: "R64", R32: "R32", R16: "R16",
  QF: "Quarterfinal", SF: "Semifinal", F: "Final", RR: "Round Robin",
};

const LEVEL_OPTIONS = [
  { label: "Majors",         value: "slam" },
  { label: "Masters Series", value: "masters" },
];

const SETS_OPTIONS = [
  { label: "3 Sets", value: "3" },
  { label: "4 Sets", value: "4" },
  { label: "5 Sets", value: "5" },
];

const MIN_RATING_OPTIONS = [
  { label: "5.0+", value: "5" },
  { label: "6.0+", value: "6" },
  { label: "7.0+", value: "7" },
  { label: "8.0+", value: "8" },
  { label: "9.0+", value: "9" },
];

const SURFACE_COLOR: Record<string, string> = {
  Hard:   "#4a90d9",
  Clay:   "#d4734e",
  Grass:  "#5cb85c",
  Carpet: "#9ca3af",
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MatchFilters {
  // multi-select (comma-separated)
  round?:     string;
  surface?:   string;
  level?:     string;
  sets?:      string;
  // single-select
  year?:      string;   // "2020-2024" range format
  minRating?: string;
  tournament?: string;
  player?:    string;
  playerName?: string;
}

interface Props {
  filters: MatchFilters;
  options: {
    tournaments: string[];
    surfaces: string[];
    years: string[];        // individual years from DB e.g. ["2024","2023",...]
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

// ── Multi-select helpers ───────────────────────────────────────────────────────

function getArr(val?: string): string[] {
  return val ? val.split(",").filter(Boolean) : [];
}

function toggleItem(current: string | undefined, value: string): string {
  const arr = getArr(current);
  const idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);
  return arr.join(",");
}

function isActive(current: string | undefined, value: string): boolean {
  return getArr(current).includes(value);
}

function selCount(current: string | undefined): number {
  return getArr(current).length;
}

// Generate 5-year range buckets from an array of year strings
function buildYearRanges(years: string[]): { label: string; value: string }[] {
  const nums = [...new Set(years.map(Number).filter((n) => !isNaN(n)))];
  if (nums.length === 0) return [];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const ranges: { label: string; value: string }[] = [];
  let start = Math.floor(min / 5) * 5;
  while (start <= max) {
    const end = start + 4;
    if (nums.some((n) => n >= start && n <= end)) {
      ranges.push({ label: `${start}–${end}`, value: `${start}-${end}` });
    }
    start += 5;
  }
  return ranges.reverse(); // most recent first
}

// ── All filter keys ────────────────────────────────────────────────────────────

const ALL_KEYS: (keyof MatchFilters)[] = [
  "round", "surface", "level", "sets",
  "year", "minRating", "tournament", "player", "playerName",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchFilterBar({ filters, options, basePath, hidePlayer }: Props) {
  const router = useRouter();
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!playerQuery.trim() || playerQuery.length < 2) { setPlayerResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(playerQuery)}`);
      const data = await res.json();
      setPlayerResults(Array.isArray(data) ? data : []);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [playerQuery]);

  // Push updated filters to URL
  function push(updates: Partial<MatchFilters>) {
    const next: Record<string, string> = {};
    const merged = { ...filters, ...updates };
    for (const k of ALL_KEYS) {
      const v = merged[k];
      if (v) next[k] = v;
    }
    router.push(`${basePath}?${new URLSearchParams(next).toString()}`);
  }

  // Toggle a value in a multi-select filter
  function toggle(key: keyof MatchFilters, value: string) {
    const updated = toggleItem(filters[key], value);
    push({ [key]: updated || undefined } as Partial<MatchFilters>);
  }

  // Clear specific filter keys
  function clear(...keys: string[]) {
    const next: Record<string, string> = {};
    for (const k of ALL_KEYS) {
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

  const hasAnyFilter = ALL_KEYS.some((k) => k !== "playerName" && !!filters[k]);
  const yearRanges = buildYearRanges(options.years);

  const filteredTournaments = tournamentSearch.trim()
    ? options.tournaments.filter((t) => t.toLowerCase().includes(tournamentSearch.toLowerCase()))
    : options.tournaments;

  // ── Chip label helpers ───────────────────────────────────────────────────────

  function multiLabel(key: keyof MatchFilters, base: string, opts: { label: string; value: string }[]) {
    const n = selCount(filters[key]);
    if (n === 0) return base;
    if (n === 1) return opts.find((o) => o.value === getArr(filters[key])[0])?.label ?? base;
    return `${base} (${n})`;
  }

  function singleLabel(key: keyof MatchFilters, base: string, opts?: { label: string; value: string }[]) {
    const v = filters[key];
    if (!v) return base;
    return opts?.find((o) => o.value === v)?.label ?? v;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>

        {/* ── Level ── */}
        <Chip
          label={multiLabel("level", "Level", LEVEL_OPTIONS)}
          active={!!filters.level}
          isOpen={openChip === "level"}
          onToggle={() => setOpenChip(openChip === "level" ? null : "level")}
          onClear={() => clear("level")}
        >
          <div className="flex flex-col gap-1" style={{ minWidth: 160 }}>
            {LEVEL_OPTIONS.map((o) => (
              <CheckOption
                key={o.value}
                label={o.label}
                checked={isActive(filters.level, o.value)}
                onClick={() => toggle("level", o.value)}
              />
            ))}
          </div>
        </Chip>

        {/* ── Round ── */}
        <Chip
          label={multiLabel("round", "Round", ROUND_ORDER.map((r) => ({ label: r, value: r })))}
          active={!!filters.round}
          isOpen={openChip === "round"}
          onToggle={() => setOpenChip(openChip === "round" ? null : "round")}
          onClear={() => clear("round")}
        >
          <div className="flex flex-col gap-1" style={{ minWidth: 160 }}>
            {ROUND_ORDER.map((r) => (
              <CheckOption
                key={r}
                label={ROUND_LABELS[r]}
                sublabel={ROUND_LABELS[r] !== r ? r : undefined}
                checked={isActive(filters.round, r)}
                onClick={() => toggle("round", r)}
              />
            ))}
          </div>
        </Chip>

        {/* ── Tournament ── */}
        <Chip
          label={singleLabel("tournament", "Tournament")}
          active={!!filters.tournament}
          isOpen={openChip === "tournament"}
          onToggle={() => setOpenChip(openChip === "tournament" ? null : "tournament")}
          onClear={() => clear("tournament")}
        >
          <div style={{ minWidth: 220 }}>
            <input
              autoFocus
              type="text"
              placeholder="Search tournaments…"
              value={tournamentSearch}
              onChange={(e) => setTournamentSearch(e.target.value)}
              className="w-full font-mono text-xs text-text-primary placeholder:text-text-dim px-2 py-1.5 mb-2 rounded"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", outline: "none" }}
            />
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
              {filteredTournaments.length === 0 ? (
                <span className="font-mono text-xs text-text-dim px-2 py-1">No results</span>
              ) : filteredTournaments.map((t) => (
                <RadioOption
                  key={t}
                  label={t}
                  active={filters.tournament === t}
                  onClick={() => {
                    push({ tournament: filters.tournament === t ? undefined : t });
                    setOpenChip(null);
                    setTournamentSearch("");
                  }}
                />
              ))}
            </div>
          </div>
        </Chip>

        {/* ── Surface ── */}
        <Chip
          label={multiLabel("surface", "Surface", options.surfaces.map((s) => ({ label: s, value: s })))}
          active={!!filters.surface}
          isOpen={openChip === "surface"}
          onToggle={() => setOpenChip(openChip === "surface" ? null : "surface")}
          onClear={() => clear("surface")}
        >
          <div className="flex flex-col gap-2 p-1" style={{ minWidth: 140 }}>
            {options.surfaces.map((s) => {
              const checked = isActive(filters.surface, s);
              const color = SURFACE_COLOR[s] ?? "#9ca3af";
              return (
                <button
                  key={s}
                  onClick={() => toggle("surface", s)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-100 w-full text-left"
                  style={{
                    background: checked ? `${color}18` : "transparent",
                    border: `1px solid ${checked ? color : "rgba(255,255,255,0.1)"}`,
                    cursor: "pointer",
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="font-mono text-xs" style={{ color: checked ? color : "#9ca3af" }}>
                    {s}
                  </span>
                  {checked && <span className="ml-auto font-mono text-xs" style={{ color, opacity: 0.8 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </Chip>

        {/* ── Year (5-year ranges, single-select) ── */}
        <Chip
          label={singleLabel("year", "Year", yearRanges)}
          active={!!filters.year}
          isOpen={openChip === "year"}
          onToggle={() => setOpenChip(openChip === "year" ? null : "year")}
          onClear={() => clear("year")}
        >
          <div className="flex flex-col gap-1" style={{ minWidth: 120 }}>
            {yearRanges.length === 0 ? (
              <span className="font-mono text-xs text-text-dim px-2 py-1">No data</span>
            ) : yearRanges.map((r) => (
              <RadioOption
                key={r.value}
                label={r.label}
                active={filters.year === r.value}
                onClick={() => {
                  push({ year: filters.year === r.value ? undefined : r.value });
                  setOpenChip(null);
                }}
              />
            ))}
          </div>
        </Chip>

        {/* ── Sets (multi-select) ── */}
        <Chip
          label={multiLabel("sets", "Sets", SETS_OPTIONS)}
          active={!!filters.sets}
          isOpen={openChip === "sets"}
          onToggle={() => setOpenChip(openChip === "sets" ? null : "sets")}
          onClear={() => clear("sets")}
        >
          <div className="flex gap-2 p-1">
            {SETS_OPTIONS.map((o) => {
              const checked = isActive(filters.sets, o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => toggle("sets", o.value)}
                  className="font-mono text-xs px-3 py-2 rounded-lg transition-all duration-100"
                  style={{
                    background: checked ? "rgba(34,214,138,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${checked ? "rgba(34,214,138,0.4)" : "rgba(255,255,255,0.1)"}`,
                    color: checked ? "#22d68a" : "#9ca3af",
                    cursor: "pointer",
                    minWidth: 36,
                  }}
                >
                  {o.value}
                </button>
              );
            })}
          </div>
        </Chip>

        {/* ── Min Community Rating (single-select) ── */}
        <Chip
          label={singleLabel("minRating", "Rating", MIN_RATING_OPTIONS)}
          active={!!filters.minRating}
          isOpen={openChip === "minRating"}
          onToggle={() => setOpenChip(openChip === "minRating" ? null : "minRating")}
          onClear={() => clear("minRating")}
        >
          <div style={{ minWidth: 120 }}>
            <p className="font-mono text-[10px] text-text-dim px-2 pb-2 uppercase tracking-wider">
              Min community rating
            </p>
            <div className="flex flex-col gap-1">
              {MIN_RATING_OPTIONS.map((o) => (
                <RadioOption
                  key={o.value}
                  label={o.label}
                  active={filters.minRating === o.value}
                  onClick={() => {
                    push({ minRating: filters.minRating === o.value ? undefined : o.value });
                    setOpenChip(null);
                  }}
                />
              ))}
            </div>
          </div>
        </Chip>

        {/* ── Player ── */}
        {!hidePlayer && (
          <Chip
            label={filters.playerName ?? "Player"}
            active={!!filters.player}
            isOpen={openChip === "player"}
            onToggle={() => setOpenChip(openChip === "player" ? null : "player")}
            onClear={() => clear("player", "playerName")}
          >
            <div style={{ minWidth: 220 }}>
              <input
                autoFocus
                type="text"
                placeholder="Search players…"
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                className="w-full font-mono text-xs text-text-primary placeholder:text-text-dim px-2 py-1.5 mb-2 rounded"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", outline: "none" }}
              />
              <div className="flex flex-col gap-0.5">
                {playerQuery.length < 2 ? (
                  <span className="font-mono text-xs text-text-dim px-2 py-1">Type to search…</span>
                ) : playerResults.length === 0 ? (
                  <span className="font-mono text-xs text-text-dim px-2 py-1">No players found</span>
                ) : playerResults.map((p) => (
                  <RadioOption
                    key={p.id}
                    label={p.name}
                    sublabel={p.current_rank ? `#${p.current_rank}` : undefined}
                    active={filters.player === p.id}
                    onClick={() => {
                      push({ player: p.id, playerName: p.name });
                      setOpenChip(null);
                      setPlayerQuery("");
                    }}
                  />
                ))}
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

// ── Chip shell ─────────────────────────────────────────────────────────────────

function Chip({
  label, active, isOpen, onToggle, onClear, children,
}: {
  label: string;
  active: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
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
            maxWidth: 180,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </button>
        {active && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{
              padding: "6px 8px",
              borderRadius: "0 20px 20px 0",
              border: "1px solid rgba(34,214,138,0.4)",
              borderLeft: "none",
              background: "rgba(34,214,138,0.08)",
              color: "#22d68a",
              cursor: "pointer",
              opacity: 0.7,
              fontFamily: "monospace",
              fontSize: 12,
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

// ── Option types ───────────────────────────────────────────────────────────────

// Multi-select option with checkbox feel
function CheckOption({ label, sublabel, checked, onClick }: {
  label: string; sublabel?: string; checked: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors duration-100"
      style={{
        background: checked ? "rgba(34,214,138,0.08)" : "transparent",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { if (!checked) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (!checked) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      {/* Checkbox */}
      <span
        className="shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
        style={{
          border: `1px solid ${checked ? "#22d68a" : "rgba(255,255,255,0.2)"}`,
          background: checked ? "#22d68a" : "transparent",
        }}
      >
        {checked && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="#0e1116" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span className="font-mono text-xs flex-1" style={{ color: checked ? "#22d68a" : "#9ca3af" }}>
        {label}
      </span>
      {sublabel && <span className="font-mono text-[10px] text-text-dim shrink-0">{sublabel}</span>}
    </button>
  );
}

// Single-select option (radio style)
function RadioOption({ label, sublabel, active, onClick }: {
  label: string; sublabel?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors duration-100"
      style={{
        background: active ? "rgba(34,214,138,0.08)" : "transparent",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      <span
        className="shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
        style={{ border: `1px solid ${active ? "#22d68a" : "rgba(255,255,255,0.2)"}` }}
      >
        {active && <span className="w-2 h-2 rounded-full" style={{ background: "#22d68a" }} />}
      </span>
      <span className="font-mono text-xs flex-1 truncate" style={{ color: active ? "#22d68a" : "#9ca3af" }}>
        {label}
      </span>
      {sublabel && <span className="font-mono text-[10px] text-text-dim shrink-0">{sublabel}</span>}
    </button>
  );
}
