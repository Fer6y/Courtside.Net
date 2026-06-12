"use client";

import { useState, useTransition, useCallback } from "react";
import { Flame, Zap, ThumbsDown } from "lucide-react";
import { toggleReaction } from "@/app/actions/reactions";

// Thin line icons in the programme's cream/gold palette — replaced the
// emoji set (🔥😲👎) in the redesign. Keys are unchanged so stored
// reactions keep working.
export const REACTION_EMOJIS = [
  { key: "fire",    Icon: Flame,     label: "Fire"    },
  { key: "shocked", Icon: Zap,       label: "Shocked" },
  { key: "dislike", Icon: ThumbsDown, label: "Dislike" },
] as const;

export type EmojiKey = "fire" | "shocked" | "dislike";

export interface ReactionCount {
  count: number;
  mine: boolean;
}

export type ReactionSummary = Record<EmojiKey, ReactionCount>;

export const EMPTY_REACTIONS: ReactionSummary = {
  fire:    { count: 0, mine: false },
  shocked: { count: 0, mine: false },
  dislike: { count: 0, mine: false },
};

interface Props {
  targetType: "review" | "comment";
  targetId: string;
  initial: ReactionSummary;
  isLoggedIn: boolean;
  size?: "sm" | "md";
}

export default function ReactionBar({
  targetType,
  targetId,
  initial,
  isLoggedIn,
  size = "md",
}: Props) {
  const [reactions, setReactions]   = useState<ReactionSummary>(initial);
  const [animating, setAnimating]   = useState<EmojiKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = useCallback((key: EmojiKey) => {
    if (!isLoggedIn || isPending) return;

    // Trigger pop — clear after animation finishes so it can re-trigger
    setAnimating(null);
    requestAnimationFrame(() => setAnimating(key));
    setTimeout(() => setAnimating(null), 500);

    const prev = reactions[key];
    setReactions((r) => ({
      ...r,
      [key]: { count: prev.mine ? prev.count - 1 : prev.count + 1, mine: !prev.mine },
    }));
    startTransition(async () => {
      try {
        await toggleReaction(targetType, targetId, key);
      } catch {
        setReactions((r) => ({ ...r, [key]: prev }));
      }
    });
  }, [isLoggedIn, isPending, reactions, targetType, targetId]);

  const emojiSize = size === "sm" ? 12 : 14;
  const countSize = size === "sm" ?  9 : 11;
  const padding   = size === "sm" ? "px-1.5 py-0.5" : "px-2.5 py-1";

  return (
    <div className="flex items-center gap-1.5">
      {REACTION_EMOJIS.map(({ key, Icon, label }) => {
        const r       = reactions[key];
        const isAnim  = animating === key;

        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            disabled={isPending}
            title={isLoggedIn ? (r.mine ? `Remove ${label}` : label) : "Sign in to react"}
            className={`flex items-center gap-1 rounded-full transition-colors duration-150 select-none ${padding}`}
            style={{
              background:  r.mine
                ? "rgba(201,169,106,0.12)"
                : "rgba(236,229,216,0.04)",
              border: r.mine
                ? "1px solid rgba(201,169,106,0.4)"
                : "1px solid rgba(236,229,216,0.12)",
              cursor:  isLoggedIn ? "pointer" : "default",
              opacity: isLoggedIn ? 1 : 0.45,
              animation: isAnim ? "reactionPop 420ms cubic-bezier(0.36,0.07,0.19,0.97) forwards" : "none",
            }}
          >
            <Icon
              size={emojiSize + 1}
              strokeWidth={1.6}
              style={{
                display: "block",
                color: r.mine ? "#c9a96a" : "rgba(236,229,216,0.5)",
              }}
            />
            <span
              className="font-mono leading-none tabular-nums"
              style={{
                fontSize:    countSize,
                color:       r.mine ? "#c9a96a" : "rgba(236,229,216,0.45)",
                minWidth:    countSize + 2,
                textAlign:   "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
