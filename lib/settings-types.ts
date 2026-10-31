export const SOCIAL_KEYS = ["instagram", "linkedin", "x", "tiktok", "youtube", "behance", "github"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];
export const SOCIAL_LABEL: Record<SocialKey, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  behance: "Behance",
  github: "GitHub",
};
/** Hostnames each profile URL must point at, so a typo cannot put an arbitrary link in the footer. */
export const SOCIAL_HOSTS: Record<SocialKey, string[]> = {
  instagram: ["instagram.com"],
  linkedin: ["linkedin.com"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  behance: ["behance.net"],
  github: ["github.com"],
};
export type SocialLink = { key: SocialKey; label: string; url: string };

