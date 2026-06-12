"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_EMOJIS = new Set(["fire", "shocked", "dislike"]);
const VALID_TARGETS = new Set(["review", "comment"]);

export async function toggleReaction(
  targetType: "review" | "comment",
  targetId: string,
  emoji: string
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not authenticated");

  // Whitelist — TypeScript types don't survive a forged request
  if (!VALID_EMOJIS.has(emoji)) throw new Error("Invalid reaction");
  if (!VALID_TARGETS.has(targetType)) throw new Error("Invalid target type");

  const supabase = adminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (!profile) throw new Error("Profile not found");

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("user_id", profile.id)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
    return { action: "removed" };
  } else {
    await supabase.from("reactions").insert({
      user_id:     profile.id,
      target_type: targetType,
      target_id:   targetId,
      emoji,
    });
    return { action: "added" };
  }
}
