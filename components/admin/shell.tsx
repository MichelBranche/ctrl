"use client";

import { UserAvatar } from "@/components/admin/user-avatar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { signOut } from "@/app/admin/actions";
import { adminSearch, type SearchHit } from "@/app/admin/dashboard-actions";

type Nav = { href: string; label: string; icon: ReactNode; badge?: "requests" | "email" };

const I = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV: Nav[] = [
  { href: "/admin/desk", label: "La mia scrivania", icon: I("M3 5h18v12H3zM8 21h8M12 17v4M6 9h5M6 12h8") },
  { href: "/admin", label: "Panoramica", icon: I("M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 17v3h6v-3z") },
  { href: "/admin/journal", label: "Journal", icon: I("M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4") },
  { href: "/admin/media", label: "Media", icon: I("M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01") },
  { href: "/admin/shop", label: "Shop", icon: I("M3 8h18l-2 13H5L3 8zM8 8V6a4 4 0 0 1 8 0v2") },
  { href: "/admin/requests", label: "Richieste", icon: I("M4 6h16v12H4zM4 7l8 6 8-6"), badge: "requests" },
  { href: "/admin/email", label: "Email", icon: I("M3 6h18v12H3zM3 7l9 6 9-6M8 3h8"), badge: "email" },
  { href: "/admin/newsletter", label: "Newsletter", icon: I("M4 19V5l16 7zM4 12h8") },
  { href: "/admin/riunioni", label: "Riunioni", icon: I("M3 7h12v10H3zM15 10l6-3v10l-6-3") },
  { href: "/admin/stats", label: "Statistiche", icon: I("M4 20V10M10 20V4M16 20v-7M22 20H2") },
  { href: "/admin/social", label: "Social", icon: I("M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0M12 2v2M12 20v2M2 12h2M20 12h2") },
  { href: "/admin/status", label: "Stato sito", icon: I("M3 12h4l3-7 4 14 3-7h4") },
  { href: "/admin/introiti", label: "Introiti", icon: I("M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3") },
  { href: "/admin/audit", label: "Registro attività", icon: I("M9 4h6v3H9zM6 6h12v15H6zM9 11h6M9 15h4") },
  { href: "/admin/team", label: "Team", icon: I("M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8") },
  { href: "/admin/settings", label: "Impostazioni", icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.2 2L6 8.3 4 8l-1 3 2 1v1l-2 1 1 3 2-.2L7.3 17 7 19l3 1 1-2h2l1 2 3-1-.2-2 1.3-1.3 2 .3 1-3-2-1z") },
];

const ACTIONS: (SearchHit & { needs?: string })[] = [
  { label: "Nuovo articolo", hint: "Azione", href: "/admin/posts/new", needs: "/admin/journal" },
  { label: "Nuova email", hint: "Azione", href: "/admin/email?compose=new", needs: "/admin/email" },
  { label: "Registra un lavoro", hint: "Azione", href: "/admin/introiti#nuovo" },
  { label: "Esporta iscritti CSV", hint: "Azione", href: "/admin/newsletter/export", needs: "/admin/newsletter" },
  { label: "Apri il sito", hint: "Azione", href: "/" },
];

const readCollapsed = () => localStorage.getItem("adm-collapsed") === "1";
const subscribeCollapsed = (cb: () => void) => {
  window.addEventListener("adm-collapsed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("adm-collapsed", cb);
    window.removeEventListener("storage", cb);
  };
};

const hiddenNow = () => document.visibilityState !== "visible";

/** Unread count for the shared inbox, polled from the client so layout renders never touch IMAP. */
function useEmailUnread(enabled: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const load = async () => {
      if (hiddenNow()) return;
      try {
        const r = await fetch("/admin/email/unread", { cache: "no-store" });
        if (r.ok && !stop) setN(((await r.json()) as { n?: number }).n ?? 0);
      } catch {
        /* offline: keep last value */
      }
    };
    void load();
    const t = setInterval(load, 30_000);
    const onVis = () => !hiddenNow() && void load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("ctrl-mail-changed", load);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("ctrl-mail-changed", load);
    };
  }, [enabled]);
  return n;
}

const isActive = (path: string, href: string) =>
  href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`) || (href === "/admin/journal" && (path.startsWith("/admin/edit") || path.startsWith("/admin/posts")));

export function AdminShell({ email, name, avatarUrl, allowed, badges, children }: { email: string; name: string; avatarUrl: string | null; allowed: string[]; badges: { requests: number }; children: ReactNode }) {
  const path = usePathname();
  const nav = NAV.filter((n) => allowed.includes(n.href));
  const emailUnread = useEmailUnread(allowed.includes("/admin/email"));
  const counts = { requests: badges.requests, email: emailUnread };
  const actions = ACTIONS.filter((a) => !a.needs || allowed.includes(a.needs));
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  // Close the drawer and account menu on navigation (state adjusted during render, no effect).
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    setSeenPath(path);
    setDrawer(false);
    setMenu(false);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      } else if (e.key === "Escape") {
        setDrawer(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    localStorage.setItem("adm-collapsed", collapsed ? "0" : "1");
    window.dispatchEvent(new Event("adm-collapsed"));
  };

  const current = nav.find((n) => isActive(path, n.href));

  return (
    <div className="adm-app" data-collapsed={collapsed ? "" : undefined} data-drawer={drawer ? "" : undefined}>
      <aside className="adm-side" aria-label="Sezioni">
        <div className="adm-side-head">
          <Link href="/admin" className="adm-brand" aria-label="CTRL® Admin, panoramica">
            <span className="adm-brand-mark">C</span>
            <span className="adm-side-text">CTRL® Admin</span>
          </Link>
          <button type="button" className="adm-icon-btn adm-collapse" onClick={toggle} aria-label={collapsed ? "Espandi barra laterale" : "Comprimi barra laterale"} aria-pressed={collapsed}>
            {I(collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6")}
          </button>
          <button type="button" className="adm-icon-btn adm-drawer-close" onClick={() => setDrawer(false)} aria-label="Chiudi menu">
            {I("M6 6l12 12M18 6L6 18")}
          </button>
        </div>
        <nav className="adm-navigation" aria-label="Navigazione principale">
          <ul className="adm-nav">
            {["/admin", "/admin/desk"].flatMap(href => nav.filter(n => n.href === href)).map(n => <NavItem key={n.href} item={n} path={path} collapsed={collapsed} counts={counts} />)}
            <NavGroup key={`content:${path}`} id="content" label="Contenuti" icon={I("M4 6h6l2 2h8v12H4z")} items={nav.filter(n => ["/admin/journal", "/admin/media", "/admin/social"].includes(n.href))} path={path} collapsed={collapsed} counts={counts} />
            {nav.filter(n => n.href === "/admin/shop").map(n => <NavItem key={n.href} item={n} path={path} collapsed={collapsed} counts={counts} />)}
            <NavGroup key={`communications:${path}`} id="communications" label="Comunicazioni" icon={I("M4 5h16v12H9l-5 4zM8 9h8M8 13h5")} items={nav.filter(n => ["/admin/requests", "/admin/email", "/admin/newsletter", "/admin/riunioni"].includes(n.href))} path={path} collapsed={collapsed} counts={counts} />
            <NavGroup key={`analysis:${path}`} id="analysis" label="Analisi e sito" icon={I("M4 20V4M4 20h17M8 15l4-5 4 2 4-7")} items={nav.filter(n => ["/admin/stats", "/admin/status"].includes(n.href))} path={path} collapsed={collapsed} counts={counts} />
            {nav.filter(n => ["/admin/introiti", "/admin/team", "/admin/audit"].includes(n.href)).map(n => <NavItem key={n.href} item={n} path={path} collapsed={collapsed} counts={counts} />)}
          </ul>
          <ul className="adm-nav adm-nav-footer">
            {nav.filter(n => n.href === "/admin/settings").map(n => <NavItem key={n.href} item={n} path={path} collapsed={collapsed} counts={counts} />)}
          </ul>
        </nav>
      </aside>
      <button type="button" className="adm-scrim" aria-label="Chiudi menu" tabIndex={-1} onClick={() => setDrawer(false)} />

      <div className="adm-body">
        <header className="adm-topbar">
          <button type="button" className="adm-icon-btn adm-burger" onClick={() => setDrawer(true)} aria-label="Apri menu" aria-expanded={drawer}>
            {I("M4 7h16M4 12h16M4 17h16")}
          </button>
          <nav className="adm-crumbs" aria-label="Percorso">
            <Link href="/admin">Admin</Link>
            {current && current.href !== "/admin" ? (
              <>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{current.label}</span>
              </>
            ) : null}
          </nav>
          <button type="button" className="adm-search" onClick={() => setPalette(true)}>
            {I("M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4")}
            <span>Cerca o vai a…</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="adm-account">
            <button type="button" className="adm-avatar" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu" aria-label="Account">
              <UserAvatar name={name || email} src={avatarUrl} />
            </button>
            {menu ? (
              <div className="adm-menu" role="menu">
                <p className="adm-menu-email">
                  <strong>{name}</strong>
                  <br />
                  {email}
                </p>
                <Link href="/admin/settings" role="menuitem" className="adm-menu-item">
                  Impostazioni
                </Link>
                <a href="/" target="_blank" rel="noopener noreferrer" role="menuitem" className="adm-menu-item">
                  Apri il sito
                </a>
                <form action={signOut}>
                  <button role="menuitem" className="adm-menu-item">
                    Esci
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </header>
        <div className="adm-content">{children}</div>
      </div>
      {palette ? <Palette nav={nav} actions={actions} onClose={() => setPalette(false)} /> : null}
    </div>
  );
}

type NavCounts = { requests: number; email: number };
function NavItem({ item, path, collapsed, counts }: { item: Nav; path: string; collapsed: boolean; counts: NavCounts }) {
  const count = item.badge ? counts[item.badge] : 0;
  return <li><Link href={item.href} className="adm-nav-link" aria-current={isActive(path,item.href) ? "page" : undefined} title={collapsed ? item.label : undefined} aria-label={collapsed ? `${item.label}${count ? `, ${count} nuove` : ""}` : undefined}>
    {item.icon}<span className="adm-side-text">{item.label}</span>{count ? <span className="adm-count" aria-label={`${count} nuove`}>{count}</span> : null}
  </Link></li>;
}

const readGroups = () => { try { return localStorage.getItem("adm-nav-groups") ?? "{}"; } catch { return "{}"; } };
const subscribeGroups = (callback: () => void) => {
  window.addEventListener("adm-nav-groups",callback); window.addEventListener("storage",callback);
  return () => { window.removeEventListener("adm-nav-groups",callback); window.removeEventListener("storage",callback); };
};
function groupPreferences(raw: string): Record<string, boolean> { try { const value = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } }

function NavGroup({ id, label, icon, items, path, collapsed, counts }: { id: string; label: string; icon: ReactNode; items: Nav[]; path: string; collapsed: boolean; counts: NavCounts }) {
  const saved = useSyncExternalStore(subscribeGroups,readGroups,()=>"{}");
  const [override,setOverride] = useState<boolean | null>(null);
  if (!items.length) return null;
  const active = items.some(item => isActive(path,item.href));
  const open = override ?? (active || groupPreferences(saved)[id] === true);
  const count = items.reduce((sum,item)=>sum+(item.badge ? counts[item.badge] : 0),0);
  return <li className="adm-nav-group" data-open={open || undefined} data-active={active || undefined}>
    <button type="button" className="adm-nav-link adm-nav-group-toggle" aria-expanded={open} aria-controls={`adm-group-${id}`} onClick={()=>{
      setOverride(!open);
      try { localStorage.setItem("adm-nav-groups",JSON.stringify({...groupPreferences(readGroups()),[id]:!open})); window.dispatchEvent(new Event("adm-nav-groups")); } catch { /* Still works when storage is unavailable. */ }
    }}>{icon}<span className="adm-side-text">{label}</span>{!open && count ? <span className="adm-count" aria-label={`${count} nuove`}>{count}</span> : null}<span className="adm-group-chevron" aria-hidden="true">{I("m9 5 7 7-7 7")}</span></button>
    <ul id={`adm-group-${id}`} className="adm-nav-children" hidden={!open}>{items.map(item=><NavItem key={item.href} item={item} path={path} collapsed={collapsed} counts={counts} />)}</ul>
  </li>;
}

function Palette({ nav, actions, onClose }: { nav: Nav[]; actions: SearchHit[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [sel, setSel] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await adminSearch(q).catch(() => []))), 180);
    return () => clearTimeout(t);
  }, [q]);

  const needle = q.trim().toLowerCase();
  const local = [...nav.map((n) => ({ label: n.label, hint: "Sezione", href: n.href })), ...actions.map(({ label, hint, href }) => ({ label, hint, href }))].filter((x) => !needle || x.label.toLowerCase().includes(needle));
  const items = [...local, ...(q.trim().length < 2 ? [] : hits)];

  const go = useCallback(
    (h: SearchHit) => {
      onClose();
      if (h.href.endsWith("/export") || h.href === "/") window.open(h.href, h.href === "/" ? "_blank" : "_self");
      else router.push(h.href);
    },
    [onClose, router],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && items[sel]) {
      e.preventDefault();
      go(items[sel]);
    } else if (e.key === "Escape") onClose();
  };

  return (
    <div className="adm-palette-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="adm-palette" role="dialog" aria-modal="true" aria-label="Cerca">
        <input
          ref={input}
          className="adm-palette-input"
          placeholder="Cerca articoli, richieste, iscritti o sezioni"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded="true"
          aria-controls="adm-palette-list"
          aria-activedescendant={items[sel] ? `adm-hit-${sel}` : undefined}
        />
        <ul id="adm-palette-list" className="adm-palette-list" role="listbox">
          {items.map((h, i) => (
            <li key={`${h.href}-${i}`} id={`adm-hit-${i}`} role="option" aria-selected={i === sel} className="adm-hit" onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
              <span>{h.label}</span>
              <span className="adm-muted">{h.hint}</span>
            </li>
          ))}
          {!items.length ? <li className="adm-hit adm-muted">{pending ? "Ricerca…" : "Nessun risultato."}</li> : null}
        </ul>
      </div>
    </div>
  );
}
