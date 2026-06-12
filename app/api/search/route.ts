import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ players: [], profiles: [] });
  }

  const supabase = admin();
  // Strip PostgREST filter syntax characters — commas/parens inside an
  // .or() string would break (or manipulate) the filter expression.
  const safe    = q.replace(/[,()]/g, " ").trim();
  const pattern = `%${safe}%`;

  const [{ data: players }, { data: profiles }] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, country, current_rank")
      .ilike("name", pattern)
      .order("current_rank", { ascending: true, nullsFirst: false })
      .limit(6),

    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_config")
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .limit(5),
  ]);

  return NextResponse.json({
    players:  players  ?? [],
    profiles: profiles ?? [],
  });
}
