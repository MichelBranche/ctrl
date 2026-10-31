"use server";

import { randomBytes } from "node:crypto";
import { db, dbConfigured } from "@/lib/db";
import { allow } from "@/lib/request-guard";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const langOf = (form: FormData) => (form.get("lang") === "en" ? "en" : "it");

export type ContactResult = { ok: true } | { ok: false; error: "invalid" | "rate" | "unavailable" };

/** Saves a contact form submission. Honeypot hits get a fake success; nothing about the sender's IP is stored. */
export async function submitContact(form: FormData): Promise<ContactResult> {
  if (clip(form, "company_site", 200)) return { ok: true };
  const name = clip(form, "name", 120);
  const email = clip(form, "email", 200);
  const subject = clip(form, "subject", 120);
  const message = clip(form, "message", 5000);
  if (!name || !EMAIL.test(email) || !subject || message.length < 2) return { ok: false, error: "invalid" };
  if (!dbConfigured) return { ok: false, error: "unavailable" };
  try {
    if (!(await allow("contact", 5, 3_600_000))) return { ok: false, error: "rate" };
    await db().execute({
      sql: "INSERT INTO contact_requests (id, name, email, subject, message, lang) VALUES (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), name, email, subject, message, langOf(form)],
    });
    return { ok: true };
  } catch (error) {
    console.error("[contact] save failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: "unavailable" };
  }
}

export type SubscribeResult = { ok: true } | { ok: false; error: "invalid" | "rate" | "unavailable" };

/** Stores a newsletter signup (email, language, date, unsubscribe token). Signing up twice is a silent success. */
export async function subscribe(form: FormData): Promise<SubscribeResult> {
  if (clip(form, "company_site", 200)) return { ok: true };
  const email = clip(form, "email", 200).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "invalid" };
  if (!dbConfigured) return { ok: false, error: "unavailable" };
  try {
    if (!(await allow("newsletter", 5, 3_600_000))) return { ok: false, error: "rate" };
    // A returning address that had unsubscribed is re-subscribed; an active one is left untouched.
    await db().execute({
      sql: `INSERT INTO subscribers (id, email, lang, token) VALUES (?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET unsubscribed_at = NULL, lang = excluded.lang,
              created_at = CASE WHEN unsubscribed_at IS NULL THEN created_at ELSE excluded.created_at END`,
      args: [crypto.randomUUID(), email, langOf(form), randomBytes(24).toString("base64url")],
    });
    return { ok: true };
  } catch (error) {
    console.error("[newsletter] save failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: "unavailable" };
  }
}

/** Unsubscribe by token (from the link that future newsletters will carry). */
export async function unsubscribe(form: FormData): Promise<{ ok: boolean }> {
  const token = clip(form, "token", 64);
  if (!/^[\w-]{20,64}$/.test(token) || !dbConfigured) return { ok: false };
  const res = await db().execute({
    sql: "UPDATE subscribers SET unsubscribed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE token = ? AND unsubscribed_at IS NULL",
    args: [token],
  });
  return { ok: res.rowsAffected > 0 };
}
