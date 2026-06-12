"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function addComment(
  reviewId: string,
  body: string,
  parentCommentId?: string | null
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not authenticated");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty");
  if (trimmed.length > 2000) throw new Error("Comment too long (max 2000 characters)");

  const supabase = adminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("comments")
    .insert({
      user_id:           profile.id,
      review_id:         reviewId,
      parent_comment_id: parentCommentId ?? null,
      body:              trimmed,
    })
    .select(`
      id, user_id, review_id, parent_comment_id, body, created_at,
      profile:user_id ( username, display_name, clerk_user_id )
    `)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteComment(commentId: string) {
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
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  return { success: true };
}
