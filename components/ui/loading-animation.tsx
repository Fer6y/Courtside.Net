"use client";

import { useEffect, useState } from "react";

const DOTS = ["", ".", "..", "..."];

export default function LoadingAnimation() {
  const [dot, setDot] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setDot((d) => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes cs-fall {
          0% {
            transform: translate(-50%, 0) scaleX(0.95) scaleY(1.07);
            animation-timing-function: cubic-bezier(0.5, 0, 1, 0.45);
          }
          48% {
            transform: translate(-50%, 70px) scaleX(1.16) scaleY(0.82);
            animation-timing-function: cubic-bezier(0, 0.5, 0.45, 1);
          }
          52% {
            transform: translate(-50%, 70px) scaleX(1.16) scaleY(0.82);
            animation-timing-function: cubic-bezier(0, 0.5, 0.45, 1);
          }
          100% {
            transform: translate(-50%, 0) scaleX(0.95) scaleY(1.07);
            animation-timing-function: cubic-bezier(0.5, 0, 1, 0.45);
          }
        }

        @keyframes cs-ground-shadow {
          0%, 100% { transform: translateX(-50%) scaleX(0.65); opacity: 0.3; }
          50%      { transform: translateX(-50%) scaleX(1.2);  opacity: 0.62; }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center" style={{ width: 120, height: 160 }}>

        {/* Bounce area — 40px ball, 70px travel */}
        <div style={{ position: "relative", width: 64, height: 122 }}>

          {/* Grounded contact shadow — widens and darkens on impact */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              width: 36,
              height: 8,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              filter: "blur(1.5px)",
              animation: "cs-ground-shadow 950ms infinite",
            }}
          />

          {/* Tennis ball — optic-yellow felt, C-seam, gold rim */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: 40,
              height: 40,
              transformOrigin: "center bottom",
              animation: "cs-fall 950ms infinite",
            }}
          >
            <svg viewBox="0 0 48 48" width="40" height="40">
              <circle cx="24" cy="24" r="23" fill="#d4e03c" />
              <ellipse cx="18" cy="16" rx="13" ry="10" fill="#e6ef74" opacity="0.55" />
              <ellipse cx="29" cy="33" rx="14" ry="11" fill="#aebf2c" opacity="0.4" />
              <path d="M34 4 C 10 11, 10 37, 34 44" fill="none" stroke="#9aa824" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M34 4 C 10 11, 10 37, 34 44" fill="none" stroke="#f4efdd" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="24" cy="24" r="23" fill="none" stroke="#c9a96a" strokeWidth="1.1" />
            </svg>
          </div>

        </div>

        {/* Loading text with cycling dots */}
        <p
          className="font-mono text-text-dim"
          style={{
            marginTop: 24,
            fontSize: 14,
            letterSpacing: "0.03em",
            width: 84,
            textAlign: "center",
          }}
        >
          Loading{DOTS[dot]}
        </p>

      </div>
    </>
  );
}
