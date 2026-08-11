"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { followUser, unfollowUser } from "@/app/profile/[username]/follow/actions";
import AchievementBanner from "@/components/AchievementBanner";
import { useToast } from "@/components/toast/ToastContext";

interface Props {
  targetProfileId: string;
  initialIsFollowing: boolean;
  /** For the toast message — "@username" when provided */
  targetUsername?: string;
}

export default function FollowButton({ targetProfileId, initialIsFollowing, targetUsername }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition]  = useTransition();
  const [earnedIds, setEarnedIds]     = useState<string[]>([]);
  const router = useRouter();
  const toast  = useToast();

  const who = targetUsername ? `@${targetUsername}` : "them";

  function toggle() {
    startTransition(async () => {
      const prev = isFollowing;
      setIsFollowing(!prev); // optimistic
      try {
        if (prev) {
          await unfollowUser(targetProfileId);
          toast.notify(`Unfollowed ${who}`);
        } else {
          const result = await followUser(targetProfileId);
          if (result.newAchievements?.length) {
            setEarnedIds(result.newAchievements);
          } else {
            toast.notify(`Now following ${who}`);
          }
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
