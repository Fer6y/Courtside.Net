/**
 * _probe-api-shapes.ts — read-only API inspection.
 * Dumps the shape of tournament/results, tournament/calendar, and
 * player/past-matches so we can design the Masters re-probe reliably.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { matchstat } from "../lib/matchstat";

function keys(o: any): string {
  return o && typeof o === "object" ? Object.keys(o).join(", ") : String(o);
}

async function main() {
  // 1) tournament/results for a known-good Shanghai 2024 ATP (seasonId 19412)
  console.log("── atp/tournament/results/19412 (Shanghai 2024) ──");
  const res = await matchstat<any>("atp/tournament/results/19412");
  console.log("top-level keys:", keys(res));
  const singles = res.singles ?? res.data?.singles ?? [];
  console.log("singles len:", singles.length);
  console.log("first singles match keys:", keys(singles[0]));
  console.log("first singles match:", JSON.stringify(singles[0], null, 1));
  // look for any tournament-name/surface fields at top level
  for (const k of Object.keys(res)) {
    if (k !== "singles" && k !== "doubles" && typeof res[k] !== "object") {
      console.log(`  res.${k} =`, res[k]);
    }
  }

  // 2) tournament/calendar for 2024 ATP — does it list Masters with names?
  console.log("\n── atp/tournament/calendar/2024 ──");
  try {
    const cal = await matchstat<any[]>("atp/tournament/calendar/2024");
    const arr = Array.isArray(cal) ? cal : [];
    console.log("calendar entries:", arr.length);
    console.log("first entry keys:", keys(arr[0]));
    console.log("first entry:", JSON.stringify(arr[0], null, 1));
    // print any entries whose name mentions Masters cities
    const hits = arr.filter((e) => {
      const s = JSON.stringify(e).toLowerCase();
      return s.includes("shanghai") || s.includes("cincinnati") || s.includes("indian wells") || s.includes("miami") || s.includes("madrid") || s.includes("rome") || s.includes("monte");
    });
    console.log("entries mentioning a Masters city:", hits.length);
    for (const h of hits.slice(0, 12)) console.log("   ", JSON.stringify(h));
  } catch (e) {
    console.log("calendar error:", (e as Error).message);
  }

  // 3) player past-matches sample (Sinner 47275, 2024, TourRank:2)
  console.log("\n── atp/player/past-matches/47275 (Sinner 2024 TourRank:2) ──");
  const pm = await matchstat<any[]>("atp/player/past-matches/47275", { filter: "GameYear:2024;TourRank:2" });
  const arr = Array.isArray(pm) ? pm : [];
  console.log("rows:", arr.length, "first keys:", keys(arr[0]));
  console.log("first row:", JSON.stringify(arr[0], null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
