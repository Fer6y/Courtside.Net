"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ACHIEVEMENT_MAP,
  TIER_COLORS,
  TIER_LABELS,
  TIER_ORDER,
  type AchievementTier,
} from "@/lib/achievements";

interface EarnedRow {
  achievement_type: string;
  tier: AchievementTier;
  earned_at: string;
}

interface Props {
  achievements: EarnedRow[];
  isOwnProfile: boolean;
}

// Tiny hex placeholder rendered as SVG data URL for missing badge images
const FALLBACK = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="26" fill="${color}22" stroke="${color}" stroke-width="1.5"/>
      <text x="28" y="33" font-size="18" text-anchor="middle" fill="${color}" font-family="monospace">?</text>
    </svg>`
  )}`;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function TrophyCase({ achievements, isOwnProfile }: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  if (achievements.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 text-center">
        <p className="font-sans text-text-dim text-sm">
          {isOwnProfile
            ? "No achievements yet — review matches, rate players, and follow fans to earn badges."
            : "No achievements earned yet."}
        </p>
      </div>
    );
  }

  // Group by tier in display order
  const byTier = new Map<AchievementTier, EarnedRow[]>();
  for (const tier of TIER_ORDER) byTier.set(tier, []);
  for (const a of achievements) {
    byTier.get(a.tier as AchievementTier)?.push(a);
  }

  return (
    <div className="flex flex-col gap-8">
      {TIER_ORDER.map((tier) => {
        const rows = byTier.get(tier) ?? [];
        if (rows.length === 0) return null;
        const color = TIER_COLORS[tier];

        return (
          <div key={tier}>
            {/* Tier header */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: `${color}18`, color }}
              >
                {TIER_LABELS[tier]}
              </span>
              <span className="font-mono text-[10px] text-text-dim">
                {rows.length} {rows.length === 1 ? "badge" : "badges"}
              </span>
            </div>

            {/* Badge grid */}
            <div className="flex flex-wrap gap-4">
              {rows.map((row) => {
                const def = ACHIEVEMENT_MAP.get(row.achievement_type);
                if (!def) return null;
                const isActive = tooltip === row.achievement_type;

                return (
                  <div key={row.achievement_type} className="relative">
                    <button
                      className="flex flex-col items-center gap-1.5 group focus:outline-none"
                      onClick={() => setTooltip(isActive ? null : row.achievement_type)}
                      onMouseEnter={() => setTooltip(row.achievement_type)}
                      onMouseLeave={() => setTooltip(null)}
                      aria-label={def.name}
                    >
                      {/* Badge image */}
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-150 group-hover:scale-110"
                        style={{
                          boxShadow: isActive ? `0 0 16px ${color}55` : `0 0 0px transparent`,
                          transition: "box-shadow 200ms, transform 150ms",
                        }}
                      >
                        <Image
                          src={def.badge}
                          alt={def.name}
                          width={56}
                          height={56}
                          className="rounded-full"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = FALLBACK(color);
                          }}
                          unoptimized
                        />
                      </div>

                      {/* Badge name */}
                      <span
                        className="font-mono text-[9px] text-center leading-tight max-w-[64px]"
                        style={{ color }}
                      >
                        {def.name}
                      </span>
                    </button>

                    {/* Tooltip */}
                    {isActive && (
                      <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
                        style={{ minWidth: 160 }}
                      >
                        <div
                          className="rounded-lg px-3 py-2.5 text-left"
                          style={{
                            background: "#1a1e26",
                            border: `1px solid ${color}33`,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                          }}
                        >
                          <div className="font-mono text-xs font-bold mb-0.5" style={{ color }}>
                            {def.name}
                          </div>
                          <div className="font-sans text-[11px] text-text-mid leading-snug mb-1.5">
                            {def.description}
                          </div>
                          <div className="font-mono text-[10px] text-text-dim">
                            Earned {timeAgo(row.earned_at)}
                          </div>
                        </div>
                        {/* Arrow */}
                        <div
                          className="w-2 h-2 mx-auto rotate-45 -mt-1"
                          style={{ background: "#1a1e26", borderRight: `1px solid ${color}33`, borderBottom: `1px solid ${color}33` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
