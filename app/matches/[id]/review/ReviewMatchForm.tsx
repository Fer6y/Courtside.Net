"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitMatchReview } from "./actions";
import { useToast } from "@/components/toast/ToastContext";
import AchievementBanner from "@/components/AchievementBanner";

interface Player {
  id: string;
  name: string;
}

interface Props {
  matchId: string;
  player1: Player;
  player2: Player;
  existing: {
    match_rating: number;
    player1_rating: number;
    player2_rating: number;
    comment: string | null;
    is_favorited: boolean;
    collection_name: string | null;
  } | null;
}

function RatingSlider({
  name,
  label,
  value,
  color,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-sans text-sm font-medium text-text-primary">{label}</span>
        <span
          className="font-mono text-xl font-bold tabular-nums"
          style={{ color, minWidth: 36, textAlign: "right" }}
        >
          {value.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        name={name}
        min={1}
        max={10}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
          accentColor: color,
        }}
      />
      <div className="flex justify-between mt-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <span key={n} className="font-mono text-[10px] text-text-dim">{n}</span>
        ))}
      </div>
    </div>
  );
}

export default function ReviewMatchForm({ matchId, player1, player2, existing }: Props) {
  const [matchRating,   setMatchRating]   = useState(existing?.match_rating   ?? 7.0);
  const [player1Rating, setPlayer1Rating] = useState(existing?.player1_rating ?? 7.0);
  const [player2Rating, setPlayer2Rating] = useState(existing?.player2_rating ?? 7.0);
  const [comment,       setComment]       = useState(existing?.comment        ?? "");
  const [favorited,     setFavorited]     = useState(existing?.is_favorited   ?? false);
  const [collection,    setCollection]    = useState(existing?.collection_name ?? "");
  const [pending,       setPending]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [earnedIds,     setEarnedIds]     = useState<string[]>([]);

  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();
  const toast   = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const toastId = toast.loading("Saving review…");
    try {
      const fd = new FormData(formRef.current!);
      fd.set("is_favorited", String(favorited));
      const result = await submitMatchReview(matchId, fd);
      toast.success(toastId, "Review saved!");
      setPending(false);
      if (result.newAchievements?.length) setEarnedIds(result.newAchievements);
      router.push(`/matches/${matchId}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(toastId, msg);
      setError(msg);
      setPending(false);
    }
  }

  return (
    <>
    <AchievementBanner achievementIds={earnedIds} onClear={() => setEarnedIds([])} />
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="flex flex-col gap-10">

        {/* ── Match quality ───────────────────────────────────────── */}
        <section>
          <div className="font-mono text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
            style={{ color: "#f5c518", borderColor: "#f5c51822" }}>
            Match Quality
          </div>
          <RatingSlider
            name="match_rating"
            label="How good was this match overall?"
            value={matchRating}
            color="#f5c518"
            onChange={setMatchRating}
          />
        </section>

        {/* ── Player performances ──────────────────────────────────── */}
        <section>
          <div className="font-mono text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
            style={{ color: "#9ca3af", borderColor: "rgba(255,255,255,0.06)" }}>
            Player Performances
          </div>
          <div className="flex flex-col gap-6">
            <RatingSlider
              name="player1_rating"
              label={player1.name}
              value={player1Rating}
              color="#22d68a"
              onChange={setPlayer1Rating}
            />
            <RatingSlider
              name="player2_rating"
              label={player2.name}
              value={player2Rating}
              color="#4a9eff"
              onChange={setPlayer2Rating}
            />
          </div>
        </section>

        {/* ── Comment ─────────────────────────────────────────────── */}
        <section>
          <div className="font-mono text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
            style={{ color: "#9ca3af", borderColor: "rgba(255,255,255,0.06)" }}>
            Review
          </div>
          <textarea
            name="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What made this match memorable? Describe the key moments, the atmosphere, the level of play..."
            rows={4}
            className="w-full rounded-lg px-4 py-3 font-sans text-sm text-text-primary placeholder:text-text-dim resize-none transition-colors duration-150"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.18)")}
            onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          <div className="text-right mt-1">
            <span className="font-mono text-xs text-text-dim">{comment.length} chars</span>
          </div>
        </section>

        {/* ── Catalog options ──────────────────────────────────────── */}
        <section>
          <div className="font-mono text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
            style={{ color: "#9ca3af", borderColor: "rgba(255,255,255,0.06)" }}>
            Catalogue
          </div>

          <div className="flex flex-col gap-4">
            {/* Favorite toggle */}
            <button
              type="button"
              onClick={() => setFavorited((f) => !f)}
              className="flex items-center gap-3 w-fit group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150"
                style={{
                  background: favorited ? "rgba(245,197,24,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${favorited ? "rgba(245,197,24,0.4)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={favorited ? "#f5c518" : "none"}
                  stroke={favorited ? "#f5c518" : "rgba(255,255,255,0.3)"} strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="font-sans text-sm text-text-primary">
                  {favorited ? "Favorited" : "Add to favorites"}
                </div>
                <div className="font-mono text-xs text-text-dim">
                  Appears in your favorites on your profile
                </div>
              </div>
            </button>

            {/* Collection / folder */}
            <div>
              <label className="font-sans text-sm text-text-primary block mb-2">
                Add to collection
              </label>
              <input
                type="text"
                name="collection_name"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="e.g. Wimbledon Finals, Epics, 2024 Highlights"
                className="w-full rounded-lg px-4 py-2.5 font-sans text-sm text-text-primary placeholder:text-text-dim transition-colors duration-150"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.18)")}
                onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
              />
              <p className="font-mono text-xs text-text-dim mt-1.5">
                Type a name to organize this match into a folder on your profile. Leave blank to skip.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Error */}
      {error && (
        <p className="font-mono text-xs text-loss mt-6">{error}</p>
      )}

      {/* Submit */}
      <div className="mt-8 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="font-mono text-sm px-6 py-3 rounded-lg font-semibold transition-all duration-150"
          style={{
            background: pending ? "rgba(34,214,138,0.3)" : "#22d68a",
            color: pending ? "rgba(255,255,255,0.5)" : "#0e1116",
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "Saving…" : existing ? "Update Review" : "Submit Review"}
        </button>
        <a
          href={`/matches/${matchId}`}
          className="font-mono text-sm px-6 py-3 rounded-lg border border-white/10 text-text-dim hover:text-text-primary transition-colors duration-150"
        >
          Cancel
        </a>
      </div>
    </form>
    </>
  );
}
