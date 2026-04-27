import type { MetadataRoute } from "next";

const BASE_URL = "https://courtside-net.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/players", "/matches", "/compare"],
        disallow: ["/api/", "/sign-in", "/sign-up", "/profile/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
