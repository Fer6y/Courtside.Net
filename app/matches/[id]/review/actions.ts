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

  // Server-side validation — the UI sliders enforce these too, but a forged
  // request could bypass the browser and poison community averages.
  function parseRating(field: string): number {
    const val = parseFloat(formData.get(field) as string);
    if (isNaN(val) || val < 1 || val > 10) throw new Error(`Invalid ${field}: must be 1.0–10.0`);
    return Math.round(val * 10) / 10;
  }

  const matchRating   = parseRating("match_rating");
  const player1Rating = parseRating("player1_rating");
  const player2Rating = parseRating("player2_rating");
  const comment       = (formData.get("comment") as string)?.trim().slice(0, 2000) || null;
  const isFavorited   = formData.get("is_favorited") === "true";
  const collection    = (formData.get("collection_name") as string)?.trim().slice(0, 100) || null;

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

  const check = await checkAndAwardAchievements(profile.id)
    .catch(() => ({ earned: [] as string[], nudge: null }));

  return { success: true, newAchievements: check.earned, progressNudge: check.nudge };
}

export async function deleteReview(reviewId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not authenticated");

  const supabase = adminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkId)
    .single();

  if (!profile) throw new Error("Profile not found");

  // Delete only if this user owns the review
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getExistingReview(matchId: string) {
  // Identity comes from the session, never from a caller-supplied argument —
  // every export in a "use server" file is a publicly callable endpoint.
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

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
