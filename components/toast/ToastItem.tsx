"use client";

import { useEffect, useState } from "react";
import type { Toast } from "./ToastContext";

interface Props {
  toast: Toast;
  onDismiss: (id: string) => void;
}

// How long the explosion animation plays before the toast is removed
const EXPLODE_DURATION = 700;
// How long an error shakes before auto-dismissing
const ERROR_DURATION = 2200;

export default function ToastItem({ toast, onDismiss }: Props) {
  // Derived directly from the prop — no state mirror needed
  const exploding = toast.state === "success";
  const [visible, setVisible] = useState(false);

  // Slide in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Schedule auto-dismiss when the toast resolves
  useEffect(() => {
    if (toast.state === "success") {
      const t = setTimeout(() => onDismiss(toast.id), EXPLODE_DURATION);
      return () => clearTimeout(t);
    }
    if (toast.state === "error") {
      const t = setTimeout(() => onDismiss(toast.id), ERROR_DURATION);
      return () => clearTimeout(t);
    }
  }, [toast.state, toast.id, onDismiss]);

  const ballColor =
    toast.state === "error" ? "#e74c3c" : "#22d68a";

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes toast-bounce {
          0%   { transform: translateY(0)    scaleX(1)    scaleY(1);    }
          30%  { transform: translateY(-7px) scaleX(0.92) scaleY(1.12); }
          55%  { transform: translateY(0)    scaleX(1.12) scaleY(0.88); }
          75%  { transform: translateY(-3px) scaleX(0.96) scaleY(1.06); }
          100% { transform: translateY(0)    scaleX(1)    scaleY(1);    }
        }
        @keyframes toast-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-5px); }
          35%     { transform: translateX(5px);  }
          55%     { transform: translateX(-4px); }
          75%     { transform: translateX(4px);  }
          90%     { transform: translateX(-2px); }
        }
        @keyframes toast-explode {
          0%   { transform: scale(1);   opacity: 1; }
          40%  { transform: scale(2.2); opacity: 1; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        @keyframes particle-fly {
          0%   { transform: translate(0, 0)              scale(1);   opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        @keyframes toast-fade-out {
          from { opacity: 1; transform: scale(1);    }
          to   { opacity: 0; transform: scale(0.85); }
        }
      `}</style>

      <div
        style={{
          pointerEvents: "auto",
          animation: exploding
            ? `toast-fade-out ${EXPLODE_DURATION}ms ease forwards`
            : visible
            ? "toast-slide-in 220ms cubic-bezier(0.34,1.56,0.64,1) forwards"
            : "none",
          opacity: visible ? undefined : 0,
        }}
      >
        <div
          className="flex items-center gap-3 rounded-full px-4 py-2.5"
          style={{
            background: "#1a1e26",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            minWidth: 180,
          }}
        >
          {/* Animated ball */}
          <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: ballColor,
                transition: "background 200ms ease",
                animation: exploding
                  ? `toast-explode ${EXPLODE_DURATION}ms ease forwards`
                  : toast.state === "loading"
                  ? "toast-bounce 700ms ease infinite"
                  : toast.state === "error"
                  ? "toast-shake 500ms ease"
                  : "none",
              }}
            />
            {/* Burst particles — only on success */}
            {exploding && <Particles color={ballColor} />}
          </div>

          {/* Message */}
          <span className="font-mono text-sm text-text-primary whitespace-nowrap">
            {toast.message}
          </span>
        </div>
      </div>
    </>
  );
}

// 8 particles flying outward in all directions
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const PARTICLE_DIST   = 28;

function Particles({ color }: { color: string }) {
  return (
    <>
      {PARTICLE_ANGLES.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const dx  = Math.round(Math.cos(rad) * PARTICLE_DIST);
        const dy  = Math.round(Math.sin(rad) * PARTICLE_DIST);
        return (
          <div
            key={angle}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color,
              marginTop: -3,
              marginLeft: -3,
              // @ts-expect-error CSS custom properties
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              animation: `particle-fly 500ms ease forwards`,
              opacity: 0,
              animationDelay: "80ms",
            }}
          />
        );
      })}
    </>
  );
}
