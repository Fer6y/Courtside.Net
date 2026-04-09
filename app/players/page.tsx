import { getSupabase } from "@/lib/supabase";
import type { Player } from "@/types";
import Link from "next/link";

export const metadata = {
  title: "Players — Courtside",
};

export default async function PlayersPage() {
  const supabase = getSupabase();

  const { data: players, error } = await supabase
    .from("players")
    .select("id, name, country, age, current_rank, career_stats")
    .order("current_rank", { ascending: true, nullsFirst: false });

  if (error) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-loss">Failed to load players.</p>
      </main>
    );
  }

  const atp = (players as Player[]).filter((p) => p.career_stats?.tour === "ATP");
  const wta = (players as Player[]).filter((p) => p.career_stats?.tour === "WTA");

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="font-mono text-3xl font-bold text-text-primary mb-2">
        Players
      </h1>
      <p className="font-sans text-text-mid mb-10">
        {players.length} players from Grand Slam tournaments 2020–2024
      </p>

      <TourSection title="ATP" players={atp} />
      <TourSection title="WTA" players={wta} />
    </main>
  );
}

function TourSection({ title, players }: { title: string; players: Player[] }) {
  return (
    <section className="mb-12">
      <h2 className="font-mono text-lg font-semibold text-text-mid uppercase tracking-widest mb-4">
        {title}
      </h2>
      <div className="divide-y divide-white/5">
        {players.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </div>
    </section>
  );
}

function PlayerRow({ player }: { player: Player }) {
  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center justify-between py-3 px-2 hover:bg-white/[0.03] rounded transition-colors duration-150 group"
    >
      <div className="flex items-center gap-4">
        {/* Rank */}
        <span className="font-mono text-sm text-text-dim w-8 text-right">
          {player.current_rank ?? "—"}
        </span>

        {/* Name + country */}
        <div>
          <span className="font-sans text-text-primary group-hover:text-primary transition-colors duration-150">
            {player.name}
          </span>
          {player.country && (
            <span className="font-mono text-xs text-text-dim ml-2">
              {player.country}
            </span>
          )}
        </div>
      </div>

      {/* Age */}
      {player.age && (
        <span className="font-mono text-sm text-text-dim">
          {player.age}
        </span>
      )}
    </Link>
  );
}
