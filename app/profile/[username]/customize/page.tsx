import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ProfileLayoutEditor from "@/components/ProfileLayoutEditor";
import CourtPicker from "@/components/CourtPicker";
import TourPicker from "@/components/TourPicker";
import { COURT_COOKIE, asCourt } from "@/lib/courts";
import { TOUR_PREF_COOKIE, asTourPreference } from "@/lib/tourPreference";
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
  const layoutConfig = profile.layout_config as LayoutConfig | null;
  // Cookie drives rendering; fall back to the stored profile preference
  const jar = await cookies();
  const court = asCourt(
    jar.get(COURT_COOKIE)?.value ?? layoutConfig?.court_theme
  );
  // Cookie drives rendering; fall back to the stored profile preference
  const tourPref = asTourPreference(
    jar.get(TOUR_PREF_COOKIE)?.value ?? layoutConfig?.tour_pref
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">

      {/* Back */}
      <Link
        href={`/profile/${username}`}
        className="eyebrow mb-8 inline-block transition-colors duration-150"
        style={{ fontSize: 10, color: "rgba(236,229,216,0.4)" }}
      >
        ← {displayName}
      </Link>

      <div className="mb-10">
        <div className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.5)" }}>
          @{username}
        </div>
        <h1 className="bill-name mt-1" style={{ fontSize: 32, fontWeight: 500 }}>
          Customize Profile
        </h1>
      </div>

      {/* ── Your court ───────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="rule-divider mb-2">
          <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>
            Your court
          </span>
        </div>
        <p className="bill-name italic mb-4" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}>
          The surface the whole app is read on — Grand Slam pages keep their own colours.
        </p>
        <CourtPicker initial={court} />
      </section>

      {/* ── Your tours ───────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="rule-divider mb-2">
          <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>
            Your tours
          </span>
        </div>
        <p className="bill-name italic mb-4" style={{ fontWeight: 300, fontSize: 14, color: "rgba(236,229,216,0.5)" }}>
          Which tours lead the home page &ldquo;Top of the Draw.&rdquo; ATP only by default — add the WTA to see both.
        </p>
        <TourPicker initial={tourPref} />
      </section>

      {/* ── Sections ─────────────────────────────────────────────── */}
      <div className="rule-divider mb-5">
        <span className="eyebrow" style={{ fontSize: 10, color: "rgba(236,229,216,0.55)" }}>
          Your sections
        </span>
      </div>
      <ProfileLayoutEditor
        username={username}
        initialConfig={layoutConfig}
      />
    </main>
  );
}
