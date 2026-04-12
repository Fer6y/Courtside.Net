"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function submitMatchReview(matchId: string, formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not authenticated");

  const supabase = adminClient();

  // Resolve clerk_user_id → profiles.id (UUID)
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (profileErr || !profile) throw new Error("Profile not found");

  const matchRating   = parseFloat(formData.get("match_rating")   as string);
  const player1Rating = parseFloat(formData.get("player1_rating") as string);
  const player2Rating = parseFloat(formData.get("player2_rating") as string);
  const comment       = (formData.get("comment") as string)?.trim() || null;
  const isFavorited   = formData.get("is_favorited") === "true";
  const collection    = (formData.get("collection_name") as string)?.trim() || null;

  // Upsert review (one per user per match)
  const { error: reviewErr } = await supabase
    .from("reviews")
    .upsert(
      {
        user_id:        profile.id,
        match_id:       matchId,
        match_rating:   matchRating,
        player1_rating: player1Rating,
        player2_rating: player2Rating,
        comment,
        is_favorited:   isFavorited,
      },
      { onConflict: "user_id,match_id" }
    );

  if (reviewErr) throw new Error(reviewErr.message);

  // Upsert watched_matches with optional collection
  const { error: watchErr } = await supabase
    .from("watched_matches")
    .upsert(
      {
        user_id:         profile.id,
        match_id:        matchId,
        collection_name: collection,
      },
      { onConflict: "user_id,match_id" }
    );

  if (watchErr) throw new Error(watchErr.message);

  return { success: true };
}

export async function getExistingReview(matchId: string, clerkId: string) {
  const supabase = adminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (!profile) return null;

  const { data } = await supabase
    .from("reviews")
    .select("match_rating, player1_rating, player2_rating, comment, is_favorited")
    .eq("user_id", profile.id)
    .eq("match_id", matchId)
    .single();

  const { data: watched } = await supabase
    .from("watched_matches")
    .select("collection_name")
    .eq("user_id", profile.id)
    .eq("match_id", matchId)
    .single();

  return data ? { ...data, collection_name: watched?.collection_name ?? null } : null;
}
