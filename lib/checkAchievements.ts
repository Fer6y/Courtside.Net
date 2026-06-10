import { createClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS } from "./achievements";

const SLAM_NAMES = ["Australian Open", "French Open", "Roland Garros", "Wimbledon", "US Open"];

type ReviewWithMatch = {
  id: string;
  comment: string | null;
  is_favorited: boolean;
  match: { surface: string | null; tournament: string } | null;
};

export async function checkAndAwardAchievements(
  profileId: string,
  opts?: { filterApplied?: boolean }
): Promise<string[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Already-earned set — skip rechecking these
  const { data: earned } = await supabase
    .from("achievements")
    .select("achievement_type")
    .eq("user_id", profileId);

  const alreadyEarned = new Set((earned ?? []).map((a) => a.achievement_type as string));

  // All achievements already awarded — nothing to do
  if (alreadyEarned.size >= ACHIEVEMENTS.length) return [];

  // ── Fetch user stats in parallel ──────────────────────────────────────────
  const [
    { data: reviews },
    { count: skillRatingCount },
    { count: followingCount },
    { count: followerCount },
    { data: watchRows },
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, comment, is_favorited, match:match_id(surface, tournament)")
      .eq("user_id", profileId),

    supabase
      .from("skill_ratings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId),

    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profileId),

    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profileId),

    supabase
      .from("watched_matches")
      .select("collection_name")
      .eq("user_id", profileId)
      .not("collection_name", "is", null),
  ]);

  const reviewList = (reviews ?? []) as unknown as ReviewWithMatch[];

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalReviews    = reviewList.length;
  const favoritedCount  = reviewList.filter((r) => r.is_favorited).length;
  const detailedReviews = reviewList.filter((r) => (r.comment?.trim().length ?? 0) >= 50).length;

  const surfaces = new Set(
    reviewList.map((r) => r.match?.surface).filter(Boolean) as string[]
  );

  const namedCollections = new Set(
    (watchRows ?? []).map((r) => r.collection_name).filter(Boolean) as string[]
  );

  // Grand Slam coverage — one from each of the 4 majors
  const allSlams = (
    reviewList.some((r) => r.match?.tournament.includes("Australian Open")) &&
    reviewList.some((r) =>
      r.match?.tournament.includes("Roland Garros") ||
      r.match?.tournament.includes("French Open")
    ) &&
    reviewList.some((r) => r.match?.tournament.includes("Wimbledon")) &&
    reviewList.some((r) => r.match?.tournament.includes("US Open"))
  );

  // Omniscient — reviewed on all 3 surfaces at both a Slam AND a Masters
  const slamMatches    = reviewList.filter((r) => SLAM_NAMES.some((s) => r.match?.tournament.includes(s)));
  const mastersMatches = reviewList.filter((r) => !SLAM_NAMES.some((s) => r.match?.tournament.includes(s)));
  const slamSurfaces    = new Set(slamMatches.map((r) => r.match?.surface).filter(Boolean));
  const mastersSurfaces = new Set(mastersMatches.map((r) => r.match?.surface).filter(Boolean));
  const omniscient = (
    slamSurfaces.has("Hard") && slamSurfaces.has("Clay") && slamSurfaces.has("Grass") &&
    mastersSurfaces.has("Hard") && mastersSurfaces.has("Clay") && mastersSurfaces.has("Grass")
  );

  // ── Criteria map ─────────────────────────────────────────────────────────
  const criteria: Record<string, boolean> = {
    first_review:     totalReviews >= 1,
    first_search:     opts?.filterApplied === true,
    first_follow:     (followingCount ?? 0) >= 1,
    first_collection: namedCollections.size >= 1,
    scorekeeper:      totalReviews >= 10,
    analyst:          (skillRatingCount ?? 0) >= 5,
    connoisseur:      favoritedCount >= 3,
    curator:          namedCollections.size >= 3,
    surface_explorer: surfaces.has("Hard") && surfaces.has("Clay") && surfaces.has("Grass"),
    commentator:      detailedReviews >= 5,
    court_authority:  totalReviews >= 50,
    deep_reader:      detailedReviews >= 10,
    radar_master:     (skillRatingCount ?? 0) >= 20,
    archivist:        favoritedCount >= 10,
    chronicler:       totalReviews >= 25,
    networker:        (followingCount ?? 0) >= 10,
    grand_slam:       allSlams,
    legend:           totalReviews >= 100,
    hall_of_fame:     (followerCount ?? 0) >= 10,
    omniscient,
    author:           detailedReviews >= 50,
    constellation:    (followerCount ?? 0) >= 25,
  };

  // ── Award newly earned ────────────────────────────────────────────────────
  const toAward = ACHIEVEMENTS.filter(
    (a) => criteria[a.id] === true && !alreadyEarned.has(a.id)
  );

  if (toAward.length > 0) {
    await supabase.from("achievements").insert(
      toAward.map((a) => ({
        user_id:          profileId,
        achievement_type: a.id,
        tier:             a.tier,
      }))
    );
  }

  return toAward.map((a) => a.id);
}
