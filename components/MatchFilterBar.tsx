"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Constants ──────────────────────────────────────────────────────────────────

const ROUND_ORDER = ["R128", "R64", "R32", "R16", "QF", "SF", "F", "RR"];
const ROUND_LABELS: Record<string, string> = {
  R128: "R128 — First Round",   R64: "R64 — Second Round",
  R32:  "R32 — Third Round",    R16: "Round of 16",
  QF:   "Quarterfinal",         SF:  "Semifinal",
  F:    "Final",                RR:  "Round Robin",
};

const LEVEL_OPTIONS  = [
  { label: "Majors",         value: "slam"    },
  { label: "Masters Series", value: "masters" },
];
const SETS_OPTIONS   = [
  { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" },
];
const RATING_OPTIONS = [
  { label: "5.0+", value: "5" }, { label: "6.0+", value: "6" },
  { label: "7.0+", value: "7" }, { label: "8.0+", value: "8" },
  { label: "9.0+", value: "9" },
];
const SURFACE_COLOR: Record<string, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c", Carpet: "#9ca3af",
};

const MULTI_KEYS = ["level", "round", "surface", "sets"] as const;
type MultiKey = typeof MULTI_KEYS[number];

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MatchFilters {
  round?:      string; // multi — comma-separated
  surface?:    string; // multi — comma-separated
  level?:      string; // multi — comma-separated
  sets?:       string; // multi — comma-separated
  year?:       string; // single — "2020-2024"
  minRating?:  string; // single
  tournament?: string; // single
  player?:     string; // single UUID
  playerName?: string;
}

interface Props {
  filters:     MatchFilters;
  options:     { tournaments: string[]; surfaces: string[]; years: string[] };
  basePath:    string;
  hidePlayer?: boolean;
}

interface PlayerResult {
  id: string; name: string; country: string | null; current_rank: number | null;
}

const ALL_KEYS: (keyof MatchFilters)[] = [
  "round","surface","level","sets","year","minRating","tournament","player","playerName",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getArr(val?: string) { return val ? val.split(",").filter(Boolean) : []; }
function isOn(val: string | undefined, v: string) { return getArr(val).includes(v); }
function selCount(val?: string) { return getArr(val).length; }

function toggleItem(current: string | undefined, value: string) {
  const arr = getArr(current);
  const i = arr.indexOf(value);
  i >= 0 ? arr.splice(i, 1) : arr.push(value);
  return arr.join(",");
}

function buildYearRanges(years: string[]): { label: string; value: string }[] {
  const nums = [...new Set(years.map(Number).filter((n) => !isNaN(n)))];
  if (!nums.length) return [];
  const min = Math.min(...nums), max = Math.max(...nums);
  const out: { label: string; value: string }[] = [];
  let s = Math.floor(min / 5) * 5;
  while (s <= max) {
    const e = s + 4;
    if (nums.some((n) => n >= s && n <= e)) out.push({ label: `${s}–${e}`, value: `${s}-${e}` });
    s += 5;
  }
  return out.reverse();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchFilterBar({ filters, options, basePath, hidePlayer }: Props) {
  const router = useRouter();

  // pending holds uncommitted multi-select changes — only pushed when dropdown closes
  const [pending, setPending]             = useState<Partial<Record<MultiKey, string | undefined>>>({});
  const [openChip, setOpenChip]           = useState<string | null>(null);
  const [dropdownLeft, setDropdownLeft]   = useState(0);
  const [tournamentSearch, setTSearch]    = useState("");
  const [playerQuery, setPlayerQuery]     = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRowRef = useRef<HTMLDivElement>(null);
  const chipRefs     = useRef<Record<string, HTMLDivElement | null>>({});
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effective filters = URL params overridden by pending local changes
  const eff: MatchFilters = { ...filters, ...pending };

  // ── Outside-click: apply pending and close ───────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        applyAndClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, filters]);

  // ── Player search debounce ───────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!playerQuery.trim() || playerQuery.length < 2) { setPlayerResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/players/search?q=${encodeURIComponent(playerQuery)}`);
      const data = await res.json();
      setPlayerResults(Array.isArray(data) ? data : []);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [playerQuery]);

  // ── Push effective filters to URL and reset pending ──────────────────────────
  function pushFilters(overrides: Partial<MatchFilters> = {}) {
    const merged = { ...filters, ...pending, ...overrides };
    const next: Record<string, string> = {};
    for (const k of ALL_KEYS) { const v = merged[k]; if (v) next[k] = v; }
    router.push(`${basePath}?${new URLSearchParams(next)}`);
    setPending({});
  }

  function applyAndClose() {
    const hasPending = Object.keys(pending).length > 0;
    if (hasPending) pushFilters();
    else setOpenChip(null);
    setPending({});
    setOpenChip(null);
  }

  // ── Multi-select toggle — updates pending only, NO navigation ────────────────
  function toggle(key: MultiKey, value: string) {
    const current = key in pending ? pending[key] : filters[key];
    const updated = toggleItem(current, value);
    setPending((prev) => ({ ...prev, [key]: updated || undefined }));
  }

  // ── Single-select: navigate immediately, close dropdown ──────────────────────
  function selectSingle(updates: Partial<MatchFilters>) {
    pushFilters(updates);
    setOpenChip(null);
    setTSearch("");
    setPlayerQuery("");
  }

  // ── Clear a filter (both pending + URL) ──────────────────────────────────────
  function clearFilter(...keys: string[]) {
    setPending((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k as MultiKey];
      return next;
    });
    const next: Record<string, string> = {};
    for (const k of ALL_KEYS) {
      if (!keys.includes(k)) { const v = eff[k]; if (v) next[k] = v; }
    }
    const qs = new URLSearchParams(next).toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    setOpenChip(null);
  }

  function clearAll() {
    setPending({});
    router.push(basePath);
    setOpenChip(null);
  }

  // ── Open chip: measure left offset ──────────────────────────────────────────
  function openDrop(key: string) {
    if (openChip === key) { applyAndClose(); return; }
    const chipEl   = chipRefs.current[key];
    const scrollEl = scrollRowRef.current;
    if (chipEl && scrollEl) setDropdownLeft(Math.max(0, chipEl.offsetLeft - scrollEl.scrollLeft));
    setOpenChip(key);
  }

  // ── Label helpers (use eff, which includes pending) ──────────────────────────
  function multiLabel(key: MultiKey, base: string, opts: { label: string; value: string }[]) {
    const n = selCount(eff[key]);
    if (n === 0) return base;
    if (n === 1) return opts.find((o) => o.value === getArr(eff[key])[0])?.label ?? base;
    return `${base} (${n})`;
  }
  function singleLabel(key: keyof MatchFilters, base: string, opts?: { label: string; value: string }[]) {
    const v = eff[key];
    if (!v) return base;
    return opts?.find((o) => o.value === v)?.label ?? v;
  }
  function isChipActive(key: string) {
    if (key === "player") return !!eff.player;
    return !!eff[key as keyof MatchFilters];
  }

  const hasAnyFilter  = ALL_KEYS.some((k) => k !== "playerName" && !!eff[k]);
  const yearRanges    = buildYearRanges(options.years);
  const filteredTourns = tournamentSearch.trim()
    ? options.tournaments.filter((t) => t.toLowerCase().includes(tournamentSearch.toLowerCase()))
    : options.tournaments;

  const chips = [
    { key: "level",      label: multiLabel("level",   "Level",   LEVEL_OPTIONS) },
    { key: "round",      label: multiLabel("round",   "Round",   ROUND_ORDER.map((r) => ({ label: r, value: r }))) },
    { key: "tournament", label: singleLabel("tournament", "Tournament") },
    { key: "surface",    label: multiLabel("surface", "Surface", options.surfaces.map((s) => ({ label: s, value: s }))) },
    { key: "year",       label: singleLabel("year",   "Year",    yearRanges) },
    { key: "sets",       label: multiLabel("sets",    "Sets",    SETS_OPTIONS) },
    { key: "minRating",  label: singleLabel("minRating", "Rating", RATING_OPTIONS) },
    ...(!hidePlayer ? [{ key: "player", label: eff.playerName ?? "Player" }] : []),
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ position: "relative" }}>

      {/* Scrollable chip row */}
      <div
        ref={scrollRowRef}
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {chips.map(({ key, label }) => (
          <div key={key} ref={(el) => { chipRefs.current[key] = el; }} style={{ flexShrink: 0 }}>
            <ChipBtn
              label={label}
              active={isChipActive(key)}
              isOpen={openChip === key}
              onToggle={() => openDrop(key)}
              onClear={() =>
                key === "player" ? clearFilter("player", "playerName") : clearFilter(key)
              }
            />
          </div>
        ))}
        {hasAnyFilter && (
          <button
            onClick={clearAll}
            className="font-mono text-xs text-text-dim hover:text-text-primary transition-colors shrink-0 px-2"
            style={{ whiteSpace: "nowrap" }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Dropdown panel — sibling of scroll row, not clipped by overflow */}
      {openChip && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: dropdownLeft,
            background: "#1a1e26",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 10,
            zIndex: 200,
            boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
            minWidth: 160,
          }}
        >
          {/* Level */}
          {openChip === "level" && (
            <div className="flex flex-col gap-1">
              <DropLabel>Event type</DropLabel>
              {LEVEL_OPTIONS.map((o) => (
                <CheckRow key={o.value} label={o.label}
                  checked={isOn(eff.level, o.value)}
                  onClick={() => toggle("level", o.value)} />
              ))}
            </div>
          )}

          {/* Round */}
          {openChip === "round" && (
            <div className="flex flex-col gap-1" style={{ minWidth: 210 }}>
              <DropLabel>Select rounds</DropLabel>
              {ROUND_ORDER.map((r) => (
                <CheckRow key={r}
                  label={ROUND_LABELS[r]}
                  sublabel={["QF","SF","F","RR"].includes(r) ? undefined : r}
                  checked={isOn(eff.round, r)}
                  onClick={() => toggle("round", r)} />
              ))}
            </div>
          )}

          {/* Tournament */}
          {openChip === "tournament" && (
            <div style={{ minWidth: 220 }}>
              <input autoFocus type="text" placeholder="Search tournaments…"
                value={tournamentSearch}
                onChange={(e) => setTSearch(e.target.value)}
                className="w-full font-mono text-xs text-text-primary placeholder:text-text-dim px-2 py-1.5 mb-2 rounded"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", outline: "none" }}
              />
              <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto">
                {filteredTourns.length === 0
                  ? <span className="font-mono text-xs text-text-dim px-2 py-1">No results</span>
                  : filteredTourns.map((t) => (
                    <RadioRow key={t} label={t} active={eff.tournament === t}
                      onClick={() => selectSingle({ tournament: eff.tournament === t ? undefined : t })}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Surface */}
          {openChip === "surface" && (
            <div className="flex flex-col gap-2" style={{ minWidth: 160 }}>
              <DropLabel>Court surface</DropLabel>
              {options.surfaces.map((s) => {
                const checked = isOn(eff.surface, s);
                const color   = SURFACE_COLOR[s] ?? "#9ca3af";
                return (
                  <button key={s} onClick={() => toggle("surface", s)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-100 w-full text-left"
                    style={{
                      background: checked ? `${color}20` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${checked ? color : "rgba(255,255,255,0.08)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                    <span className="font-mono text-sm font-medium" style={{ color: checked ? color : "#9ca3af" }}>
                      {s}
                    </span>
                    {checked && (
                      <span className="ml-auto">
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                          <path d="M1 5L4.5 8.5L11 1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Year */}
          {openChip === "year" && (
            <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
              <DropLabel>Year range</DropLabel>
              {yearRanges.length === 0
                ? <span className="font-mono text-xs text-text-dim px-2 py-1">No data</span>
                : yearRanges.map((r) => (
                  <RadioRow key={r.value} label={r.label} active={eff.year === r.value}
                    onClick={() => selectSingle({ year: eff.year === r.value ? undefined : r.value })}
                  />
                ))}
            </div>
          )}

          {/* Sets */}
          {openChip === "sets" && (
            <div>
              <DropLabel>Number of sets</DropLabel>
              <div className="flex gap-2 mt-1">
                {SETS_OPTIONS.map((o) => {
                  const checked = isOn(eff.sets, o.value);
                  return (
                    <button key={o.value} onClick={() => toggle("sets", o.value)}
                      className="font-mono text-base font-bold px-4 py-2 rounded-lg transition-all duration-100"
                      style={{
                        background: checked ? "rgba(34,214,138,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${checked ? "rgba(34,214,138,0.5)" : "rgba(255,255,255,0.1)"}`,
                        color: checked ? "#22d68a" : "#9ca3af",
                        cursor: "pointer",
                        minWidth: 44,
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Min Rating */}
          {openChip === "minRating" && (
            <div style={{ minWidth: 130 }}>
              <DropLabel>Min community rating</DropLabel>
              <div className="flex flex-col gap-1 mt-1">
                {RATING_OPTIONS.map((o) => (
                  <RadioRow key={o.value} label={o.label} active={eff.minRating === o.value}
                    onClick={() => selectSingle({ minRating: eff.minRating === o.value ? undefined : o.value })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Player */}
          {openChip === "player" && (
            <div style={{ minWidth: 220 }}>
              <input autoFocus type="text" placeholder="Search players…"
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                className="w-full font-mono text-xs text-text-primary placeholder:text-text-dim px-2 py-1.5 mb-2 rounded"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", outline: "none" }}
              />
              <div className="flex flex-col gap-0.5">
                {playerQuery.length < 2
                  ? <span className="font-mono text-xs text-text-dim px-2 py-1">Type to search…</span>
                  : playerResults.length === 0
                  ? <span className="font-mono text-xs text-text-dim px-2 py-1">No players found</span>
                  : playerResults.map((p) => (
                    <RadioRow key={p.id} label={p.name}
                      sublabel={p.current_rank ? `#${p.current_rank}` : undefined}
                      active={eff.player === p.id}
                      onClick={() => selectSingle({ player: p.id, playerName: p.name })}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Apply button — shown when pending multi-select changes exist */}
          {Object.keys(pending).length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={applyAndClose}
                className="w-full font-mono text-xs font-semibold py-2 rounded-lg transition-colors duration-150"
                style={{ background: "#22d68a", color: "#0e1116", cursor: "pointer" }}
              >
                Apply filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DropLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider px-1 pb-1">
      {children}
    </p>
  );
}

function ChipBtn({ label, active, isOpen, onToggle, onClear }: {
  label: string; active: boolean; isOpen: boolean; onToggle: () => void; onClear: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <button onClick={onToggle} className="font-mono text-xs transition-colors duration-150"
        style={{
          padding: "6px 12px",
          borderRadius: active ? "20px 0 0 20px" : 20,
          border: `1px solid ${isOpen && !active ? "rgba(255,255,255,0.2)" : active ? "rgba(34,214,138,0.4)" : "rgba(255,255,255,0.1)"}`,
          borderRight: active ? "none" : undefined,
          background: active ? "rgba(34,214,138,0.08)" : isOpen ? "rgba(255,255,255,0.04)" : "transparent",
          color: active ? "#22d68a" : isOpen ? "#e8eaed" : "#9ca3af",
          cursor: "pointer", whiteSpace: "nowrap", maxWidth: 180,
          overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {label}
      </button>
      {active && (
        <button onClick={(e) => { e.stopPropagation(); onClear(); }}
          style={{
            padding: "6px 8px", borderRadius: "0 20px 20px 0",
            border: "1px solid rgba(34,214,138,0.4)", borderLeft: "none",
            background: "rgba(34,214,138,0.08)", color: "#22d68a",
            cursor: "pointer", opacity: 0.7, fontFamily: "monospace", fontSize: 12,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function CheckRow({ label, sublabel, checked, onClick }: {
  label: string; sublabel?: string; checked: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors duration-100"
      style={{ background: checked ? "rgba(34,214,138,0.08)" : "transparent", cursor: "pointer" }}
      onMouseEnter={(e) => { if (!checked) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (!checked) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      <span className="w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center"
        style={{ border: `1.5px solid ${checked ? "#22d68a" : "rgba(255,255,255,0.25)"}`, background: checked ? "#22d68a" : "transparent" }}
      >
        {checked && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="#0e1116" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span className="font-mono text-xs flex-1 truncate" style={{ color: checked ? "#22d68a" : "#9ca3af" }}>{label}</span>
      {sublabel && <span className="font-mono text-[10px] text-text-dim shrink-0">{sublabel}</span>}
    </button>
  );
}

function RadioRow({ label, sublabel, active, onClick }: {
  label: string; sublabel?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors duration-100"
      style={{ background: active ? "rgba(34,214,138,0.08)" : "transparent", cursor: "pointer" }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      <span className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
        style={{ border: `1.5px solid ${active ? "#22d68a" : "rgba(255,255,255,0.25)"}` }}
      >
        {active && <span className="w-2 h-2 rounded-full" style={{ background: "#22d68a" }} />}
      </span>
      <span className="font-mono text-xs flex-1 truncate" style={{ color: active ? "#22d68a" : "#9ca3af" }}>{label}</span>
      {sublabel && <span className="font-mono text-[10px] text-text-dim shrink-0">{sublabel}</span>}
    </button>
  );
}
