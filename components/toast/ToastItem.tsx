"use client";

import { useEffect, useState } from "react";
import type { Toast } from "./ToastContext";

interface Props {
  toast: Toast;
  onDismiss: (id: string) => void;
}

// How long the racquet-strike animation plays before the toast is removed
const HIT_DURATION = 1100;
// How long an error shakes before auto-dismissing
const ERROR_DURATION = 2200;

export default function ToastItem({ toast, onDismiss }: Props) {
  const hitting = toast.state === "success";
  const [visible, setVisible] = useState(false);

  // Fade/scale in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Schedule auto-dismiss when the toast resolves
  useEffect(() => {
    if (toast.state === "success") {
      const t = setTimeout(() => onDismiss(toast.id), HIT_DURATION);
      return () => clearTimeout(t);
    }
    if (toast.state === "error") {
      const t = setTimeout(() => onDismiss(toast.id), ERROR_DURATION);
      return () => clearTimeout(t);
    }
  }, [toast.state, toast.id, onDismiss]);

  return (
    <>
      <style>{`
        @keyframes toast-pop-in {
          from { opacity: 0; transform: translateY(10px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes toast-card-out {
          from { opacity: 1; transform: scale(1);    }
          to   { opacity: 0; transform: scale(0.92); }
        }
        @keyframes toast-card-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-6px); }
          35%     { transform: translateX(6px);  }
          55%     { transform: translateX(-5px); }
          75%     { transform: translateX(5px);  }
          90%     { transform: translateX(-2px); }
        }

        /* Bouncing tennis ball while loading */
        @keyframes toast-ball-fall {
          0% {
            transform: translate(-50%, 0) scaleX(0.95) scaleY(1.07);
            animation-timing-function: cubic-bezier(0.5, 0, 1, 0.45);
          }
          48% {
            transform: translate(-50%, 62px) scaleX(1.16) scaleY(0.82);
            animation-timing-function: cubic-bezier(0, 0.5, 0.45, 1);
          }
          52% {
            transform: translate(-50%, 62px) scaleX(1.16) scaleY(0.82);
            animation-timing-function: cubic-bezier(0, 0.5, 0.45, 1);
          }
          100% {
            transform: translate(-50%, 0) scaleX(0.95) scaleY(1.07);
            animation-timing-function: cubic-bezier(0.5, 0, 1, 0.45);
          }
        }
        @keyframes toast-ball-shadow {
          0%, 100% { transform: translateX(-50%) scaleX(0.65); opacity: 0.3; }
          50%      { transform: translateX(-50%) scaleX(1.2);  opacity: 0.6; }
        }

        /* Racquet swings up through the ball on success — one continuous
           arc: accelerates into the ball (fastest at contact, no hitch),
           then decelerates through the follow-through */
        @keyframes toast-racquet-swing {
          0%   {
            transform: translate(-58px, 48px) rotate(-78deg); opacity: 0;
            animation-timing-function: cubic-bezier(0.5, 0, 0.85, 0.5);
          }
          50%  {
            transform: translate(-4px, 16px) rotate(-6deg); opacity: 1;
            animation-timing-function: cubic-bezier(0.2, 0.5, 0.4, 1);
          }
          100% { transform: translate(46px, -22px) rotate(48deg); opacity: 0; }
        }
        /* Ball gets struck: squashes at contact (~50%), then launches away */
        @keyframes toast-ball-hit {
          0%,44% { transform: translate(-50%, 30px) scale(1)              rotate(0deg);   opacity: 1; }
          52%    { transform: translate(-50%, 30px) scaleX(0.74) scaleY(1.2) rotate(0deg); opacity: 1; }
          100%   { transform: translate(130px, -78px) scale(0.35)          rotate(340deg); opacity: 0; }
        }
        @keyframes toast-particle-fly {
          0%   { transform: translate(0, 0)                scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
      `}</style>

      <div
        style={{
          pointerEvents: "auto",
          animation: hitting
            ? `toast-card-out ${HIT_DURATION}ms ease forwards`
            : toast.state === "error"
            ? "toast-card-shake 500ms ease"
            : visible
            ? "toast-pop-in 240ms cubic-bezier(0.34,1.56,0.64,1) forwards"
            : "none",
          opacity: visible ? undefined : 0,
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            background: "#1a1e26",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
            borderRadius: 18,
            padding: "22px 30px 18px",
            minWidth: 190,
          }}
        >
          {/* Ball + racquet stage */}
          <div
            style={{
              position: "relative",
              width: 120,
              height: 96,
              overflow: "visible",
            }}
          >
            {/* Contact shadow — only meaningful while bouncing */}
            {toast.state === "loading" && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "50%",
                  width: 40,
                  height: 8,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.5)",
                  filter: "blur(1.5px)",
                  animation: "toast-ball-shadow 950ms infinite",
                }}
              />
            )}

            {/* Tennis ball */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                width: 40,
                height: 40,
                transformOrigin: "center bottom",
                transform: "translate(-50%, 30px)",
                animation: hitting
                  ? `toast-ball-hit ${HIT_DURATION}ms cubic-bezier(0.3,0,0.2,1) forwards`
                  : toast.state === "loading"
                  ? "toast-ball-fall 950ms infinite"
                  : "none",
              }}
            >
              <BallSvg dim={toast.state === "error"} />
            </div>

            {/* Burst particles at the point of contact */}
            {hitting && <Particles />}

            {/* Racquet — swings through on success */}
            {hitting && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  bottom: -6,
                  left: "50%",
                  marginLeft: -22,
                  transformOrigin: "50% 88%",
                  animation: `toast-racquet-swing ${HIT_DURATION}ms cubic-bezier(0.3,0,0.2,1) forwards`,
                }}
              >
                <RacquetSvg />
              </div>
            )}
          </div>

          {/* Message */}
          <span
            className="font-mono text-sm whitespace-nowrap"
            style={{
              marginTop: 14,
              letterSpacing: "0.03em",
              color: toast.state === "error" ? "#e74c3c" : "#e8eaed",
            }}
          >
            {toast.message}
          </span>
        </div>
      </div>
    </>
  );
}

// The programme tennis ball — optic-yellow felt, C-seam, gold rim
function BallSvg({ dim }: { dim?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="24" cy="24" r="23" fill={dim ? "#5a5a3a" : "#d4e03c"} />
      <ellipse cx="18" cy="16" rx="13" ry="10" fill={dim ? "#6f6f45" : "#e6ef74"} opacity="0.55" />
      <ellipse cx="29" cy="33" rx="14" ry="11" fill={dim ? "#4a4a2e" : "#aebf2c"} opacity="0.4" />
      <path d="M34 4 C 10 11, 10 37, 34 44" fill="none" stroke="#9aa824" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M34 4 C 10 11, 10 37, 34 44" fill="none" stroke="#f4efdd" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="24" r="23" fill="none" stroke="#c9a96a" strokeWidth="1.1" />
    </svg>
  );
}

// A simple tennis racquet — gold rim, strung head, slim grip
function RacquetSvg() {
  return (
    <svg viewBox="0 0 44 88" width="44" height="88">
      {/* Strings */}
      <g stroke="#c9a96a" strokeWidth="0.8" opacity="0.55">
        <line x1="10" y1="8" x2="10" y2="42" />
        <line x1="16" y1="5" x2="16" y2="45" />
        <line x1="22" y1="4" x2="22" y2="46" />
        <line x1="28" y1="5" x2="28" y2="45" />
        <line x1="34" y1="8" x2="34" y2="42" />
        <line x1="6"  y1="15" x2="38" y2="15" />
        <line x1="5"  y1="22" x2="39" y2="22" />
        <line x1="5"  y1="29" x2="39" y2="29" />
        <line x1="6"  y1="36" x2="38" y2="36" />
      </g>
      {/* Head rim */}
      <ellipse cx="22" cy="25" rx="18" ry="23" fill="none" stroke="#c9a96a" strokeWidth="3" />
      {/* Throat + grip */}
      <path d="M15 45 L19 60 M29 45 L25 60" fill="none" stroke="#c9a96a" strokeWidth="3" strokeLinecap="round" />
      <rect x="19" y="58" width="6" height="28" rx="3" fill="#c9a96a" />
    </svg>
  );
}

// 8 particles flying outward from the point of contact
const PARTICLE_ANGLES = [10, 55, 100, 145, 190, 235, 280, 325];
const PARTICLE_DIST = 30;

function Particles() {
  return (
    <>
      {PARTICLE_ANGLES.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const dx = Math.round(Math.cos(rad) * PARTICLE_DIST);
        const dy = Math.round(Math.sin(rad) * PARTICLE_DIST);
        return (
          <div
            key={angle}
            style={{
              position: "absolute",
              top: 42,
              left: "50%",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#d4e03c",
              marginTop: -3,
              marginLeft: -3,
              // @ts-expect-error CSS custom properties
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              animation: "toast-particle-fly 460ms ease forwards",
              animationDelay: "520ms",
              opacity: 0,
            }}
          />
        );
      })}
    </>
  );
}
