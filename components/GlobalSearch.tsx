"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { AvatarConfig } from "@/lib/avatarTemplates";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlayerResult {
  id:           string;
  name:         string;
  country:      string | null;
  current_rank: number | null;
}

interface ProfileResult {
  id:           string;
  username:     string;
  display_name: string | null;
  avatar_config: AvatarConfig | null;
}

interface SearchResults {
  players:  PlayerResult[];
  profiles: ProfileResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string | null, fallback: string) {
  const result = (name ?? fallback)
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return result || (fallback[0]?.toUpperCase() ?? "?");
}

// Flag emoji from ISO country code
function flag(code: string | null) {
  if (!code || code.length !== 3) return "";
  // ATP uses 3-letter codes; map common ones
  const map: Record<string, string> = {
    USA: "🇺🇸", ESP: "🇪🇸", SRB: "🇷🇸", RUS: "🇷🇺", GER: "🇩🇪",
    ITA: "🇮🇹", GBR: "🇬🇧", AUS: "🇦🇺", FRA: "🇫🇷", ARG: "🇦🇷",
    CAN: "🇨🇦", JPN: "🇯🇵", NOR: "🇳🇴", GRE: "🇬🇷", POL: "🇵🇱",
    DEN: "🇩🇰", SUI: "🇨🇭", BRA: "🇧🇷", CZE: "🇨🇿", AUT: "🇦🇹",
    BUL: "🇧🇬", CHI: "🇨🇱", COL: "🇨🇴", CRO: "🇭🇷", KAZ: "🇰🇿",
    NED: "🇳🇱", RSA: "🇿🇦", SWE: "🇸🇪", TPE: "🇹🇼", UKR: "🇺🇦",
  };
  return map[code] ?? "";
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  /** Controlled open state — parent manages this */
  open:     boolean;
  onClose:  () => void;
}

export default function GlobalSearch({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef    = useRef<HTMLInputElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);

  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<SearchResults>({ players: [], profiles: [] });
  const [loading,   setLoading]   = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({ players: [], profiles: [] });
      setActiveIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (query.length < 2) {
      setResults({ players: [], profiles: [] });
      setActiveIdx(-1);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as SearchResults;
        setResults(data);
        setActiveIdx(-1);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  // Flatten all items for keyboard nav
  const allItems: Array<{ type: "player"; data: PlayerResult } | { type: "profile"; data: ProfileResult }> = [
    ...results.players.map((p) => ({ type: "player" as const, data: p })),
    ...results.profiles.map((p) => ({ type: "profile" as const, data: p })),
  ];

  const navigate = useCallback((item: typeof allItems[number]) => {
    if (item.type === "player")  router.push(`/players/${item.data.id}`);
    if (item.type === "profile") router.push(`/profile/${(item.data as ProfileResult).username}`);
    onClose();
  }, [router, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, allItems.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
      }
      if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        navigate(allItems[activeIdx]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeIdx, allItems, navigate, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0) return;
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  const hasResults = results.players.length > 0 || results.profiles.length > 0;
  const showEmpty  = query.length >= 2 && !loading && !hasResults;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200]"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 z-[201] w-full max-w-xl -translate-x-1/2"
        style={{ top: "10vh" }}
        role="dialog"
        aria-label="Search"
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#1a1e26",
            border:     "1px solid rgba(255,255,255,0.1)",
            boxShadow:  "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          {/* Input row */}
          <div
            className="flex items-center gap-3 px-4"
            style={{ borderBottom: hasResults || loading || showEmpty ? "1px solid rgba(255,255,255,0.07)" : "none" }}
          >
            <Search size={16} color="#6b7280" strokeWidth={2} className="shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players or profiles…"
              className="flex-1 bg-transparent font-sans text-sm text-text-primary outline-none py-4 placeholder:text-text-dim"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-text-dim hover:text-text-mid transition-colors">
                <X size={14} />
              </button>
            )}
            <kbd
              className="font-mono text-[10px] px-1.5 py-0.5 rounded border shrink-0"
              style={{ color: "#6b7280", borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
            >
              esc
            </kbd>
          </div>

          {/* Results */}
          {(hasResults || loading || showEmpty) && (
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">

              {loading && (
                <p className="font-mono text-xs text-text-dim px-4 py-3">Searching…</p>
              )}

              {showEmpty && (
                <p className="font-mono text-xs text-text-dim px-4 py-3">No results for &ldquo;{query}&rdquo;</p>
              )}

              {/* Players */}
              {results.players.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim px-4 pt-2 pb-1.5">
                    Players
                  </p>
                  {results.players.map((p, i) => {
                    const idx    = i;
                    const active = activeIdx === idx;
                    return (
                      <button
                        key={p.id}
                        data-idx={idx}
                        onClick={() => navigate({ type: "player", data: p })}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
                        style={{ background: active ? "rgba(255,255,255,0.06)" : "transparent" }}
                      >
                        {/* Mini tennis ball icon */}
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "rgba(34,214,138,0.12)", color: "#22d68a" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 100 100" fill="none">
                            <circle cx="50" cy="50" r="44" fill="#22d68a" />
                            <path d="M6 50 C6 24, 28 8, 50 50 C72 92, 94 76, 94 50" stroke="#0e1116" strokeWidth="10" strokeLinecap="round" fill="none"/>
                            <path d="M6 50 C6 76, 28 92, 50 50 C72 8, 94 24, 94 50" stroke="#0e1116" strokeWidth="10" strokeLinecap="round" fill="none"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-sans text-sm text-text-primary block truncate">{p.name}</span>
                          <span className="font-mono text-[10px] text-text-dim">
                            {flag(p.country)}{p.country ? ` ${p.country}` : ""}
                            {p.current_rank ? ` · #${p.current_rank}` : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Profiles */}
              {results.profiles.length > 0 && (
                <div className={results.players.length > 0 ? "mt-1" : ""}>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim px-4 pt-2 pb-1.5">
                    Members
                  </p>
                  {results.profiles.map((p, i) => {
                    const idx    = results.players.length + i;
                    const active = activeIdx === idx;
                    const name   = p.display_name ?? p.username;
                    return (
                      <button
                        key={p.id}
                        data-idx={idx}
                        onClick={() => navigate({ type: "profile", data: p })}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
                        style={{ background: active ? "rgba(255,255,255,0.06)" : "transparent" }}
                      >
                        <UserAvatar
                          config={p.avatar_config}
                          initials={initials(name, p.username)}
                          size={28}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-sans text-sm text-text-primary block truncate">{name}</span>
                          <span className="font-mono text-[10px] text-text-dim">@{p.username}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer hint */}
              {hasResults && (
                <div
                  className="flex items-center gap-4 px-4 py-2 mt-1"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="font-mono text-[9px] text-text-dim">↑↓ navigate</span>
                  <span className="font-mono text-[9px] text-text-dim">↵ open</span>
                  <span className="font-mono text-[9px] text-text-dim">esc close</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
