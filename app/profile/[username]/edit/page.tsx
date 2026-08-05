import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ProfileEditForm from "@/components/ProfileEditForm";
import type { AvatarConfig } from "@/lib/avatarTemplates";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `Edit Profile — @${username} — Courtside` };
}

export default async function EditProfilePage({ params }: Props) {
  const { username } = await params;
  const { userId: clerkId } = await auth();

  if (!clerkId) redirect("/sign-in");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, display_name, bio, clerk_user_id")
    .eq("username", username)
    .single();

  if (!profile) notFound();
  if (profile.clerk_user_id !== clerkId) redirect(`/profile/${username}`);

  // Fetch avatar_config separately — graceful if column missing
  let avatarConfig: AvatarConfig | null = null;
  try {
    const { data } = await admin
      .from("profiles")
      .select("avatar_config")
      .eq("id", profile.id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    avatarConfig = ((data as any)?.avatar_config as AvatarConfig) ?? null;
  } catch { /* column may not exist yet */ }

  const displayName = profile.display_name ?? "";
  const bio         = (profile as Record<string, unknown>).bio as string ?? "";

  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-12">

      {/* Back */}
      <Link
        href={`/profile/${username}`}
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
      >
        ← {profile.display_name ?? profile.username}
      </Link>

      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold text-text-primary mb-1">
          Edit Profile
        </h1>
        <p className="font-mono text-sm text-text-dim">@{username}</p>
      </div>

      <ProfileEditForm
        username={username}
        initialDisplayName={displayName}
        initialBio={bio}
        initialAvatar={avatarConfig}
      />
    </main>
  );
}
