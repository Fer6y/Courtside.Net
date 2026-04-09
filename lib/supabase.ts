import { createClient } from "@supabase/supabase-js";

// Public client — uses the anon key, safe for browser and server components.
// Respects all RLS policies. Use this for any data reads.
// Lazy: created on first call so the build phase never hits missing env vars.
export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Admin client — uses the service role key, bypasses RLS entirely.
// SERVER-SIDE ONLY. Never call this in client components.
// Use this for: webhooks, import scripts, trusted server actions.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
