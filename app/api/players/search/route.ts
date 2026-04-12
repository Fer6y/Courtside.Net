import { getSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tour = searchParams.get("tour") ?? "";

  if (q.length < 2) return NextResponse.json([]);

  const supabase = getSupabase();
  let query = supabase
    .from("players")
    .select("id, name, country, current_rank")
    .ilike("name", `%${q}%`)
    .order("current_rank", { ascending: true, nullsFirst: false })
    .limit(9);

  if (tour) {
    query = query.filter("career_stats->>tour", "eq", tour);
  }

  const { data } = await query;
  return NextResponse.json(data ?? []);
}
