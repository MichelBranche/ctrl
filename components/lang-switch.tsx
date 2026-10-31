"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { locales, localeFromPath, rememberLocale, switchPath, dict } from "@/lib/i18n";

export function LangSwitch({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const current = localeFromPath(pathname);

  useEffect(() => {
    document.documentElement.lang = current;
  }, [current]);

  return (
    <nav className={`lang-switch ${className}`} aria-label={dict[current].langLabel}>
      {locales.map((lang) => (
        <Link
          key={lang}
          href={switchPath(pathname, lang)}
          hrefLang={lang}
          onClick={() => rememberLocale(lang)}
          aria-current={lang === current ? "true" : undefined}
          className={lang === current ? "is-active" : undefined}
        >
          {lang.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
