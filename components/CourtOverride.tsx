"use client";

// Temporarily switches the whole app onto a specific court surface —
// used by match pages so a Roland Garros match is read on clay, a
// Wimbledon match on grass, etc., regardless of the user's chosen
// court theme. The user's own court is remembered in dataset.courtUser
// and restored when they navigate away.
//
// Pair with courtOverrideScript() from lib/courts.ts (inline <script>)
// so the surface applies before first paint on full page loads; this
// component covers client-side navigations and cleanup.

import { useLayoutEffect } from "react";
import type { CourtName } from "@/lib/courts";

export default function CourtOverride({ court }: { court: CourtName }) {
  useLayoutEffect(() => {
    const h = document.documentElement;
    if (!h.dataset.courtUser) h.dataset.courtUser = h.dataset.court || "grass";
    h.dataset.court = court;

    return () => {
      h.dataset.court = h.dataset.courtUser || "grass";
      delete h.dataset.courtUser;
    };
  }, [court]);

  return null;
}
