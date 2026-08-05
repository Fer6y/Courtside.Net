import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import CompareStartPicker from "@/components/CompareStartPicker";

interface PlayerOption {
  id: string;
  name: string;
  country: string | null;
  current_rank: number | null;
}

export const metadata = { title: "Compare — Courtside" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ p1?: string; p2?: string }>;
}) {
  const { p1, p2 } = await searchParams;

  // Preserve old /compare?p1=X&p2=Y links → the H2H page.
  if (p1 && p2) redirect(`/h2h/${p1}/${p2}`);
  if (p1) redirect(`/h2h/${p1}`);

  const supabase = getSupabase();

  // Top ranked players (across tours) to seed the picker.
  const { data: topRaw } = await supabase
    .from("players")
    .select("id, name, country, current_rank")
    .not("current_rank", "is", null)
    .order("current_rank", { ascending: true })
    .limit(12);

  // Trending: most-rated players over the last 14 days.
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: recentRatings } = await supabase
    .from("skill_ratings")
    .select("player_id, player:player_id ( id, name, country, current_rank )")
    .gte("created_at", since14)
    .limit(400);

  const countMap = new Map<string, { count: number; player: PlayerOption }>();
  for (const r of recentRatings ?? []) {
    const player = r.player as unknown as PlayerOption | null;
    if (!player) continue;
    const existing = countMap.get(player.id);
    countMap.set(player.id, {
      count: (existing?.count ?? 0) + 1,
      player,
    });
  }
  const trendingPlayers: PlayerOption[] = [...countMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((e) => e.player);

  const topPlayers = (topRaw ?? []) as PlayerOption[];

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="eyebrow mb-2" style={{ color: "rgba(236,229,216,0.5)" }}>
          Head to head
        </p>
        <h1 className="font-mono text-3xl font-bold text-text-primary mb-1">
          Compare
        </h1>
        <p className="font-sans text-text-mid">
          Pick a player to start a head-to-head comparison.
        </p>
      </div>

      <CompareStartPicker
        topPlayers={topPlayers}
        trendingPlayers={trendingPlayers}
      />
    </main>
  );
}
