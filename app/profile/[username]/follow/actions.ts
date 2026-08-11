"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { checkAndAwardAchievements } from "@/lib/checkAchievements";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function followUser(targetProfileId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not authenticated");

  const supabase = adminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (!profile) throw new Error("Profile not found");
  if (profile.id === targetProfileId) throw new Error("Cannot follow yourself");

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: profile.id, following_id: targetProfileId });

  // Ignore duplicate — already following
  if (error && error.code !== "23505") throw new Error(error.message);

  const check = await checkAndAwardAchievements(profile.id)
    .catch(() => ({ earned: [] as string[], nudge: null }));
  // Check follower-count achievements for the person being followed (fire-and-forget)
  checkAndAwardAchievements(targetProfileId).catch(() => {});

  return { success: true, newAchievements: check.earned };
}

export async function unfollowUser(targetProfileId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not authenticated");

  const supabase = adminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (!profile) throw new Error("Profile not found");

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", profile.id)
    .eq("following_id", targetProfileId);

  if (error) throw new Error(error.message);
  return { success: true };
}
