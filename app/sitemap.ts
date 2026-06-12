import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { MetadataRoute } from "next";

const BASE_URL = "https://courtside-net.vercel.app";

type IdRow = { id: string; created_at: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Paged — unbounded selects silently cap at 1,000 rows, which left
  // ~8,000 match pages out of the sitemap
  const [players, matches] = await Promise.all([
    fetchAllRows<IdRow>((from, to) =>
      admin.from("players").select("id, created_at").order("created_at").range(from, to)
    ),
    fetchAllRows<IdRow>((from, to) =>
      admin.from("matches").select("id, created_at").order("created_at").range(from, to)
    ),
  ]);

  const playerUrls: MetadataRoute.Sitemap = (players ?? []).map((p) => ({
    url: `${BASE_URL}/players/${p.id}`,
    lastModified: p.created_at ? new Date(p.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const matchUrls: MetadataRoute.Sitemap = (matches ?? []).map((m) => ({
    url: `${BASE_URL}/matches/${m.id}`,
    lastModified: m.created_at ? new Date(m.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/players`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/matches`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/compare`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...playerUrls,
    ...matchUrls,
  ];
}
