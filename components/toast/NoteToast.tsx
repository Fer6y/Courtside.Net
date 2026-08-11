"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Toast } from "./ToastContext";

interface Props {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const DEFAULT_DURATION = 3400;

// The quiet sibling of the ball/racquet card: a small programme-styled pill
// anchored above the bottom nav for event notifications (follows, comments,
// achievement-progress nudges). Mono text, hairline border, gold action link.
export default function NoteToast({ toast, onDismiss }: Props) {
  const [phase, setPhase] = useState<"in" | "shown" | "out">("in");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("shown"));
    const hold = setTimeout(() => setPhase("out"), toast.duration ?? DEFAULT_DURATION);
    return () => { cancelAnimationFrame(raf); clearTimeout(hold); };
  }, [toast.duration]);

  // Remove after the exit transition completes
  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => onDismiss(toast.id), 260);
    return () => clearTimeout(t);
  }, [phase, toast.id, onDismiss]);

  return (
    <div
      role="status"
      onClick={() => setPhase("out")}
      className="flex items-center gap-3"
      style={{
        pointerEvents: "auto",
        background: "#1a1e26",
        border: "1px solid var(--hairline, rgba(255,255,255,0.1))",
        boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
        borderRadius: 12,
        padding: "10px 16px",
        maxWidth: "calc(100vw - 32px)",
        cursor: "pointer",
        transition: "opacity 200ms ease, transform 240ms cubic-bezier(0.34,1.3,0.64,1)",
        opacity: phase === "shown" ? 1 : 0,
        transform: phase === "shown" ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <span aria-hidden="true" style={{ color: "#c9a96a", fontSize: 11, lineHeight: 1 }}>✦</span>
      <span
        className="font-mono text-xs"
        style={{ letterSpacing: "0.03em", color: "#e8eaed", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {toast.message}
      </span>
      {toast.actionLabel && toast.actionHref && (
        <Link
          href={toast.actionHref}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs shrink-0"
          style={{
            color: "#c9a96a",
            letterSpacing: "0.05em",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            textDecorationColor: "rgba(201,169,106,0.5)",
            minHeight: 24,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          {toast.actionLabel}
        </Link>
      )}
    </div>
  );
}
