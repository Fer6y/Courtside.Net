"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { LayoutConfig } from "@/lib/profileLayout";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function saveLayoutConfig(username: string, config: LayoutConfig) {
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

  const { error } = await supabase
    .from("profiles")
    .update({ layout_config: config })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);
  return { success: true };
}
