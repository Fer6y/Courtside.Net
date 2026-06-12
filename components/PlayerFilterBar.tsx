"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const RANK_OPTIONS = [
  { label: "Top 10",  value: "10" },
  { label: "Top 25",  value: "25" },
  { label: "Top 50",  value: "50" },
  { label: "Top 100", value: "100" },
];

export interface PlayerFilters {
  country?:  string;
  rankMax?:  string;
}

interface Props {
  filters: PlayerFilters;
  countries: string[];
  basePath: string;
  extraParams?: Record<string, string>; // tour, sort — preserved on navigate
}

export default function PlayerFilterBar({ filters, countries, basePath, extraParams = {} }: Props) {
  const router = useRouter();
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function navigate(updates: Partial<PlayerFilters>) {
    const next: Record<string, string> = { ...extraParams };
    const merged = { ...filters, ...updates };
    if (merged.country) next.country = merged.country;
    if (merged.rankMax) next.rankMax = merged.rankMax;
    const qs = new URLSearchParams(next).toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    setOpenChip(null);
    setCountrySearch("");
  }

  function clearFilter(...keys: string[]) {
    const next: Record<string, string> = { ...extraParams };
    if (!keys.includes("country") && filters.country) next.country = filters.country;
    if (!keys.includes("rankMax") && filters.rankMax) next.rankMax = filters.rankMax;
    const qs = new URLSearchParams(next).toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    setOpenChip(null);
  }

  function clearAll() {
    const qs = new URLSearchParams(extraParams).toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
    setOpenChip(null);
  }

  const hasAnyFilter = !!(filters.country || filters.rankMax);

  const filteredCountries = countrySearch.trim()
    ? countries.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase()))
    : countries;

  const rankLabel = RANK_OPTIONS.find((o) => o.value === filters.rankMax)?.label;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >

        {/* Rank range */}
        <Chip
          label="Rank"
          value={rankLabel}
          isOpen={openChip === "rank"}
          onToggle={() => setOpenChip(openChip === "rank" ? null : "rank")}
          onClear={() => clearFilter("rankMax")}
        >
          <div className="flex flex-col gap-0.5" style={{ minWidth: 110 }}>
            {RANK_OPTIONS.map((o) => (
              <OptionButton
                key={o.value}
                label={o.label}
                active={filters.rankMax === o.value}
                onClick={() =>
                  filters.rankMax === o.value
                    ? clearFilter("rankMax")
                    : navigate({ rankMax: o.value })
                }
              />
            ))}
          </div>
        </Chip>

        {/* Country */}
        <Chip
          label="Country"
          value={filters.country}
          isOpen={openChip === "country"}
          onToggle={() => setOpenChip(openChip === "country" ? null : "country")}
          onClear={() => clearFilter("country")}
        >
          <div style={{ minWidth: 180 }}>
            <input
              autoFocus
              type="text"
              placeholder="Search countries…"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="w-full font-mono text-xs text-text-primary placeholder:text-text-dim px-2 py-1.5 mb-2 rounded"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                outline: "none",
              }}
            />
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
              {filteredCountries.length === 0 ? (
                <span className="font-mono text-xs text-text-dim px-2 py-1">No results</span>
              ) : (
                filteredCountries.map((c) => (
                  <OptionButton
                    key={c}
                    label={c}
                    active={filters.country === c}
                    onClick={() =>
                      filters.country === c ? clearFilter("country") : navigate({ country: c })
                    }
                  />
                ))
              )}
            </div>
          </div>
        </Chip>

        {/* Clear all */}
        {hasAnyFilter && (
          <button
            onClick={clearAll}
            className="font-mono text-xs text-text-dim hover:text-text-primary transition-colors duration-150 shrink-0 px-2"
            style={{ whiteSpace: "nowrap" }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Chip({
  label, value, isOpen, onToggle, onClear, children,
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
          className="font-mono transition-colors duration-150"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "6px 2px 4px",
            border: "none",
            borderBottom: active
              ? "1px solid rgba(201,169,106,0.6)"
              : isOpen
              ? "1px solid rgba(236,229,216,0.3)"
              : "1px solid transparent",
            background: "transparent",
            color: active ? "#c9a96a" : isOpen ? "#ece5d8" : "rgba(236,229,216,0.45)",
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
            className="font-mono transition-colors duration-150"
            aria-label={`Clear ${label} filter`}
            style={{
              padding: "4px 4px",
              border: "none",
              background: "transparent",
              color: "rgba(201,169,106,0.7)",
              cursor: "pointer",
              fontSize: 11,
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
            background: "#171b17",
            border: "1px solid var(--hairline)",
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
  label, active, onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left font-mono text-xs px-2 py-1.5 rounded transition-colors duration-100"
      style={{
        background: active ? "rgba(201,169,106,0.1)" : "transparent",
        color: active ? "#c9a96a" : "rgba(236,229,216,0.55)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(236,229,216,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {active && <span style={{ opacity: 0.6 }}>✓</span>}
    </button>
  );
}
