import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// These routes are accessible without being signed in.
// Everything not listed here will require authentication.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/players(.*)",
  "/matches(.*)",
  "/h2h(.*)",
  "/compare(.*)",
  "/profile(.*)",         // public profiles are readable by anyone
  "/guide",               // onboarding guide — linked from home for guests
  "/api/webhooks(.*)",    // Clerk webhook must be public — no auth header
  "/api/cron(.*)",        // cron pings carry their own CRON_SECRET bearer auth
  "/api/search(.*)",      // global search — read-only public data, used by guests
  "/api/players(.*)",     // player search + bubbles — used on public pages
  "/sitemap.xml",         // search engines can't sign in
  "/robots.txt",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run middleware on all routes except static files and Next.js internals
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
