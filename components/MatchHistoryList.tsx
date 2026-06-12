"use client";

import { useState } from "react";
import Link from "next/link";
import type { MatchWithPlayers } from "@/types";

const INITIAL_COUNT = 10;

const surfaceColor: Record<string, string> = {
  Hard:  "#4a90d9",
  Clay:  "#d4734e",
  Grass: "#5cb85c",
};

const ROUND_SHORT: Record<string, string> = {
  "Round of 128": "R128", "Round of 64": "R64",
  "Round of 32":  "R32",  "Round of 16": "R16",
  "Quarterfinal": "QF",   "Semifinal":   "SF",
  "Final":        "F",    "Round Robin": "RR",
};

function MatchRow({ match, playerId }: { match: MatchWithPlayers; playerId: string }) {
  const won = match.winner_id === playerId;
  const opponent = match.player1_id === playerId ? match.player2 : match.player1;
  const round = ROUND_SHORT[match.round ?? ""] ?? match.round;

  return (
    <div
      className="flex items-baseline justify-between gap-x-4 gap-y-0.5 flex-wrap py-3 px-1 transition-colors duration-150"
      style={{ borderBottom: "1px solid var(--hairline-soft)" }}
    >
      <span className="min-w-0 flex items-baseline gap-2">
        <span
          className="font-mono text-xs font-bold w-4 shrink-0"
          style={{ color: won ? "#22d68a" : "#e74c3c" }}
        >
          {won ? "W" : "L"}
        </span>
        <Link href={`/matches/${match.id}`} className="bill-name truncate" style={{ fontSize: 15 }}>
          <span className="italic" style={{ fontWeight: 300, fontSize: 13, color: "rgba(236,229,216,0.4)" }}>
            {won ? "d. " : "to "}
          </span>
          <span style={{ color: "#ece5d8" }}>{opponent?.name ?? "Unknown"}</span>
        </Link>
        {opponent?.id && (
          <Link
            href={`/h2h/${playerId}/${opponent.id}`}
            className="eyebrow shrink-0 transition-colors duration-150"
            style={{ fontSize: 8, color: "rgba(236,229,216,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            H2H
          </Link>
        )}
      </span>

      <span
        className="font-mono shrink-0"
        style={{ fontSize: 11, letterSpacing: "0.08em", color: "rgba(236,229,216,0.45)" }}
      >
        {match.score && <span className="hidden sm:inline">{match.score} · </span>}
        {round && <>{round} · </>}
        {match.surface && (
          <span style={{ color: surfaceColor[match.surface] ?? "rgba(236,229,216,0.45)" }}>
            {match.surface.toUpperCase()}
          </span>
        )}
        {match.match_date && <> · {match.match_date.slice(0, 4)}</>}
      </span>
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
      <div>
        {visible.map((match) => (
          <MatchRow key={match.id} match={match} playerId={playerId} />
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="eyebrow mt-4 w-full py-2.5 rounded-md transition-all duration-150"
          style={{ fontSize: 10, color: "rgba(236,229,216,0.4)", border: "1px solid var(--hairline-soft)" }}
        >
          Show {hiddenCount} more {hiddenCount === 1 ? "match" : "matches"}
        </button>
      )}

      {expanded && matches.length > INITIAL_COUNT && (
        <button
          onClick={() => setExpanded(false)}
          className="eyebrow mt-4 w-full py-2.5 rounded-md transition-all duration-150"
          style={{ fontSize: 10, color: "rgba(236,229,216,0.4)", border: "1px solid var(--hairline-soft)" }}
        >
          Show less
        </button>
      )}
    </>
  );
}
