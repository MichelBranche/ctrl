import type { Address, MailSummary } from "@/lib/mail/types";

/*
 * Mail of one CRM contact: pure helpers shared by the providers, the contact email page and the tests.
 * A message belongs to a contact only when the contact's exact address (trimmed, lowercased) appears in From, To, Cc or
 * Reply-To. Never by display name, subject or domain: "info@cantina.it" does not match "vendite@cantina.it" or
 * "info@cantina.it.example".
 */

export type ContactAddress = string & { readonly __brand: "ContactAddress" };

const EMAIL = /^[^\s@<>(),;:"\\[\]]+@[^\s@<>(),;:"\\[\]]+\.[^\s@<>(),;:"\\[\]]+$/;

/** The one address used to find a contact's mail, or null when the stored value is not a single plain address. */
export function contactAddress(raw: unknown): ContactAddress | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return v.length <= 254 && EMAIL.test(v) && !/[\x00-\x1f\x7f]/.test(v) ? (v as ContactAddress) : null;
}

type Party = { address?: string | null } | null | undefined;
export type Parties = { from?: Party | Party[]; to?: Party[]; cc?: Party[]; replyTo?: Party[] };

const same = (p: Party, a: ContactAddress) => typeof p?.address === "string" && p.address.trim().toLowerCase() === a;

/** True when the contact's exact address is a sender or recipient of the message. */
export function involvesAddress(m: Parties, a: ContactAddress): boolean {
  const from = Array.isArray(m.from) ? m.from : [m.from];
  return [...from, ...(m.to ?? []), ...(m.cc ?? []), ...(m.replyTo ?? [])].some((p) => same(p, a));
}

/** Messages examined per lookup (newest first) and shown in the list. Older mail stays reachable from Posta. */
export const CONTACT_SCAN = 100;
export const CONTACT_SHOWN = 50;

/** One lookup: matching messages (newest first, at most CONTACT_SHOWN), how many were examined, and whether older ones exist. */
export type ContactMail = { list: MailSummary[]; scanned: number; more: boolean; warning?: string };

/** "sent" when we wrote it (From is one of the agency addresses), otherwise "received". */
export const mailDirection = (from: Address | null, isAgency: (a: string | null | undefined) => boolean): "sent" | "received" =>
  isAgency(from?.address) ? "sent" : "received";
