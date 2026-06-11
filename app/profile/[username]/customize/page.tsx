import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ProfileLayoutEditor from "@/components/ProfileLayoutEditor";
import type { LayoutConfig } from "@/lib/profileLayout";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `Customize Profile — @${username} — Courtside` };
}

export default async function CustomizeProfilePage({ params }: Props) {
  const { username } = await params;
  const { userId: clerkId } = await auth();

  if (!clerkId) redirect("/sign-in");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, display_name, clerk_user_id, layout_config")
    .eq("username", username)
    .single();

  if (!profile) notFound();
  if (profile.clerk_user_id !== clerkId) redirect(`/profile/${username}`);

  const displayName = profile.display_name ?? profile.username;

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">

      {/* Back */}
      <Link
        href={`/profile/${username}`}
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
      >
        ← {displayName}
      </Link>

      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold text-text-primary mb-1">
          Customize Profile
        </h1>
        <p className="font-mono text-sm text-text-dim">@{username}</p>
      </div>

      <ProfileLayoutEditor
        username={username}
        initialConfig={profile.layout_config as LayoutConfig | null}
      />
    </main>
  );
}
