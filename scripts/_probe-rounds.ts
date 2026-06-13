/**
 * _probe-rounds.ts — read-only.
 * roundId histogram (with match counts) for a few real draws of different
 * sizes, to design a draw-size-agnostic round-label mapping.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { matchstat } from "../lib/matchstat";

const SAMPLES: { label: string; tour: string; id: string }[] = [
  { label: "Indian Wells 2022 ATP (96-draw, real)", tour: "atp", id: "17550" },
  { label: "Madrid 2022 ATP (56-draw)",             tour: "atp", id: "17560" },
  { label: "Canadian Open 2021 ATP (46 singles?)",   tour: "atp", id: "16931" },
  { label: "Paris Masters 2024 ATP (55 singles)",    tour: "atp", id: "19417" },
];

async function main() {
  for (const s of SAMPLES) {
    const res = await matchstat<any>(`${s.tour}/tournament/results/${s.id}`);
    const singles: any[] = res.singles ?? res.data?.singles ?? [];
    const byRound = new Map<number, number>();
    for (const m of singles) byRound.set(m.roundId, (byRound.get(m.roundId) ?? 0) + 1);
    const ordered = [...byRound.entries()].sort((a, b) => a[0] - b[0]);
    console.log(`\n${s.label} — ${singles.length} singles`);
    console.log("  roundId → count: " + ordered.map(([r, c]) => `${r}:${c}`).join("  "));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
