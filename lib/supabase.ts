import { createClient } from "@supabase/supabase-js";

// Public client — uses the anon key, safe for browser and server components.
// Respects all RLS policies. Use this for any data reads.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client — uses the service role key, bypasses RLS entirely.
// SERVER-SIDE ONLY. Never import this in client components or expose to the browser.
// Use this for: webhooks, data import scripts, server actions that need to write
// on behalf of users (e.g. creating a profile row when a user signs up via Clerk).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
