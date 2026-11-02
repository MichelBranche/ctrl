/* Team roles, areas and section permissions. Shared by server checks and the client nav (no secrets here). */

export const ROLES = ["founder", "member"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { founder: "Founder", member: "Membro" };

export const AREAS = ["sviluppo", "design", "ai", "shop", "contenuti", "marketing"] as const;
export type Area = (typeof AREAS)[number];
export const AREA_LABEL: Record<Area, string> = {
  sviluppo: "Sviluppo",
  design: "Design",
  ai: "AI",
  shop: "Shop",
  contenuti: "Contenuti",
  marketing: "Marketing",
};
export const isArea = (v: unknown): v is Area => AREAS.includes(v as Area);
export const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);

/** Admin sections. Each maps to the URL prefix(es) it owns. */
export type Section = "overview" | "journal" | "media" | "shop" | "requests" | "newsletter" | "social" | "stats" | "status" | "settings" | "introiti" | "team";

export const SECTION_HREF: Record<Section, string> = {
  overview: "/admin",
  journal: "/admin/journal",
  media: "/admin/media",
  shop: "/admin/shop",
  requests: "/admin/requests",
  newsletter: "/admin/newsletter",
  social: "/admin/social",
  stats: "/admin/stats",
  status: "/admin/status",
  settings: "/admin/settings",
  introiti: "/admin/introiti",
  team: "/admin/team",
};

/** Every signed-in user: overview, their own earnings and their own account/password. */
const EVERYONE: Section[] = ["overview", "introiti", "settings"];

/** Sections a member of each area may open and edit. Founders get everything. */
export const AREA_SECTIONS: Record<Area, Section[]> = {
  sviluppo: ["status", "stats"],
  design: ["media", "journal"],
  ai: ["journal", "media"],
  shop: ["shop", "requests"],
  contenuti: ["journal", "media", "social", "newsletter"],
  marketing: ["newsletter", "social", "stats", "requests"],
};

export type Perms = { role: Role; area: Area | null };

export function canAccess(user: Perms, section: Section): boolean {
  if (user.role === "founder") return true;
  if (section === "team") return false;
  if (EVERYONE.includes(section)) return true;
  return user.area ? AREA_SECTIONS[user.area].includes(section) : false;
}

export const allowedSections = (user: Perms) => (Object.keys(SECTION_HREF) as Section[]).filter((s) => canAccess(user, s));
