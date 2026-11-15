"use server";

import { cookies } from "next/headers";
import { ADMIN_LANG_COOKIE, isAdminLocale } from "@/lib/admin-i18n";

/** Saves the admin UI language. Works on the login screen too (no session required). */
export async function setAdminLocaleAction(lang: string) {
  if (!isAdminLocale(lang)) return;
  (await cookies()).set(ADMIN_LANG_COOKIE, lang, {
    path: "/admin",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
}
