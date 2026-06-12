"use client";

// Route-level error boundary. Catches any error thrown while rendering a
// page (failed Supabase query, unexpected data shape, etc.) and shows a
// friendly recovery card inside the normal layout — nav stays alive —
// instead of Next.js's unstyled crash screen.

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in Vercel logs so failures are diagnosable
    console.error("Page error:", error);
  }, [error]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-24 text-center">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-10">
        <div className="font-mono text-5xl mb-4">🎾</div>
        <h1 className="font-mono text-xl font-bold text-text-primary mb-2">
          Something went wrong
        </h1>
        <p className="font-sans text-sm text-text-mid mb-6">
          We couldn&apos;t load this page. It&apos;s usually temporary — give it
          another try.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="font-mono text-xs px-5 py-2.5 rounded-lg font-semibold transition-all duration-150 cursor-pointer"
            style={{ background: "#22d68a", color: "#0e1116" }}
          >
            Try Again
          </button>
          <a
            href="/"
            className="font-mono text-xs px-5 py-2.5 rounded-lg border border-white/10 text-text-mid hover:text-text-primary hover:border-white/20 transition-colors duration-150"
          >
            Back Home
          </a>
        </div>
      </div>
    </main>
  );
}
