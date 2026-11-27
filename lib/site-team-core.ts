import type { TeamMember, TeamSocials } from "@/lib/content";

export const TEAM_GROUPS = ["founder", "team"] as const;
export type TeamGroup = (typeof TEAM_GROUPS)[number];
export const isTeamGroup = (v: unknown): v is TeamGroup => TEAM_GROUPS.includes(v as TeamGroup);

export const SITE_TEAM_TAG = "site-team";
export const SITE_TEAM_ADMIN = "/admin/sito/contenuti";

export const TEAM_LIMITS = {
  name: 80,
  slug: 80,
  role: 160,
  bio: 1200,
  skill: 40,
  skills: 16,
  url: 500,
  email: 254,
  photoFocus: 32,
  photoBytes: 350_000,
  photoDataUrl: 500_000,
} as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FOCUS_RE = /^\d{1,3}% \d{1,3}%$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CTRL = /[\x00-\x1f\x7f]/;

export type SiteTeamSocials = { linkedin: string; email: string; website: string; github: string };

export type SiteTeamMember = {
  id: string;
  slug: string;
  name: string;
  roleIt: string;
  roleEn: string;
  bioIt: string;
  bioEn: string;
  skills: string[];
  /** URL shown on the public site (uploaded photo route, path, or https). */
  photo: string | null;
  photoUrl: string;
  photoFocus: string;
  hasPhotoBlob: boolean;
  group: TeamGroup;
  socials: SiteTeamSocials;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SiteTeamInput = {
  slug: string;
  name: string;
  roleIt: string;
  roleEn: string;
  bioIt: string;
  bioEn: string;
  skills: string[];
  photoUrl: string;
  photoFocus: string;
  group: TeamGroup;
  socials: SiteTeamSocials;
  isActive: boolean;
};

export type SiteTeamFieldError =
  | "name"
  | "slug"
  | "roleIt"
  | "roleEn"
  | "bioIt"
  | "bioEn"
  | "skills"
  | "photoUrl"
  | "photoFocus"
  | "group"
  | "linkedin"
  | "email"
  | "website"
  | "github";

export const emptySocials = (): SiteTeamSocials => ({ linkedin: "", email: "", website: "", github: "" });

export const emptyInput = (): SiteTeamInput => ({
  slug: "",
  name: "",
  roleIt: "",
  roleEn: "",
  bioIt: "",
  bioEn: "",
  skills: [],
  photoUrl: "",
  photoFocus: "50% 30%",
  group: "team",
  socials: emptySocials(),
  isActive: true,
});

export function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TEAM_LIMITS.slug);
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function hrefOk(raw: string): boolean {
  if (!raw) return true;
  if (raw.length > TEAM_LIMITS.url || CTRL.test(raw)) return false;
  if (raw.startsWith("/")) return raw.startsWith("/team/") || raw.startsWith("/images/team/") || raw.startsWith("/api/public/team-photo/")
    ? !raw.includes("..") && !raw.startsWith("//")
    : !raw.includes("..") && !raw.startsWith("//") && /^\/[A-Za-z0-9._~:@!$&'()*+,;=\-/%]+$/.test(raw);
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parseSkills(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]/)
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const skill = clip(item, TEAM_LIMITS.skill);
    if (!skill || CTRL.test(skill)) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
    if (out.length >= TEAM_LIMITS.skills) break;
  }
  return out;
}

export function parseInput(raw: unknown): { ok: true; value: SiteTeamInput } | { ok: false; field: SiteTeamFieldError } {
  if (!raw || typeof raw !== "object") return { ok: false, field: "name" };
  const r = raw as Record<string, unknown>;
  const name = clip(r.name, TEAM_LIMITS.name);
  if (!name || CTRL.test(name)) return { ok: false, field: "name" };
  const slug = clip(r.slug, TEAM_LIMITS.slug) || slugifyName(name);
  if (!SLUG_RE.test(slug)) return { ok: false, field: "slug" };
  const roleIt = clip(r.roleIt, TEAM_LIMITS.role);
  const roleEn = clip(r.roleEn, TEAM_LIMITS.role);
  const bioIt = clip(r.bioIt, TEAM_LIMITS.bio);
  const bioEn = clip(r.bioEn, TEAM_LIMITS.bio);
  if (CTRL.test(roleIt)) return { ok: false, field: "roleIt" };
  if (CTRL.test(roleEn)) return { ok: false, field: "roleEn" };
  if (CTRL.test(bioIt)) return { ok: false, field: "bioIt" };
  if (CTRL.test(bioEn)) return { ok: false, field: "bioEn" };
  const skills = parseSkills(r.skills);
  const photoUrl = clip(r.photoUrl, TEAM_LIMITS.url);
  if (!hrefOk(photoUrl)) return { ok: false, field: "photoUrl" };
  const photoFocus = clip(r.photoFocus, TEAM_LIMITS.photoFocus) || "50% 30%";
  if (!FOCUS_RE.test(photoFocus)) return { ok: false, field: "photoFocus" };
  const [x, y] = photoFocus.split(" ").map((part) => Number(part.slice(0, -1)));
  if (x > 100 || y > 100) return { ok: false, field: "photoFocus" };
  if (!isTeamGroup(r.group)) return { ok: false, field: "group" };
  const socialsRaw = r.socials && typeof r.socials === "object" ? (r.socials as Record<string, unknown>) : {};
  const socials: SiteTeamSocials = {
    linkedin: clip(socialsRaw.linkedin, TEAM_LIMITS.url),
    email: clip(socialsRaw.email, TEAM_LIMITS.email),
    website: clip(socialsRaw.website, TEAM_LIMITS.url),
    github: clip(socialsRaw.github, TEAM_LIMITS.url),
  };
  if (socials.email && !EMAIL_RE.test(socials.email)) return { ok: false, field: "email" };
  if (!hrefOk(socials.linkedin)) return { ok: false, field: "linkedin" };
  if (!hrefOk(socials.website)) return { ok: false, field: "website" };
  if (!hrefOk(socials.github)) return { ok: false, field: "github" };
  return {
    ok: true,
    value: {
      slug, name, roleIt, roleEn, bioIt, bioEn, skills, photoUrl, photoFocus,
      group: r.group, socials, isActive: r.isActive !== false && r.isActive !== 0 && r.isActive !== "0",
    },
  };
}

export function teamPhotoPath(id: string, updatedAt?: string): string {
  const base = `/api/public/team-photo/${encodeURIComponent(id)}`;
  return updatedAt ? `${base}?v=${encodeURIComponent(updatedAt)}` : base;
}

export function toPublicMember(member: SiteTeamMember): TeamMember {
  const socials: TeamSocials = {};
  if (member.socials.linkedin) socials.linkedin = member.socials.linkedin;
  if (member.socials.email) socials.email = member.socials.email;
  if (member.socials.website) socials.website = member.socials.website;
  if (member.socials.github) socials.github = member.socials.github;
  const roleEn = member.roleEn || member.roleIt;
  const bioEn = member.bioEn || member.bioIt;
  return {
    slug: member.slug,
    name: member.name,
    role: { it: member.roleIt, en: roleEn, de: roleEn, fr: roleEn },
    bio: { it: member.bioIt, en: bioEn, de: bioEn, fr: bioEn },
    skills: member.skills,
    photo: member.photo,
    photoFocus: member.photoFocus,
    group: member.group,
    socials,
  };
}

export const FIELD_ERROR_IT: Record<SiteTeamFieldError, string> = {
  name: "Inserisci un nome, fino a 80 caratteri.",
  slug: "L'indirizzo interno può contenere solo lettere minuscole, numeri e trattini.",
  roleIt: "Controlla il ruolo in italiano.",
  roleEn: "Controlla il ruolo in inglese.",
  bioIt: "Controlla la biografia in italiano.",
  bioEn: "Controlla la biografia in inglese.",
  skills: "Controlla le competenze.",
  photoUrl: "Inserisci un percorso del sito (ad esempio /team/nome.webp) oppure un link https.",
  photoFocus: "L'inquadratura deve essere nel formato 50% 30%.",
  group: "Scegli se la persona è founder o parte del team.",
  linkedin: "Inserisci un link LinkedIn completo, che inizi con https://.",
  email: "Inserisci un'email valida.",
  website: "Inserisci un link al sito completo, che inizi con https://.",
  github: "Inserisci un link GitHub completo, che inizi con https://.",
};

export const FIELD_ERROR_EN: Record<SiteTeamFieldError, string> = {
  name: "Enter a name, up to 80 characters.",
  slug: "The internal address can only contain lowercase letters, numbers and hyphens.",
  roleIt: "Check the Italian role.",
  roleEn: "Check the English role.",
  bioIt: "Check the Italian bio.",
  bioEn: "Check the English bio.",
  skills: "Check the skills.",
  photoUrl: "Enter a site path (for example /team/name.webp) or an https link.",
  photoFocus: "Crop position must look like 50% 30%.",
  group: "Choose whether this person is a founder or a team member.",
  linkedin: "Enter a full LinkedIn link starting with https://.",
  email: "Enter a valid email address.",
  website: "Enter a full website link starting with https://.",
  github: "Enter a full GitHub link starting with https://.",
};
