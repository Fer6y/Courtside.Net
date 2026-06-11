import { getSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import ComparePlayerPicker from "@/components/ComparePlayerPicker";

type Props = { params: Promise<{ p1id: string }> };

export async function generateMetadata({ params }: Props) {
  const { p1id } = await params;
  const supabase = getSupabase();
  const { data } = await supabase.from("players").select("name").eq("id", p1id).single();
  return { title: data ? `${data.name} H2H — Courtside` : "H2H — Courtside" };
}

export default async function H2HPickerPage({ params }: Props) {
  const { p1id } = await params;
  const supabase = getSupabase();

  const { data: player } = await supabase
    .from("players")
    .select("id, name, country, current_rank, career_stats")
    .eq("id", p1id)
    .single();

  if (!player) notFound();

  const tour = (player.career_stats as Record<string, unknown>)?.tour as string ?? "ATP";
  const rank = player.current_rank as number | null;

  let simQuery = supabase
    .from("players")
    .select("id, name, country, current_rank")
    .filter("career_stats->>tour", "eq", tour)
    .neq("id", p1id);

  if (rank) {
    simQuery = simQuery
      .gte("current_rank", Math.max(1, rank - 25))
      .lte("current_rank", rank + 25);
  }

  const { data: similar } = await simQuery
    .order("current_rank", { ascending: true, nullsFirst: false })
    .limit(9);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href={`/players/${p1id}`}
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
      >
        ← {player.name as string}
      </Link>

      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold text-text-primary mb-1">
          H2H
        </h1>
        <p className="font-sans text-text-mid">
          <span className="text-primary">{player.name as string}</span> vs ...
        </p>
      </div>

      <ComparePlayerPicker
        p1Id={p1id}
        p1Tour={tour}
        similarPlayers={
          (similar ?? []) as Array<{
            id: string;
            name: string;
            country: string | null;
            current_rank: number | null;
          }>
        }
      />
    </main>
  );
}
