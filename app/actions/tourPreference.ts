"use server";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { asTourPreference, TOUR_PREF_COOKIE, type TourPreference } from "@/lib/tourPreference";
import type { LayoutConfig } from "@/lib/profileLayout";

// Persist the viewer's chosen tour preference. The cookie is the source of
// truth for rendering (read in server components, no DB hit per request); for
// signed-in users we also record it on their profile's layout_config as a
// durable backup. Works for guests via the cookie alone.
export async function setTourPreference(pref: TourPreference) {
  const value = asTourPreference(pref);

  const jar = await cookies();
  jar.set(TOUR_PREF_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  const { userId: clerkId } = await auth();
  if (clerkId) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, layout_config")
      .eq("clerk_user_id", clerkId)
      .single();

    if (profile) {
      // Merge so saving the tour pref never clobbers other layout settings
      const existing = (profile.layout_config ?? {}) as Partial<LayoutConfig>;
      await supabase
        .from("profiles")
        .update({ layout_config: { ...existing, tour_pref: value } })
        .eq("id", profile.id);
    }
  }

  return { success: true, tour: value };
}
