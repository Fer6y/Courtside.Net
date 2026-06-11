"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { AvatarConfig } from "@/lib/avatarTemplates";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getOwnedProfile(username: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not authenticated");

  const supabase = adminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clerk_user_id")
    .eq("username", username)
    .single();

  if (!profile) throw new Error("Profile not found");
  if (profile.clerk_user_id !== clerkId) throw new Error("Unauthorized");

  return { supabase, profileId: profile.id };
}

export async function saveProfile(
  username: string,
  data: {
    displayName: string;
    bio:         string;
    avatarConfig: AvatarConfig;
  }
) {
  const { supabase, profileId } = await getOwnedProfile(username);

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name:  data.displayName.trim() || null,
      bio:           data.bio.trim()         || null,
      avatar_config: data.avatarConfig,
    })
    .eq("id", profileId);

  if (error) throw new Error(error.message);
  return { success: true };
}
