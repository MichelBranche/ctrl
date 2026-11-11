"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONTACT_EMAIL, LE_VELE, categoryPath, projectCategories, services } from "@/lib/content";
import { LOCAL_PATH } from "@/lib/seo";
import { dict, localeFromPath, localize, rememberLocale, switchPath } from "@/lib/i18n";

type Item = { id: string; group: string; label: string; run: () => void };

export function CommandMenu() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const lang = localeFromPath(pathname);
  const t = dict[lang];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const items = useMemo<Item[]>(() => {
    const nav = t.nav;
    return [
      { id: "home", group: "Nav", label: t.cmd.home, run: () => go(localize("/", lang)) },
      { id: "work", group: "Nav", label: nav.work, run: () => go(localize("/projects", lang)) },
      { id: "services", group: "Nav", label: nav.services, run: () => go(localize("/services", lang)) },
      { id: "team", group: "Nav", label: nav.team, run: () => go(localize("/team", lang)) },
      { id: "journal", group: "Nav", label: nav.journal, run: () => go(localize("/journal", lang)) },
      { id: "shop", group: "Nav", label: nav.shop, run: () => go(localize("/shop", lang)) },
      { id: "bookings", group: "Nav", label: t.bookings.nav, run: () => go(localize("/bookings", lang)) },
      ...projectCategories.map((c) => ({
        id: `p-${c.slug}`,
        group: nav.work,
        label: c.label[lang],
        run: () => go(localize(categoryPath(c), lang)),
      })),
      ...services.map((s) => ({
        id: `s-${s.slug}`,
        group: nav.services,
        label: s.title[lang],
        run: () => go(localize(`/services/${s.slug}`, lang)),
      })),
      {
        id: "local",
        group: nav.services,
        label: lang === "en" ? "Web studio in Valle d'Aosta" : "Agenzia web in Valle d'Aosta",
        run: () => go(localize(LOCAL_PATH, lang)),
      },
      {
        id: "le-vele",
        group: nav.work,
        label: "Residence Le Vele",
        run: () => go(localize(LE_VELE.path, lang)),
      },
      {
        id: "s-webapp",
        group: nav.services,
        label: lang === "en" ? "Scalable web apps" : "Webapp scalabili",
        run: () => go(localize("/services/webapp", lang)),
      },
      {
        id: "mail",
        group: "CTRL®",
        label: `${t.cmd.email} | ${CONTACT_EMAIL}`,
        run: () => {
          setOpen(false);
          window.location.href = `mailto:${CONTACT_EMAIL}`;
        },
      },
      {
        id: "lang",
        group: "CTRL®",
        label: t.cmd.lang,
        run: () => { const to = lang === "it" ? "en" : "it"; rememberLocale(to); go(switchPath(pathname, to)); },
      },
    ];
  }, [t, lang, go, pathname]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => `${i.label} ${i.group}`.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const toggle = useCallback((next?: boolean) => {
    setOpen((value) => {
      const result = next ?? !value;
      if (result) {
        lastFocus.current = document.activeElement as HTMLElement | null;
        setQuery("");
        setActive(0);
      }
      return result;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    };
    const onOpen = () => toggle(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ctrl:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ctrl:command", onOpen);
    };
  }, [toggle]);

  useEffect(() => {
    document.documentElement.classList.toggle("cmd-open", open);
    if (open) {
      window.__lenis?.stop();
      requestAnimationFrame(() => input.current?.focus());
    } else {
      window.__lenis?.start();
      lastFocus.current?.focus?.();
    }
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      filtered[active]?.run();
    }
  };

  return (
    <div className="cmd" role="presentation" onMouseDown={() => setOpen(false)}>
      <div
        className="cmd-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t.cmd.label}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="cmd-head">
          <span className="mono">CTRL+K</span>
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={t.cmd.placeholder}
            aria-label={t.cmd.placeholder}
            aria-controls="cmd-list"
            aria-activedescendant={filtered[active] ? `cmd-${filtered[active].id}` : undefined}
          />
          <kbd className="mono">ESC</kbd>
        </div>
        <ul id="cmd-list" className="cmd-list" role="listbox">
          {filtered.length === 0 ? <li className="cmd-empty mono">{t.cmd.empty}</li> : null}
          {filtered.map((item, index) => (
            <li
              key={item.id}
              id={`cmd-${item.id}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? "is-active" : undefined}
              onMouseEnter={() => setActive(index)}
              onClick={item.run}
            >
              <span>{item.label}</span>
              <span className="mono">{item.group}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
