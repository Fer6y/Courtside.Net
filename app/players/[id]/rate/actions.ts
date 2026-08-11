"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { checkAndAwardAchievements } from "@/lib/checkAchievements";

const AXES = [
  "focus","clutch","resilience","processing_time",
  "serve","forehand","backhand","shot_variety",
  "net_play","touch","return_play","reaction_time","deception",
  "speed","court_coverage","positioning","anticipation",
] as const;

export async function submitSkillRating(playerId: string, formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Resolve clerk_user_id → profiles.id (UUID)
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (profileErr || !profile) throw new Error("Profile not found");

  const rating: Record<string, number | string | null> = {
    user_id:   profile.id,
    player_id: playerId,
  };

  for (const axis of AXES) {
    const val = parseFloat(formData.get(axis) as string);
    if (!isNaN(val) && val >= 1 && val <= 5) {
      rating[axis] = Math.round(val * 2) / 2; // snap to 0.5 increments
    }
  }

  const highlighted = (formData.get("highlighted_skill") as string | null)?.trim() || null;
  if (highlighted && (AXES as readonly string[]).includes(highlighted)) {
    rating.highlighted_skill = highlighted;
  }

  const { error } = await supabase
    .from("skill_ratings")
    .upsert(rating, { onConflict: "user_id,player_id" });

  if (error) throw new Error(error.message);

  const check = await checkAndAwardAchievements(profile.id)
    .catch(() => ({ earned: [] as string[], nudge: null }));

  return { success: true, newAchievements: check.earned, progressNudge: check.nudge };
}
