import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { EmailSender } from "@/lib/mail/template";
import { ROLE_LABEL, type TeamRole } from "@/lib/team-types";

/*
 * Per-sender email signature. Identity comes from the signed-in admin session (AdminUser: name, roles, avatarUrl),
 * never from form input. Uploaded photos live behind the admin session, so emails point to /email-avatar with an
 * HMAC (SESSION_SECRET, own label) over id + version: recipients can load that one photo, nobody can enumerate others.
 */
export const PUBLIC_ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://ctrlagency.dev";

const sign = (id: string, v: string) => {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) return null;
  return createHmac("sha256", `${s}:ctrl-email-avatar-v1`).update(`${id}|${v}`).digest("base64url").slice(0, 32);
};
export function verifyAvatarSig(id: string, v: string, sig: string) {
  const want = sign(id, v);
  return Boolean(want && sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want)));
}

export const joinRoles = (roles: readonly TeamRole[]) => {
  const l = roles.map((r) => ROLE_LABEL[r]).filter(Boolean);
  return l.length > 1 ? `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}` : l[0] ?? "";
};

function photoUrl(id: string, avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  if (/^\/team\/[\w.-]+\.(webp|jpe?g|png)$/.test(avatarUrl)) return PUBLIC_ORIGIN + avatarUrl;
  if (avatarUrl.startsWith("/admin/team/avatar")) {
    const v = new URL(avatarUrl, PUBLIC_ORIGIN).searchParams.get("v") ?? "";
    const sig = sign(id, v);
    return sig ? `${PUBLIC_ORIGIN}/email-avatar?${new URLSearchParams({ u: id, v, s: sig })}` : null;
  }
  return null;
}

export function emailSender(u: { id: string; name: string; lastName?: string | null; roles: readonly TeamRole[]; avatarUrl: string | null }): EmailSender {
  return { name: [u.name.trim(), u.lastName?.trim()].filter(Boolean).join(" "), role: joinRoles(u.roles) || null, photoUrl: photoUrl(u.id, u.avatarUrl) };
}
