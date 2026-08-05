import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import RatePlayerForm from "./RatePlayerForm";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data } = await supabase.from("players").select("name").eq("id", id).single();
  return { title: data ? `Rate ${data.name} — Courtside` : "Rate Player — Courtside" };
}

export default async function RatePlayerPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const supabase = getSupabase();

  const { data: player, error } = await supabase
    .from("players")
    .select("id, name, current_rank, career_stats")
    .eq("id", id)
    .single();

  if (error || !player) notFound();

  // Load existing rating for this user if any
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await admin
    .from("skill_ratings")
    .select("*")
    .eq("user_id", userId)
    .eq("player_id", id)
    .single();

  const tour = (player.career_stats as Record<string, string> | null)?.tour;

  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-10">
      {/* Back */}
      <Link
        href={`/players/${id}`}
        className="font-sans text-sm text-text-dim hover:text-text-mid mb-8 inline-block transition-colors duration-150"
      >
        ← {player.name}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold text-text-primary">
          Rate Player
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="font-sans text-text-mid">{player.name}</span>
          {player.current_rank && (
            <span className="font-mono text-sm text-primary">#{player.current_rank}</span>
          )}
          {tour && (
            <span className="font-mono text-xs text-text-dim uppercase tracking-widest">{tour}</span>
          )}
        </div>
        <p className="font-sans text-sm text-text-dim mt-3">
          Rate each skill from <span className="text-text-mid">1.0</span> (weak) to{" "}
          <span className="text-text-mid">5.0</span> (elite). Your ratings combine with
          the community average to build the radar chart.
        </p>
        {existing && (
          <p className="font-mono text-xs text-primary mt-2">
            ✓ Updating your existing rating
          </p>
        )}
      </div>

      <RatePlayerForm playerId={id} existing={existing} />
    </main>
  );
}
