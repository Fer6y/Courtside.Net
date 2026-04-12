import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export default async function ProfileIndexPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("clerk_user_id", userId)
    .single();

  if (profile?.username) redirect(`/profile/${profile.username}`);
  redirect("/sign-in");
}
