"use client";

// Last-resort error boundary. Only renders if the root layout itself
// crashes (error.tsx handles normal page errors). Must provide its own
// <html>/<body> because it replaces the entire layout — styles are inline
// since the app's CSS may not have loaded.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e1116",
          color: "#e8eaed",
          fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 40, marginBottom: 16, color: "#c9a96a" }}>✦</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Courtside hit a snag
          </h1>
          <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24 }}>
            Something broke on our end. Try reloading the page.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#ece5d8",
              color: "#0e1116",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
