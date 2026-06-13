"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { followUser, unfollowUser } from "@/app/profile/[username]/follow/actions";
import AchievementBanner from "@/components/AchievementBanner";

interface Props {
  targetProfileId: string;
  initialIsFollowing: boolean;
}

export default function FollowButton({ targetProfileId, initialIsFollowing }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition]  = useTransition();
  const [earnedIds, setEarnedIds]     = useState<string[]>([]);
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      const prev = isFollowing;
      setIsFollowing(!prev); // optimistic
      try {
        if (prev) {
          await unfollowUser(targetProfileId);
        } else {
          const result = await followUser(targetProfileId);
          if (result.newAchievements?.length) setEarnedIds(result.newAchievements);
        }
        router.refresh();
      } catch {
        setIsFollowing(prev); // revert on error
      }
    });
  }

  return (
    <>
    <AchievementBanner achievementIds={earnedIds} onClear={() => setEarnedIds([])} />
    <button
      onClick={toggle}
      disabled={isPending}
      className={`font-mono text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-150 ${isFollowing ? "" : "btn-solid"}`}
      style={{
        background:  isFollowing ? "transparent" : undefined,
        color:       isFollowing ? "#9ca3af"     : undefined,
        border:      isFollowing ? "1px solid rgba(255,255,255,0.1)" : undefined,
        cursor:      isPending   ? "not-allowed" : "pointer",
        opacity:     isPending   ? 0.6           : 1,
        minHeight:   36,
      }}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
    </>
  );
}
