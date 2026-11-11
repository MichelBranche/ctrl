import type { MetadataRoute } from "next";

const siteUrl = "https://www.ctrlagency.dev";

/** Search and answer-engine crawlers. All of them may read the public site. */
const aiAgents = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Applebot-Extended",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "Amazonbot",
  "meta-externalagent",
  "CCBot",
  "cohere-ai",
];
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
