import type { AdminDict } from "@/lib/admin-i18n";

export type SettingsNavItem = { id: string; href: string; label: string; icon: string; group: string };

/** Settings navigation entries. On the main page the account sections are anchors; elsewhere they link back. */
export function settingsNav(t: AdminDict, opts: { social: boolean; onMain: boolean }) {
  const base = opts.onMain ? "" : "/admin/settings";
  const acc = t.settings.navGroupAccount;
  const items: SettingsNavItem[] = [
    { id: "profilo", href: `${base}#profilo`, label: t.settings.navProfile, group: acc, icon: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" },
    { id: "lingua", href: `${base}#lingua`, label: t.settings.navLanguage, group: acc, icon: "M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" },
    { id: "sicurezza", href: `${base}#sicurezza`, label: t.settings.navSecurity, group: acc, icon: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4" },
    { id: "sessione", href: `${base}#sessione`, label: t.settings.navSession, group: acc, icon: "M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" },
  ];
  if (opts.social) items.push({ id: "sito", href: "/admin/settings/sito", label: t.settings.navSite, group: t.settings.navGroupWorkspace, icon: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" });
  return items;
}
