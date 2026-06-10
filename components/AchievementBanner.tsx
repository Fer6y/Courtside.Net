"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ACHIEVEMENT_MAP, TIER_COLORS, TIER_LABELS } from "@/lib/achievements";

interface Props {
  achievementIds: string[];
  onClear: () => void;
}

export default function AchievementBanner({ achievementIds, onClear }: Props) {
  const [index, setIndex]   = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;

  // Kick off display whenever a new batch of achievement IDs arrives
  useEffect(() => {
    if (achievementIds.length === 0) { setVisible(false); return; }
    setIndex(0);
    // Double rAF so the CSS transition fires after paint
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, [achievementIds]);

  // Auto-dismiss and advance queue
  useEffect(() => {
    if (!visible) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        if (index < achievementIds.length - 1) {
          setIndex((i) => i + 1);
          requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
        } else {
          onClearRef.current();
        }
      }, 450);
    }, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, index, achievementIds.length]);

  if (achievementIds.length === 0) return null;

  const achievement = ACHIEVEMENT_MAP.get(achievementIds[index]);
  if (!achievement) return null;

  const color = TIER_COLORS[achievement.tier];

  return (
    <>
      <style>{`
        @keyframes badge-pop {
          0%   { transform: scale(0.2) rotate(-15deg); opacity: 0; }
          65%  { transform: scale(1.2) rotate(4deg);  opacity: 1; }
          82%  { transform: scale(0.92) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .achievement-badge-pop {
          animation: badge-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
        }
      `}</style>

      <div
        className="fixed top-5 left-1/2 z-[200] pointer-events-none"
        style={{
          transform: `translateX(-50%) translateY(${visible ? "0" : "-140%"})`,
          transition: visible
            ? "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease"
            : "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease",
          opacity: visible ? 1 : 0,
          maxWidth: 460,
          width: "calc(100vw - 2rem)",
        }}
      >
        <div
          className="relative rounded-2xl overflow-hidden flex items-center gap-4 px-6 py-4"
          style={{
            background: "linear-gradient(135deg, #1e2430 0%, #1a1e26 100%)",
            border: `1px solid ${color}44`,
            boxShadow: `0 0 0 1px ${color}18, 0 0 48px ${color}22, 0 20px 60px rgba(0,0,0,0.75)`,
          }}
        >
          {/* Tier accent bar */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ background: `linear-gradient(to bottom, ${color}, ${color}88)` }}
          />

          {/* Badge image */}
          <div
            className="achievement-badge-pop shrink-0"
            style={{ filter: `drop-shadow(0 0 14px ${color}99)` }}
          >
            <Image
              src={achievement.badge}
              alt={achievement.name}
              width={64}
              height={64}
              className="rounded-full"
              unoptimized
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.15em] font-semibold"
                style={{ color }}
              >
                Achievement Unlocked
              </span>
              <span
                className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold"
                style={{ background: `${color}20`, color }}
              >
                {TIER_LABELS[achievement.tier]}
              </span>
            </div>
            <div className="font-mono text-lg font-bold text-text-primary leading-tight">
              {achievement.name}
            </div>
            <div className="font-sans text-xs text-text-mid leading-snug mt-0.5">
              {achievement.description}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
