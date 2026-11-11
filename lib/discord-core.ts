/*
 * Discord webhook payload for admin notices. No database and no secrets.
 * The message carries a type, a short title, who did it, and a CRM link.
 * Email addresses, phone numbers, message bodies and notes never reach the payload.
 */

import { isStage, STAGE_LABEL } from "@/lib/crm-core";

export const CRM_ORIGIN = "https://www.ctrlagency.dev";

export const DISCORD_KINDS = [
  "email_in", "lead_reply", "site_form", "iris", "radar", "stage", "opportunity",
  "assignment", "activity", "followup", "request", "email_admin", "team", "meet", "shop", "auth", "other",
] as const;
export type DiscordKind = (typeof DISCORD_KINDS)[number];

const PATH = /^\/admin(?:\/[A-Za-z0-9_-]+)*(?:\?[A-Za-z0-9_=&-]{1,120})?$/;

export type NoticeDraft = {
  kind: string;
  event: string;
  title: string;
  actor: string | null;
  href: string;
  at: string;
};

type DiscordEmbed = {
  title: string;
  description: string;
  url: string;
  color: number;
  timestamp: string;
  fields?: { name: string; value: string; inline: boolean }[];
};

/** True only for a Discord webhook, or for the local mock used by the test suite. */
export function discordWebhookUrl(raw: string | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    const discord = url.protocol === "https:" && (url.hostname === "discord.com" || url.hostname === "discordapp.com");
    if (!local && !discord) return null;
    if (!/^\/api\/webhooks\/\d+\/[\w-]+$/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isDiscordKind(v: string): v is DiscordKind {
  return (DISCORD_KINDS as readonly string[]).includes(v);
}

export function kindFromAction(action: string): DiscordKind {
  if (action === "requests.received") return "site_form";
  if (action.startsWith("requests.") || action.startsWith("newsletter.")) return "request";
  if (action.startsWith("crm.iris")) return "iris";
  if (action === "crm.ingest" || action === "crm.import") return "radar";
  if (action === "crm.stage" || action === "crm.opportunity_stage") return "stage";
  if (action.startsWith("crm.opportunity")) return "opportunity";
  if (action === "crm.owner") return "assignment";
  if (action.startsWith("crm.activity")) return "activity";
  if (action.startsWith("crm.followup") || action === "crm.due_followup") return "followup";
  if (action === "crm.due_activity") return "activity";
  if (action.startsWith("email.")) return "email_admin";
  if (action.startsWith("team.") || action.startsWith("introiti.")) return "team";
  if (action.startsWith("meet.")) return "meet";
  if (action.startsWith("shop.")) return "shop";
  if (action.startsWith("auth.")) return "auth";
  return "other";
}

export function colorFor(kind: DiscordKind): number {
  switch (kind) {
    case "email_in": return 0x5865f2;
    case "lead_reply": return 0x57f287;
    case "site_form": return 0x3498db;
    case "iris": return 0x9b59b6;
    case "radar": return 0x1abc9c;
    case "stage": return 0xe67e22;
    case "opportunity": return 0xf1c40f;
    case "assignment": return 0x2ecc71;
    case "activity": return 0xe74c3c;
    case "followup": return 0xd35400;
    case "request": return 0x5dade2;
    case "email_admin": return 0x2980b9;
    case "team": return 0x85929e;
    case "meet": return 0x16a085;
    case "shop": return 0xaf7ac5;
    case "auth": return 0x7f8c8d;
    case "other": return 0x95a5a6;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/** Drops addresses, phone numbers and control characters. Safe to store. */
export function scrubDiscord(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/** Drops addresses and phone numbers, then neutralises Discord markdown and mentions. */
export function escapeDiscord(input: string): string {
  const clean = scrubDiscord(input);
  return clean
    .replace(/\\/g, "\\\\")
    .replace(/([*_~`|>])/g, "\\$1")
    .replace(/@(everyone|here)/gi, "@\u200b$1")
    .replace(/<@/g, "<@\u200b");
}

export function crmPath(path: string): string {
  return PATH.test(path) ? path : "/admin";
}

export function absoluteCrmUrl(path: string): string {
  return `${CRM_ORIGIN}${crmPath(path)}`;
}

function present(value: string, fallback: string): string {
  const text = escapeDiscord(value);
  return text || fallback;
}

function stamp(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

export function discordPayload(rows: NoticeDraft[]): { allowed_mentions: { parse: [] }; embeds: DiscordEmbed[] } {
  return {
    allowed_mentions: { parse: [] },
    embeds: rows.slice(0, 10).map((row) => {
      const kind = isDiscordKind(row.kind) ? row.kind : "other";
      const actor = row.actor ? escapeDiscord(row.actor) : "";
      const embed: DiscordEmbed = {
        title: present(row.event, "CTRL"),
        description: present(row.title, "CTRL"),
        url: absoluteCrmUrl(row.href),
        color: colorFor(kind),
        timestamp: stamp(row.at),
      };
      if (actor) embed.fields = [{ name: "Chi", value: actor, inline: true }];
      return embed;
    }),
  };
}

function detailText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const text = scrubDiscord(v).slice(0, 120);
  return text || null;
}

function detailCount(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function stageName(v: unknown): string | null {
  return isStage(v) ? STAGE_LABEL[v] : null;
}

/** Short title from an allow-list of audit fields. Unknown keys, including addresses, are ignored. */
export function auditTitle(action: string, details: Record<string, unknown> | null, contactName: string | null): string {
  const name = detailText(contactName) ?? detailText(details?.name);
  const subject = detailText(details?.subject) ?? detailText(details?.title);
  if (action === "crm.stage" || action === "crm.opportunity_stage") {
    const from = stageName(details?.from);
    const to = stageName(details?.to);
    const move = from && to ? `da ${from} a ${to}` : "";
    return [name, move].filter(Boolean).join(" · ") || "Fase aggiornata";
  }
  if (action === "crm.ingest" || action === "crm.import") {
    const n = detailCount(details?.inserted);
    return n == null ? "Nuovi contatti" : `${n} nuovi contatti`;
  }
  if (action === "crm.iris_request") return "Nuova ricerca";
  if (action === "crm.iris_status") {
    const status = detailText(details?.status) ?? "aggiornata";
    const n = detailCount(details?.inserted);
    return status === "pronta" && n != null ? `${status}, ${n} nuovi` : status;
  }
  if (action === "requests.received") return [name, subject].filter(Boolean).join(" · ") || "Richiesta dal sito";
  if (action.startsWith("crm.activity")) return [name, detailText(details?.kind)].filter(Boolean).join(" · ") || "Attività";
  return [name, subject].filter(Boolean).join(" · ") || "CTRL";
}

export function auditHref(action: string, targetType: string | null, targetId: string | null): string {
  const id = targetId && /^[A-Za-z0-9_-]{1,80}$/.test(targetId) ? targetId : null;
  if (action.startsWith("crm.iris")) return id ? `/admin/crm/radar?iris=${id}` : "/admin/crm/radar";
  if (action === "crm.ingest" || action === "crm.import" || action === "crm.draft_sent" || action === "crm.draft_send_failed" || action === "crm.draft_discard") return "/admin/crm/radar";
  if ((action === "crm.due_activity" || action.startsWith("crm.activity")) && targetType !== "crm_contact") return "/admin/crm/attivita";
  if (targetType === "crm_contact" && id) return `/admin/crm/${id}`;
  if (targetType === "request") return "/admin/requests";
  if (targetType === "email" || targetType === "email_send") return "/admin/email";
  if (targetType === "meeting" || targetType === "client_meeting") return "/admin/riunioni";
  if (targetType === "user" || targetType === "job") return targetType === "job" ? "/admin/introiti" : "/admin/team";
  if (targetType === "post") return "/admin/journal";
  if (targetType === "product" || targetType === "order") return "/admin/shop";
  if (targetType === "subscriber") return "/admin/newsletter";
  if (targetType === "media") return "/admin/media";
  if (targetType === "crm") return "/admin/crm";
  return "/admin";
}

export function auditActor(action: string, name: string | null): string {
  const safe = detailText(name);
  if (safe) return safe;
  if (action === "requests.received") return "Sito";
  if (action.startsWith("crm.iris")) return "Iris";
  if (action === "crm.ingest") return "Radar";
  return "Sistema";
}
