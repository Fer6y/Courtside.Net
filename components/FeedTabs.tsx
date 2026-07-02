"use client";

import { useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import PressBoxTag from "@/components/PressBoxTag";
import { isPressBox } from "@/lib/pressBox";
import type { ActivityItem } from "@/lib/feedTypes";

const SURFACE_COLOR: Record<string, string> = {
  Hard: "#4a90d9", Clay: "#d4734e", Grass: "#5cb85c",
};

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60)    return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days  = Math.floor(hours / 24);
  if (days < 30)    return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function initials(name: string | null, fallback: string) {
  const result = (name ?? fallback)
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return result || (fallback[0]?.toUpperCase() ?? "?");
}

// ── Single activity row ────────────────────────────────────────────────────────

function ActivityRow({ item }: { item: ActivityItem }) {
  const user = item.user;
  const name = user.display_name ?? user.username;
  const init = initials(name, user.username);

  if (item.type === "review") {
    const m    = item.match;
    const href = m ? `/matches/${m.id}` : "#";
    return (
      <div className="flex items-start gap-3 py-3.5">
        <Link href={`/profile/${user.username}`} className="shrink-0 mt-0.5">
          <UserAvatar config={user.avatar_config} initials={init} size={32} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <Link href={`/profile/${user.username}`} className="font-sans text-sm font-medium text-text-primary hover:text-primary transition-colors">
              {name}
            </Link>
            {isPressBox(user.clerk_user_id) && <PressBoxTag />}
            <span className="font-sans text-xs text-text-dim">reviewed</span>
            {m ? (
              <Link href={href} className="font-sans text-sm font-medium text-text-primary hover:text-primary transition-colors truncate">
                {m.player1?.name?.split(" ").pop()} vs {m.player2?.name?.split(" ").pop()}
              </Link>
            ) : (
              <span className="font-sans text-sm text-text-dim">a match</span>
            )}
            <span className="font-mono text-[10px] text-text-dim ml-auto shrink-0">{timeAgo(item.created_at)}</span>
          </div>
          {m && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[10px] text-text-dim truncate">{m.tournament}{m.match_date ? ` · ${m.match_date.slice(0, 4)}` : ""}</span>
              {m.surface && (
                <span className="font-mono text-[10px] shrink-0" style={{ color: SURFACE_COLOR[m.surface] ?? "#6b7280" }}>{m.surface}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <span
              className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md"
              style={{ background: "rgba(245,197,24,0.12)", color: "#f5c518" }}
            >
              {item.match_rating.toFixed(1)}
            </span>
            {item.comment && (
              <span className="font-sans text-xs text-text-dim italic line-clamp-1 flex-1 min-w-0">
                &ldquo;{item.comment}&rdquo;
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // type === "rating"
  const p    = item.player;
  const href = p ? `/players/${p.id}` : "#";
  return (
    <div className="flex items-start gap-3 py-3.5">
      <Link href={`/profile/${user.username}`} className="shrink-0 mt-0.5">
        <UserAvatar config={user.avatar_config} initials={init} size={32} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <Link href={`/profile/${user.username}`} className="font-sans text-sm font-medium text-text-primary hover:text-primary transition-colors">
            {name}
          </Link>
          {isPressBox(user.clerk_user_id) && <PressBoxTag />}
          <span className="font-sans text-xs text-text-dim">rated</span>
          {p ? (
            <Link href={href} className="font-sans text-sm font-medium text-text-primary hover:text-primary transition-colors">
              {p.name}
            </Link>
          ) : (
            <span className="font-sans text-sm text-text-dim">a player</span>
          )}
          <span className="font-mono text-[10px] text-text-dim ml-auto shrink-0">{timeAgo(item.created_at)}</span>
        </div>
        {p && (
          <span className="font-mono text-[10px] text-text-dim">
            {p.country ?? ""}
            {p.current_rank ? ` · #${p.current_rank}` : ""}
          </span>
        )}
        {item.topSkill && (
          <div className="mt-1.5">
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {item.topSkill.label} {item.topSkill.value.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  communityItems:  ActivityItem[];
  followingItems:  ActivityItem[];
  isSignedIn:      boolean;
  followingCount:  number;
}

export default function FeedTabs({ communityItems, followingItems, isSignedIn, followingCount }: Props) {
  const [tab, setTab] = useState<"following" | "everyone">(
    isSignedIn && followingCount > 0 ? "following" : "everyone"
  );

  const items = tab === "following" ? followingItems : communityItems;

  return (
    <div>
      {/* Tab switcher — gold-underlined eyebrow links */}
      <div className="flex items-baseline gap-4 mb-5">
        {isSignedIn && (
          <button
            onClick={() => setTab("following")}
            className="eyebrow transition-all duration-150"
            style={{
              fontSize: 10,
              paddingBottom: 2,
              color:        tab === "following" ? "#c9a96a" : "rgba(236,229,216,0.4)",
              borderBottom: tab === "following" ? "1px solid rgba(201,169,106,0.6)" : "1px solid transparent",
            }}
          >
            Following
            {followingCount > 0 && (
              <span className="ml-1.5" style={{ fontSize: 9, opacity: 0.7 }}>({followingCount})</span>
            )}
          </button>
        )}
        <button
          onClick={() => setTab("everyone")}
          className="eyebrow transition-all duration-150"
          style={{
            fontSize: 10,
            paddingBottom: 2,
            color:        tab === "everyone" ? "#c9a96a" : "rgba(236,229,216,0.4)",
            borderBottom: tab === "everyone" ? "1px solid rgba(201,169,106,0.6)" : "1px solid transparent",
          }}
        >
          Everyone
        </button>
      </div>

      {/* Empty states */}
      {items.length === 0 && tab === "following" && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">No activity yet</p>
          <p className="font-sans text-sm text-text-dim">
            The people you follow haven&apos;t posted anything recently.
          </p>
        </div>
      )}

      {items.length === 0 && tab === "everyone" && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim mb-2">No activity yet</p>
          <p className="font-sans text-sm text-text-dim">
            Be the first — review a match or rate a player.
          </p>
        </div>
      )}

      {/* Activity list */}
      {items.length > 0 && (
        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
