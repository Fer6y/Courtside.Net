"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { checkAndAwardAchievements } from "@/lib/checkAchievements";

export async function awardScoutBadge(): Promise<string[]> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return [];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (!profile) return [];

  return checkAndAwardAchievements(profile.id, { filterApplied: true });
}
