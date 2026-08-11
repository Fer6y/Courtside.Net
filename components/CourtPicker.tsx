"use client";

import { useState, useEffect, useTransition } from "react";
import { setCourtTheme } from "@/app/actions/court";
import { COURT_OPTIONS, type CourtName } from "@/lib/courts";
import { useToast } from "@/components/toast/ToastContext";

// "Your court" — the viewer picks the surface the whole app is read on.
// Selecting applies instantly (the effect writes data-court on <html>) for
// live feedback, then persists via the server action (cookie + profile backup).
export default function CourtPicker({ initial }: { initial: CourtName }) {
  const [court, setCourt] = useState<CourtName>(initial);
  const [, startTransition] = useTransition();
  const toast = useToast();

  // Sync the chosen court to <html> for instant, no-reload feedback. Lives in
  // an effect so the DOM write happens after render, not during the handler.
  useEffect(() => {
    document.documentElement.dataset.court = court;
    document.documentElement.dataset.courtUser = court;
  }, [court]);

  function choose(next: CourtName) {
    if (next === court) return;
    setCourt(next);
    const label = COURT_OPTIONS.find((o) => o.value === next)?.label ?? next;
    startTransition(() => {
      setCourtTheme(next)
        .then(() => toast.notify(`Your court is now ${label}`))
        .catch(() => {});
    });
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {COURT_OPTIONS.map((opt) => {
        const active = court === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            className="rounded-lg p-3 text-center transition-all duration-150"
            style={{
              border: active
                ? "1.5px solid rgba(201,169,106,0.7)"
                : "1px solid var(--hairline)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {/* Surface swatch — mirrors the real court textures */}
            <div
              data-court={opt.value}
              style={{
                height: 44,
                borderRadius: 5,
                border: "1px solid rgba(236,229,216,0.12)",
                backgroundColor: "var(--court-bg)",
                backgroundImage: "var(--court-texture)",
                backgroundSize: "var(--court-texture-size, auto)",
                backgroundPosition: "var(--court-texture-position, 0 0)",
              }}
            />
            <div className="bill-name mt-2" style={{ fontSize: 14, color: "#ece5d8" }}>
              {opt.label}
            </div>
            <div
              className="eyebrow mt-0.5"
              style={{ fontSize: 8, color: active ? "#c9a96a" : "rgba(236,229,216,0.4)" }}
            >
              {active ? "✓ Selected" : opt.note}
            </div>
          </button>
        );
      })}
    </div>
  );
}
