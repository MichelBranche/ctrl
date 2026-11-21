import { homeFeatured, LE_VELE, services } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";

export type NavItem = { label: string; href: string };
export type NavMenu = { id: string; label: string; groups: NavItem[][] };

/** Dropdown menus of the site nav (pill header), same on every page. */
export function siteMenus(lang: Locale): NavMenu[] {
  const t = dict[lang];
  const h = t.home;
  return [
    {
      id: "work",
      label: t.nav.work,
      groups: [
        [
          { label: LE_VELE.client, href: localize(LE_VELE.path, lang) },
          ...homeFeatured.map((item) => ({ label: item.title[lang], href: localize(item.href, lang) })),
        ],
        [{ label: h.allProjects, href: localize("/projects", lang) }],
      ],
    },
    {
      id: "services",
      label: t.nav.services,
      groups: [
        services.map((service) => ({ label: service.title[lang], href: localize(`/services/${service.slug}`, lang) })),
        [{ label: h.navAllServices, href: localize("/services", lang) }],
      ],
    },
    {
      id: "more",
      label: h.navMore,
      groups: [
        [
          { label: t.nav.journal, href: localize("/journal", lang) },
          { label: t.nav.contact, href: localize("/contact", lang) },
        ],
        [{ label: h.navTalk, href: localize("/bookings", lang) }],
      ],
    },
  ];
}
