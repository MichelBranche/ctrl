/*
 * Team roles and section permissions. Shared by server checks and the client UI (no secrets here).
 *
 * Two separate ideas:
 *  - Roles (TEAM_ROLES) are what a person does in the studio. A person can have several; they are shown as chips.
 *  - Permissions (ROLE_SECTIONS) are what each role may open in the admin. A person's permissions are the UNION of
 *    the sections of all their roles. "founder" is the only privileged role: full access, team, audit, mandatory 2FA.
 * Every founder check goes through isFounder(); never compare role strings by hand.
 */

export const TEAM_ROLES = [
  "founder",
  "project_manager",
  "designer",
  "dev_frontend",
  "dev_backend",
  "copywriter",
  "social_media",
  "marketing",
  "seo",
  "video_motion",
  "ecommerce",
  "ai_automation",
  "commerciale",
  "amministrazione",
  "assistenza",
  "esterno",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const isTeamRole = (v: unknown): v is TeamRole => TEAM_ROLES.includes(v as TeamRole);

export const ROLE_LABEL: Record<TeamRole, string> = {
  founder: "Founder",
  project_manager: "Project manager",
  designer: "Designer UI/UX",
  dev_frontend: "Sviluppatore frontend",
  dev_backend: "Sviluppatore backend",
  copywriter: "Copywriter",
  social_media: "Social media manager",
  marketing: "Marketing",
  seo: "SEO",
  video_motion: "Video e motion",
  ecommerce: "E-commerce",
  ai_automation: "AI e automazioni",
  commerciale: "Commerciale",
  amministrazione: "Amministrazione",
  assistenza: "Assistenza clienti",
  esterno: "Collaboratore esterno",
};

/** Chip colour per role (works on the dark admin and on white). */
export const ROLE_COLOR: Record<TeamRole, string> = {
  founder: "#ff4a1c",
  project_manager: "#f59e0b",
  designer: "#ec4899",
  dev_frontend: "#3b82f6",
  dev_backend: "#6366f1",
  copywriter: "#a855f7",
  social_media: "#14b8a6",
  marketing: "#22c55e",
  seo: "#84cc16",
  video_motion: "#ef4444",
  ecommerce: "#eab308",
  ai_automation: "#06b6d4",
  commerciale: "#f97316",
  amministrazione: "#94a3b8",
  assistenza: "#0ea5e9",
  esterno: "#78716c",
};

/** Areas tag the jobs in Introiti (and are a person's default area there). They no longer grant permissions. */
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

/** Admin sections. Each maps to the URL prefix(es) it owns. */
export type Section = "overview" | "desk" | "journal" | "media" | "shop" | "requests" | "newsletter" | "social" | "stats" | "status" | "settings" | "introiti" | "team" | "audit" | "email" | "meetings";

export const SECTION_HREF: Record<Section, string> = {
  overview: "/admin",
  desk: "/admin/desk",
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
  audit: "/admin/audit",
  email: "/admin/email",
  meetings: "/admin/riunioni",
};

export const SECTION_LABEL: Record<Section, string> = {
  overview: "Panoramica",
  desk: "Desk",
  journal: "Journal",
  media: "Media",
  shop: "Shop",
  requests: "Richieste",
  newsletter: "Newsletter",
  social: "Social",
  stats: "Statistiche",
  status: "Stato sito",
  settings: "Impostazioni",
  introiti: "Introiti",
  team: "Team",
  audit: "Registro",
  email: "Email",
  meetings: "Riunioni",
};

/** Every signed-in user: overview, desk, their own earnings and their own account. */
export const EVERYONE: readonly Section[] = ["overview", "desk", "introiti", "settings"];
/** Never granted by a non-founder role. */
const FOUNDER_ONLY: readonly Section[] = ["team", "audit"];

/**
 * THE permission map. Sections each role adds on top of EVERYONE. Founder: everything (see canAccess).
 * The shared agency inbox ("email") is not in any role: the founder grants it per person (emailAccess).
 */
export const ROLE_SECTIONS: Record<Exclude<TeamRole, "founder">, readonly Section[]> = {
  project_manager: ["requests", "journal", "media", "stats", "status", "meetings"],
  designer: ["media", "journal"],
  dev_frontend: ["status", "stats", "media"],
  dev_backend: ["status", "stats"],
  copywriter: ["journal", "media", "social", "newsletter"],
  social_media: ["social", "media", "newsletter", "stats"],
  marketing: ["newsletter", "social", "stats", "requests"],
  seo: ["stats", "journal", "status"],
  video_motion: ["media", "social"],
  ecommerce: ["shop", "requests"],
  ai_automation: ["journal", "media"],
  commerciale: ["requests", "shop", "stats", "meetings"],
  amministrazione: ["shop", "requests"],
  assistenza: ["requests", "shop", "meetings"],
  esterno: [],
};

/** Legacy single area (pre multi-role) to the role that grants exactly the sections that area used to open. */
export const LEGACY_AREA_ROLE: Record<Area, TeamRole> = {
  sviluppo: "dev_frontend",
  design: "designer",
  ai: "ai_automation",
  shop: "ecommerce",
  contenuti: "copywriter",
  marketing: "marketing",
};

/** `emailAccess`: the shared agency inbox, granted per person by the founder, independent of the roles. */
export type Perms = { roles: readonly string[]; emailAccess?: boolean };

/** The only founder check. */
export const isFounder = (user: Pick<Perms, "roles"> | readonly string[]) =>
  (Array.isArray(user) ? (user as readonly string[]) : (user as Perms).roles).includes("founder");

/** Union of the sections granted by every role (unknown role strings grant nothing). */
export function permissionsFor(roles: readonly string[]): Set<Section> {
  if (isFounder(roles)) return new Set(Object.keys(SECTION_HREF) as Section[]);
  const out = new Set<Section>(EVERYONE);
  for (const r of roles) if (isTeamRole(r) && r !== "founder") for (const s of ROLE_SECTIONS[r]) if (!FOUNDER_ONLY.includes(s)) out.add(s);
  return out;
}

export function canAccess(user: Perms, section: Section): boolean {
  if (isFounder(user)) return true;
  if (FOUNDER_ONLY.includes(section)) return false;
  if (section === "email") return user.emailAccess === true;
  return permissionsFor(user.roles).has(section);
}

export const allowedSections = (user: Perms) => (Object.keys(SECTION_HREF) as Section[]).filter((s) => canAccess(user, s));

/** Valid, de-duplicated roles in canonical order (form input, DB rows). */
export const normalizeRoles = (values: readonly unknown[]): TeamRole[] => TEAM_ROLES.filter((r) => values.includes(r));

/** Roles for an account from before multi-role: founder stays founder, a member gets the role matching their area. */
export function rolesFromLegacy(role: unknown, area: unknown): TeamRole[] {
  if (role === "founder") return ["founder"];
  return [isArea(area) ? LEGACY_AREA_ROLE[area] : "esterno"];
}

/** Value kept in the legacy admin_users.role column (founder/member), derived from the roles. */
export const legacyTier = (roles: readonly string[]) => (isFounder(roles) ? "founder" : "member");
