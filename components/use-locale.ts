"use client";

import { usePathname } from "next/navigation";
import { dict, localeFromPath } from "@/lib/i18n";

export function useLocale() {
  const lang = localeFromPath(usePathname());
  return { lang, t: dict[lang] };
}
