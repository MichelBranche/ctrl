"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setAdminLocaleAction } from "@/app/admin/locale-actions";
import { adminDict, type AdminDict, type AdminLocale } from "@/lib/admin-i18n";

type AdminLocaleContextValue = {
  lang: AdminLocale;
  t: AdminDict;
  setLang: (lang: AdminLocale) => void;
};

const AdminLocaleContext = createContext<AdminLocaleContextValue | null>(null);

export function AdminLocaleProvider({ lang, children }: { lang: AdminLocale; children: ReactNode }) {
  const router = useRouter();
  const [current, setCurrent] = useState(lang);
  if (current !== lang) setCurrent(lang);
  useEffect(() => {
    document.documentElement.lang = current;
  }, [current]);

  const setLang = useCallback((next: AdminLocale) => {
    if (next === current) return;
    setCurrent(next);
    document.documentElement.lang = next;
    void setAdminLocaleAction(next).then(() => router.refresh());
  }, [current, router]);

  const value = useMemo<AdminLocaleContextValue>(
    () => ({ lang: current, t: adminDict[current], setLang }),
    [current, setLang],
  );
  return <AdminLocaleContext.Provider value={value}>{children}</AdminLocaleContext.Provider>;
}

export function useAdminLocale(): AdminLocaleContextValue {
  return useContext(AdminLocaleContext) ?? { lang: "it", t: adminDict.it, setLang: () => {} };
}
