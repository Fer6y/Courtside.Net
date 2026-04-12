import { getSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SKILL_KEYS = [
  "focus", "clutch", "resilience",
  "serve", "forehand", "backhand",
  "net_play", "touch", "return_play", "reaction_time",
  "speed", "court_coverage", "positioning",
] as const;

const SKILL_LABELS: Record<string, string> = {
  focus: "Focus", clutch: "Clutch", resilience: "Resilience",
  serve: "Serve", forehand: "Forehand", backhand: "Backhand",
  net_play: "Net Play", touch: "Touch", return_play: "Return",
  reaction_time: "Reaction", speed: "Speed",
  court_coverage: "Coverage", positioning: "Positioning",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = getSupabase();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Player basic info
  const { data: player } = await supabase
    .from("players")
    .select("name, country, current_rank")
    .eq("id", id)
    .single();

  if (!player) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Recent match record — last 20 matches
  const { data: matches } = await supabase
    .from("matches")
    .select("winner_id, player1_id, player2_id")
    .or(`player1_id.eq.${id},player2_id.eq.${id}`)
    .order("match_date", { ascending: false })
    .limit(20);

  const wins = matches?.filter((m) => m.winner_id === id).length ?? 0;
  const losses = (matches?.length ?? 0) - wins;

  // Top community skill — requires ≥10 raters
  const { data: skillRows } = await admin
    .from("skill_ratings")
    .select(SKILL_KEYS.join(","))
    .eq("player_id", id);

  let topSkill: { label: string; value: number } | null = null;

  if (skillRows && skillRows.length >= 10) {
    let bestKey = "";
    let bestAvg = 0;

    for (const key of SKILL_KEYS) {
      const vals = skillRows
        .map((r) => Number((r as unknown as Record<string, unknown>)[key]))
        .filter((v) => !isNaN(v) && v > 0);
      if (!vals.length) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg > bestAvg) { bestAvg = avg; bestKey = key; }
    }

    if (bestKey) {
      topSkill = {
        label: SKILL_LABELS[bestKey] ?? bestKey,
        value: Math.round(bestAvg * 10) / 10,
      };
    }
  }

  return NextResponse.json({
    name: player.name,
    country: player.country,
    current_rank: player.current_rank,
    wins,
    losses,
    match_count: matches?.length ?? 0,
    topSkill,
  });
}
