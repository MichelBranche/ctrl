import "server-only";
import { cookies } from "next/headers";
import { ADMIN_LANG_COOKIE, adminDict, parseAdminLocale, type AdminDict, type AdminLocale } from "@/lib/admin-i18n";

export async function getAdminLocale(): Promise<AdminLocale> {
  return parseAdminLocale((await cookies()).get(ADMIN_LANG_COOKIE)?.value);
}

export async function getAdminCopy(): Promise<{ lang: AdminLocale; t: AdminDict }> {
  const lang = await getAdminLocale();
  return { lang, t: adminDict[lang] };
}
