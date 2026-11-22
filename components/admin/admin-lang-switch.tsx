"use client";

import { ADMIN_LOCALES } from "@/lib/admin-i18n";
import { useAdminLocale } from "@/components/admin/locale-provider";

export function AdminLangSwitch({ variant = "default" }: { variant?: "default" | "menu" | "auth" | "settings" }) {
  const { lang, t, setLang } = useAdminLocale();
  const switcher = (
    <div className="adm-lang" role="group" aria-label={t.langLabel}>
      {ADMIN_LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          className="adm-lang-btn"
          aria-pressed={item === lang}
          aria-current={item === lang ? "true" : undefined}
          onClick={() => setLang(item)}
        >
          {variant === "settings" ? (item === "it" ? "Italiano" : "English") : item === "it" ? t.langIt : t.langEn}
        </button>
      ))}
    </div>
  );
  if (variant === "menu") {
    return (
      <div className="adm-lang-row" role="none">
        <span>{t.langLabel}</span>
        {switcher}
      </div>
    );
  }
  if (variant === "auth") {
    return <div className="adm-auth-lang">{switcher}</div>;
  }
  if (variant === "settings") {
    return switcher;
  }
  return switcher;
}
