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
    <div
      className="max-w-6xl mx-auto px-4 pt-6"
    >
      <div
        className="flex items-center justify-between gap-4 rounded-xl px-5 py-4"
        style={{
          background: "rgba(34,214,138,0.06)",
          border: "1px solid rgba(34,214,138,0.18)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Pulse dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: "#22d68a" }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: "#22d68a" }}
            />
          </span>
          <p className="font-sans text-sm text-text-primary">
            New to Courtside?{" "}
            <span className="text-text-mid">
              The guide explains every feature — ratings, radars, reviews, and more.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/guide"
            className="font-mono text-xs font-semibold px-4 py-1.5 rounded-lg transition-all duration-150"
            style={{ background: "#22d68a", color: "#0e1116" }}
          >
            Take the tour
          </Link>
          <button
            onClick={dismiss}
            className="font-mono text-xs text-text-dim hover:text-text-primary transition-colors duration-150"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
