import Link from "next/link";

// Custom 404 page — shown for unknown routes and notFound() calls,
// styled to match the app instead of Next.js's default white page.

export default function NotFound() {
  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-24 text-center">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-10">
        <div className="font-mono text-5xl font-bold text-text-dim mb-4">
          OUT
        </div>
        <h1 className="font-mono text-xl font-bold text-text-primary mb-2">
          Page not found
        </h1>
        <p className="font-sans text-sm text-text-mid mb-6">
          This page doesn&apos;t exist — it may have been moved or the link is
          wrong.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="btn-solid font-mono text-xs px-5 py-2.5 rounded-lg font-semibold"
          >
            Back Home
          </Link>
          <Link
            href="/matches"
            className="font-mono text-xs px-5 py-2.5 rounded-lg border border-white/10 text-text-mid hover:text-text-primary hover:border-white/20 transition-colors duration-150"
          >
            Browse Matches
          </Link>
        </div>
      </div>
    </main>
  );
}
