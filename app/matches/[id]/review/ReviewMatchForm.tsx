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

// Menu-style rating row: serif/sans label, mono value, a ruled hairline track
// with a hollow gold thumb (.prog-slider). `serif` renders the label as a
// bill-name — used for the player names in the performance rows.
function RatingSlider({
  name,
  label,
  value,
  serif = false,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  serif?: boolean;
  onChange: (v: number) => void;
}) {
  const pct = ((value - 1) / 9) * 100;
  const accent = "#c9a96a";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <span
          className={serif ? "bill-name" : "font-sans text-sm"}
          style={serif ? { fontSize: 17, fontWeight: 500 } : { color: "#e8eaed" }}
        >
          {label}
        </span>
        <span
          className="font-mono tabular-nums"
          style={{ fontSize: 20, fontWeight: 600, color: accent, minWidth: 40, textAlign: "right" }}
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
        className="prog-slider"
        style={{ "--fill": pct, "--accent": accent } as React.CSSProperties}
      />
      <div className="flex justify-between mt-2">
        {[1, 5, 10].map((n) => (
          <span key={n} className="eyebrow" style={{ fontSize: 9, color: "rgba(236,229,216,0.3)" }}>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

// Eyebrow label over a hairline rule — the Programme section header.
function SectionLabel({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <>
      <div className="eyebrow mb-2" style={{ fontSize: 10, color: gold ? "#c9a96a" : "rgba(236,229,216,0.55)" }}>
        {children}
      </div>
      <hr className="rule mb-5" />
    </>
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
          <SectionLabel gold>Match Quality</SectionLabel>
          <RatingSlider
            name="match_rating"
            label="How good was this match overall?"
            value={matchRating}
            onChange={setMatchRating}
          />
        </section>

        {/* ── Player performances ──────────────────────────────────── */}
        <section>
          <SectionLabel>Player Performances</SectionLabel>
          <div className="flex flex-col gap-7">
            <RatingSlider
              name="player1_rating"
              label={player1.name}
              value={player1Rating}
              serif
              onChange={setPlayer1Rating}
            />
            <RatingSlider
              name="player2_rating"
              label={player2.name}
              value={player2Rating}
              serif
              onChange={setPlayer2Rating}
            />
          </div>
        </section>

        {/* ── Comment ─────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Review</SectionLabel>
          <textarea
            name="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What made this match memorable? Describe the key moments, the atmosphere, the level of play..."
            rows={4}
            className="w-full rounded-md px-4 py-3 font-sans text-sm text-text-primary placeholder:text-text-dim resize-none transition-colors duration-150"
            style={{
              background: "rgba(236,229,216,0.03)",
              border: "1px solid var(--hairline)",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(201,169,106,0.5)")}
            onBlur={(e)  => (e.target.style.borderColor = "var(--hairline)")}
          />
          <div className="text-right mt-1">
            <span className="font-mono text-xs text-text-dim">{comment.length} chars</span>
          </div>
        </section>

        {/* ── Catalog options ──────────────────────────────────────── */}
        <section>
          <SectionLabel>Catalogue</SectionLabel>

          <div className="flex flex-col gap-4">
            {/* Favorite toggle */}
            <button
              type="button"
              onClick={() => setFavorited((f) => !f)}
              className="flex items-center gap-3 w-fit group"
            >
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center transition-all duration-150"
                style={{
                  background: favorited ? "rgba(201,169,106,0.15)" : "rgba(236,229,216,0.04)",
                  border: `1px solid ${favorited ? "rgba(201,169,106,0.45)" : "var(--hairline)"}`,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={favorited ? "#c9a96a" : "none"}
                  stroke={favorited ? "#c9a96a" : "rgba(236,229,216,0.3)"} strokeWidth="1.5">
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
                className="w-full rounded-md px-4 py-2.5 font-sans text-sm text-text-primary placeholder:text-text-dim transition-colors duration-150"
                style={{
                  background: "rgba(236,229,216,0.03)",
                  border: "1px solid var(--hairline)",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(201,169,106,0.5)")}
                onBlur={(e)  => (e.target.style.borderColor = "var(--hairline)")}
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
      <div className="mt-10 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="eyebrow rounded-md px-6 py-3 font-semibold transition-all duration-150"
          style={{
            fontSize: 11,
            background: pending ? "rgba(34,214,138,0.3)" : "#22d68a",
            color: pending ? "rgba(255,255,255,0.5)" : "#0d1a11",
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "Saving…" : existing ? "Update Review" : "Submit Review"}
        </button>
        <a
          href={`/matches/${matchId}`}
          className="eyebrow rounded-md px-6 py-3 transition-colors duration-150"
          style={{ fontSize: 11, border: "1px solid rgba(201,169,106,0.45)", color: "#c9a96a" }}
        >
          Cancel
        </a>
      </div>
    </form>
    </>
  );
}
