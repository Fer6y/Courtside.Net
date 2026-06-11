"use client";

import { useState } from "react";
import Link from "next/link";
import type { MatchWithPlayers } from "@/types";

const INITIAL_COUNT = 10;

const surfaceColor: Record<string, string> = {
  Hard:  "text-court-hard",
  Clay:  "text-court-clay",
  Grass: "text-court-grass",
};

function MatchRow({ match, playerId }: { match: MatchWithPlayers; playerId: string }) {
  const won = match.winner_id === playerId;
  const opponent = match.player1_id === playerId ? match.player2 : match.player1;

  return (
    <div className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group">
      <div className="flex items-center gap-4 min-w-0">
        <span className={`font-mono text-xs font-bold w-5 shrink-0 ${won ? "text-primary" : "text-loss"}`}>
          {won ? "W" : "L"}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/matches/${match.id}`}
            className="font-sans text-text-primary group-hover:text-primary transition-colors duration-150 truncate"
          >
            {opponent?.name ?? "Unknown"}
          </Link>
          {opponent?.id && (
            <Link
              href={`/h2h/${playerId}/${opponent.id}`}
              className="font-mono text-xs text-text-dim hover:text-accent transition-colors duration-150 shrink-0 border border-white/10 hover:border-accent/30 px-1.5 py-0.5 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              H2H
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-right">
        {match.score && (
          <span className="font-mono text-sm text-text-dim hidden sm:block">
            {match.score}
          </span>
        )}
        {match.surface && (
          <span className={`font-mono text-xs ${surfaceColor[match.surface] ?? "text-text-dim"}`}>
            {match.surface}
          </span>
        )}
        <span className="font-sans text-xs text-text-dim hidden md:block">
          {match.tournament} · {match.round}
        </span>
        {match.match_date && (
          <span className="font-mono text-xs text-text-dim">
            {match.match_date.slice(0, 4)}
          </span>
        )}
        <Link
          href={`/matches/${match.id}`}
          className="font-mono text-xs text-text-dim hover:text-text-mid transition-colors duration-150 shrink-0"
        >
          →
        </Link>
      </div>
    </div>
  );
}

export default function MatchHistoryList({
  matches,
  playerId,
}: {
  matches: MatchWithPlayers[];
  playerId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? matches : matches.slice(0, INITIAL_COUNT);
  const hiddenCount = matches.length - INITIAL_COUNT;

  return (
    <>
      <div className="divide-y divide-white/5">
        {visible.map((match) => (
          <MatchRow key={match.id} match={match} playerId={playerId} />
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 w-full py-2.5 rounded-lg font-mono text-xs text-text-dim hover:text-text-mid border border-white/5 hover:border-white/10 transition-all duration-150"
        >
          Show {hiddenCount} more {hiddenCount === 1 ? "match" : "matches"}
        </button>
      )}

      {expanded && matches.length > INITIAL_COUNT && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-4 w-full py-2.5 rounded-lg font-mono text-xs text-text-dim hover:text-text-mid border border-white/5 hover:border-white/10 transition-all duration-150"
        >
          Show less
        </button>
      )}
    </>
  );
}
