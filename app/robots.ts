import type { MetadataRoute } from "next";

const siteUrl = "https://www.ctrlagency.dev";

const aiAgents = ["GPTBot", "OAI-SearchBot", "PerplexityBot", "Google-Extended", "ClaudeBot"];
const publicRule = { allow: "/", disallow: ["/admin", "/api"] };

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...aiAgents.map((userAgent) => ({ userAgent, ...publicRule })),
      { userAgent: "*", ...publicRule },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
