import Link from "next/link";
import PlayerNameWithBubble from "@/components/PlayerNameWithBubble";
import type { MatchWithPlayers, Surface } from "@/types";

// Per-match community review summary, batched on the page.
export interface MatchReviewSummary {
  avg: number;
  count: number;
  topExcerpt: string | null;
}

const SURFACE_COLORS: Record<Surface, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c", Carpet: "#9ca3af",
};

const ROUND_SHORT: Record<string, string> = {
  "Round of 128": "R128", "Round of 64": "R64",
  "Round of 32":  "R32",  "Round of 16": "R16",
  "Quarterfinal": "QF",   "Semifinal":   "SF",
  "Final":        "F",    "Round Robin": "RR",
};

// Short tournament monogram for the meta line. Slams get their initials;
// everything else shows its name with the trailing year stripped.
function tournamentAbbrev(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("australian open")) return "AO";
  if (n.includes("roland garros") || n.includes("french open")) return "RG";
  if (n.includes("wimbledon")) return "W";
  if (n.includes("us open")) return "USO";
  return name.replace(/\s+\d{4}$/, "").toUpperCase();
}

export default function MatchCard({
  match,
  summary,
}: {
  match: MatchWithPlayers;
  summary: MatchReviewSummary | null;
}) {
  const surface = match.surface as Surface | null;
  const p1Won = !!match.winner_id && match.winner_id === match.player1?.id;
  const p2Won = !!match.winner_id && match.winner_id === match.player2?.id;
  const hasWinner = p1Won || p2Won;

  // Winner reads first on the bill — "Alcaraz d. Sinner"
  const first  = p2Won ? match.player2 : match.player1;
  const second = p2Won ? match.player1 : match.player2;

  const abbrev = tournamentAbbrev(match.tournament);
  const tier   = match.tournament_tier;
  const abbrevColor =
    tier === "grand_slam"   ? "#c9a96a" :
    tier === "masters_1000" ? "rgba(192,192,192,0.7)" :
    "rgba(236,229,216,0.45)";
  const year  = match.match_date?.slice(0, 4);
  const round = ROUND_SHORT[match.round ?? ""] ?? match.round;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex flex-col gap-2.5 transition-colors duration-150"
      style={{
        padding: "14px 14px",
        border: "0.5px solid var(--hairline-soft)",
        borderRadius: 12,
        background: "rgba(236,229,216,0.018)",
        marginTop: 10,
      }}
    >
      {/* Match-up + score */}
      <div className="flex items-baseline justify-between gap-x-4 gap-y-0.5 flex-wrap">
        <span className="bill-name min-w-0 text-[16px] sm:text-[18px]">
          <span style={{ fontWeight: hasWinner ? 500 : 400, color: "#ece5d8" }}>
            <PlayerNameWithBubble playerId={first.id} playerName={first?.name ?? "Unknown"} />
          </span>
          <span className="italic" style={{ fontWeight: 300, fontSize: 13, color: "rgba(236,229,216,0.4)" }}>
            {" "}{hasWinner ? "d." : "v."}{" "}
          </span>
          <span style={{ fontWeight: 300, color: hasWinner ? "rgba(236,229,216,0.65)" : "#ece5d8" }}>
            <PlayerNameWithBubble playerId={second.id} playerName={second?.name ?? "Unknown"} />
          </span>
        </span>
        {match.score && (
          <span className="font-mono shrink-0" style={{ fontSize: 13, color: "#ece5d8", letterSpacing: "0.02em" }}>
            {match.score}
          </span>
        )}
      </div>

      {/* Meta line */}
      <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.08em", color: "rgba(236,229,216,0.45)" }}>
        <span style={{ color: abbrevColor }}>{abbrev}</span>
        {round && <> · {round}</>}
        {surface && <> · <span style={{ color: SURFACE_COLORS[surface] }}>{surface.toUpperCase()}</span></>}
        {year && <> · {year}</>}
      </span>

      {/* Footer — community rating + excerpt, or a nudge */}
      <div
        className="flex items-center gap-2.5 min-w-0"
        style={{ paddingTop: 8, borderTop: "0.5px solid var(--hairline-soft)" }}
      >
        {summary && summary.count > 0 ? (
          <>
            <span className="font-mono shrink-0" style={{ fontSize: 15, fontWeight: 600, color: "#c9a96a" }}>
              {summary.avg.toFixed(1)}
            </span>
            {summary.topExcerpt ? (
              <span
                className="bill-name italic truncate min-w-0"
                style={{ fontWeight: 300, fontSize: 13, color: "rgba(236,229,216,0.6)" }}
              >
                &ldquo;{summary.topExcerpt}&rdquo;
              </span>
            ) : (
              <span className="eyebrow shrink-0" style={{ fontSize: 9, color: "rgba(236,229,216,0.35)" }}>
                {summary.count} rating{summary.count !== 1 ? "s" : ""}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="eyebrow shrink-0" style={{ fontSize: 9, color: "rgba(236,229,216,0.35)" }}>
              No reviews yet —
            </span>
            <span className="font-mono" style={{ fontSize: 11, color: "#22d68a" }}>
              be the first to score it
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
