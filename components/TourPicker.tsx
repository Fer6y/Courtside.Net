"use client";

import { useState, useTransition } from "react";
import { setTourPreference } from "@/app/actions/tourPreference";
import { TOUR_PREF_OPTIONS, type TourPreference } from "@/lib/tourPreference";

// "Your tours" — the viewer picks which tours show up in tour-agnostic spots
// like the home page "Top of the Draw". Default is ATP-only; adding the WTA is
// opt-in. Persists via the server action (cookie + profile backup); the new
// value takes effect on the next home-page load.
export default function TourPicker({ initial }: { initial: TourPreference }) {
  const [pref, setPref] = useState<TourPreference>(initial);
  const [, startTransition] = useTransition();

  function choose(next: TourPreference) {
    if (next === pref) return;
    setPref(next);
    startTransition(() => {
      setTourPreference(next).catch(() => {});
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {TOUR_PREF_OPTIONS.map((opt) => {
        const active = pref === opt.value;
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
            <div className="bill-name" style={{ fontSize: 15, color: "#ece5d8" }}>
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
