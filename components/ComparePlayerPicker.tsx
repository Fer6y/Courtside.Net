"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface PlayerOption {
  id: string;
  name: string;
  country: string | null;
  current_rank: number | null;
}

interface Props {
  p1Id: string;
  p1Tour: string;
  similarPlayers: PlayerOption[];
}

export default function ComparePlayerPicker({
  p1Id,
  p1Tour,
  similarPlayers,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(query)}&tour=${p1Tour}`
        );
        const data: PlayerOption[] = await res.json();
        setResults(data.filter((p) => p.id !== p1Id));
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query, p1Tour, p1Id]);

  const select = (p2Id: string) => {
    router.push(`/h2h/${p1Id}/${p2Id}`);
  };

  const displayList = query.length >= 2 ? results : similarPlayers;

  return (
    <div>
      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a player..."
        className="w-full font-sans text-sm text-text-primary bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-primary/40 transition-colors duration-150 placeholder:text-text-dim mb-6"
      />

      {/* Section label */}
      <p className="font-mono text-xs text-text-dim uppercase tracking-widest mb-4">
        {query.length >= 2 ? "Results" : "Similar ranking"}
      </p>

      {/* Grid */}
      {searching ? (
        <p className="font-mono text-xs text-text-dim">Searching...</p>
      ) : displayList.length === 0 ? (
        <p className="font-mono text-xs text-text-dim">
          {query.length >= 2 ? "No players found." : "No similar players found."}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayList.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p.id)}
              className="text-left rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 group"
            >
              <div className="font-sans text-sm text-text-primary group-hover:text-primary transition-colors duration-150 truncate">
                {p.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {p.country && (
                  <span className="font-mono text-xs text-text-dim">
                    {p.country}
                  </span>
                )}
                {p.current_rank && (
                  <span className="font-mono text-xs text-text-dim">
                    #{p.current_rank}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
