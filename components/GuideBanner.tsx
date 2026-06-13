"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const STORAGE_KEY = "courtside_guide_dismissed_v1";

export default function GuideBanner({ reviewCount }: { reviewCount: number }) {
  // Start hidden to avoid flash-of-content before localStorage is read
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reviewCount >= 5) return;
    const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    if (!dismissed) setVisible(true);
  }, [reviewCount]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 sm:pt-6">
      <div
        className="flex flex-col gap-3 rounded-lg px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4"
        style={{
          background: "rgba(201,169,106,0.05)",
          border: "1px solid var(--hairline)",
        }}
      >
        <div className="min-w-0">
          <span className="eyebrow block mb-1" style={{ fontSize: 9, color: "#c9a96a" }}>
            New to Courtside
          </span>
          <p className="bill-name italic" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.7)" }}>
            The guide walks you through every feature — ratings, radars, reviews, and more.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 shrink-0">
          <Link
            href="/guide"
            className="eyebrow btn-paper rounded-md px-4 py-2.5 text-center flex-1 sm:flex-none sm:py-2"
            style={{ fontSize: 10 }}
          >
            Take the tour
          </Link>
          <button
            onClick={dismiss}
            className="font-mono text-xs transition-colors duration-150 shrink-0"
            style={{ color: "rgba(236,229,216,0.4)" }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
