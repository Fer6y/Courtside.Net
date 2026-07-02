/**
 * wipe.ts — remove every trace of the Press Box.
 *
 * Deletes, in dependency order: reactions on/by bot content, comments on bot
 * reviews, the bots' reviews, watched matches, skill ratings, achievements,
 * follows, and finally the persona profiles themselves. Everything is keyed
 * off clerk_user_id LIKE 'bot_%', so real users are untouchable here.
 *
 * Run:  npx tsx scripts/pressbox/wipe.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { BOT_PREFIX } from "./personas";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// .in() lists go into the request URL, so keep chunks small.
async function chunkedDelete(table: string, column: string, ids: string[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const { count, error } = await supabase
      .from(table).delete({ count: "exact" }).in(column, ids.slice(i, i + 100));
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    total += count ?? 0;
  }
  return total;
}

async function main() {
  const { data: bots, error } = await supabase
    .from("profiles").select("id, username").like("clerk_user_id", `${BOT_PREFIX}%`);
  if (error) throw new Error(error.message);
  if (!bots || bots.length === 0) {
    console.log("No Press Box profiles found — nothing to wipe.");
    return;
  }
  const botIds = bots.map((b) => b.id as string);
  console.log(`Wiping ${bots.length} Press Box profiles: ${bots.map((b) => "@" + b.username).join(", ")}\n`);

  // Bot review ids — real users may have commented/reacted on them
  const { data: botReviews } = await supabase
    .from("reviews").select("id").in("user_id", botIds).limit(10000);
  const reviewIds = (botReviews ?? []).map((r) => r.id as string);

  const { data: reviewComments } = reviewIds.length
    ? await supabase.from("comments").select("id").in("review_id", reviewIds).limit(10000)
    : { data: [] };
  const commentIds = (reviewComments ?? []).map((c) => c.id as string);

  const counts: Record<string, number> = {};
  counts["reactions (on bot reviews)"]  = await chunkedDelete("reactions", "target_id", [...reviewIds, ...commentIds]);
  counts["reactions (by bots)"]         = await chunkedDelete("reactions", "user_id", botIds);
  counts["comments (on bot reviews)"]   = await chunkedDelete("comments", "review_id", reviewIds);
  counts["comments (by bots)"]          = await chunkedDelete("comments", "user_id", botIds);
  counts["reviews"]                     = await chunkedDelete("reviews", "user_id", botIds);
  counts["watched_matches"]             = await chunkedDelete("watched_matches", "user_id", botIds);
  counts["skill_ratings"]               = await chunkedDelete("skill_ratings", "user_id", botIds);
  counts["achievements"]                = await chunkedDelete("achievements", "user_id", botIds);
  counts["follows (as follower)"]       = await chunkedDelete("follows", "follower_id", botIds);
  counts["follows (as followed)"]       = await chunkedDelete("follows", "following_id", botIds);
  counts["profiles"]                    = await chunkedDelete("profiles", "id", botIds);

  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log("\nPress Box wiped.");
}

main().catch((e) => { console.error(e); process.exit(1); });
