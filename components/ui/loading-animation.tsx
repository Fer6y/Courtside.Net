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
        @keyframes cs-bounce {
          0% {
            transform: translateY(0px) scaleX(0.95) scaleY(1.1);
            box-shadow:
              0 -9px  0 -16px rgba(255,255,255,0.45),
              0 -15px 0 -17px rgba(255,255,255,0.22);
            animation-timing-function: cubic-bezier(0.5, 0, 1, 0.45);
          }
          35% {
            transform: translateY(60px) scaleX(1.25) scaleY(0.75);
            box-shadow: none;
            animation-timing-function: cubic-bezier(0, 0.55, 0.45, 1);
          }
          65% {
            transform: translateY(0px) scaleX(0.95) scaleY(1.1);
            box-shadow:
              0  9px  0 -16px rgba(255,255,255,0.45),
              0  15px 0 -17px rgba(255,255,255,0.22);
            animation-timing-function: cubic-bezier(0, 0, 0.4, 1);
          }
          100% {
            transform: translateY(0px) scaleX(1) scaleY(1);
            box-shadow:
              -7px 0 0 -17px rgba(255,255,255,0.2),
               7px 0 0 -17px rgba(255,255,255,0.2);
          }
        }

        @keyframes cs-burst {
          0%,  28% { transform: translateX(-50%) scaleX(0);   opacity: 0; }
          35%      { transform: translateX(-50%) scaleX(1);   opacity: 1; }
          54%      { transform: translateX(-50%) scaleX(1.5); opacity: 0; }
          100%     { transform: translateX(-50%) scaleX(1.5); opacity: 0; }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center" style={{ width: 120, height: 160 }}>

        {/* Bounce area — 40px wide, 100px tall (60px travel + 40px ball) */}
        <div style={{ position: "relative", width: 40, height: 100 }}>

          {/* Ground burst — appears on impact at 35% */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              width: 30,
              height: 4,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              animation: "cs-burst 800ms cubic-bezier(0.5, 0, 1, 0.45) infinite",
            }}
          />

          {/* Ball — animated on a single element */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#22d68a",
              position: "relative",
              animation: "cs-bounce 800ms infinite",
            }}
          >
            {/* Seam lines — two S-curve arcs in darker green */}
            <svg
              viewBox="0 0 40 40"
              width="40"
              height="40"
              style={{ position: "absolute", inset: 0 }}
              aria-hidden="true"
            >
              <path
                d="M 7,20 Q 14,8 20,20 Q 26,32 33,20"
                fill="none"
                stroke="#1ab876"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M 7,20 Q 14,32 20,20 Q 26,8 33,20"
                fill="none"
                stroke="#1ab876"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
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
