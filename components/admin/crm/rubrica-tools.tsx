"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createViewAction, deleteViewAction, renameViewAction } from "@/app/admin/crm-view-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { SOURCES, SOURCE_LABEL, STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import { RUBRICA, RUBRICA_SORTS, rubricaSearch, type RubricaQuery, type RubricaSegment, type RubricaSort } from "@/lib/crm-nav";

type SavedView = { id: string; name: string; params: string; shared: boolean; mine: boolean };

const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";
const FUNNEL = "M3 4h18l-7 8.5V19l-4 2v-8.5z";
const BOOKMARK = "M6 4h12v17l-6-4-6 4z";
const VISTA_KEY = "ctrl:crm-rubrica-vista";
const SEGMENT_LABEL: Record<RubricaSegment, string> = { tutti: "Tutti", aziende: "Aziende", persone: "Persone", liberi: "Non assegnati" };
const SORT_LABEL: Record<RubricaSort, string> = { aggiornato: "Aggiornato", nome: "Nome", fase: "Fase", citta: "Città", punteggio: "Punteggio", azione: "Prossima azione" };

/** Remembers lista or griglia when the URL does not say, without touching Cmd+K. */
export function VistaMemory({ vista }: { vista: "lista" | "griglia" }) {
  const router = useRouter();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("vista")) {
      try { localStorage.setItem(VISTA_KEY, vista); } catch { /* private mode */ }
      return;
    }
    let saved = "";
    try { saved = localStorage.getItem(VISTA_KEY) ?? ""; } catch { /* private mode */ }
    if (saved === "griglia") {
      url.searchParams.set("vista", "griglia");
      router.replace(`${url.pathname}${url.search}` as Route);
    }
  }, [router, vista]);
  return null;
}

const LIST_ICON = "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01";
const GRID_ICON = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";
const SORT_ICON = "M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5";
const X = "M6 6l12 12M18 6 6 18";

/**
 * List toolbar: segments and view switch on top; search, filters and sort below; active filters as removable chips.
 * Every control writes the URL, so refresh, back/forward and saved views restore the same list.
 */
/** Closes open menus (filters, saved views, stage, bulk) on an outside click or Escape. */
export function PopDismiss() {
  useEffect(() => {
    const close = (keep?: Element | null) => {
      for (const d of document.querySelectorAll<HTMLDetailsElement>(".rb details.rb-pop[open], .rb details.rb-stage-menu[open]")) if (!keep || !d.contains(keep)) d.removeAttribute("open");
    };
    const onDown = (e: PointerEvent) => close(e.target as Element | null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const open = document.querySelector<HTMLDetailsElement>(".rb details.rb-pop[open], .rb details.rb-stage-menu[open]");
      if (!open) return;
      close();
      open.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);
  return null;
}

export function RubricaToolbar({ query, counts, views, founder, cities, regions, countries, types, owners }: {
  query: RubricaQuery; counts: Record<RubricaSegment, number>; views: SavedView[]; founder: boolean;
  cities: string[]; regions: string[]; countries: string[]; types: string[]; owners: { id: string; name: string }[];
}) {
  const seg = (s: RubricaSegment) => `${RUBRICA}${rubricaSearch(query, { seg: s, p: 1, resp: s === "liberi" ? "" : query.resp })}`;
  const listHref = `${RUBRICA}${rubricaSearch(query, { vista: "lista", p: 1 })}`;
  const gridHref = `${RUBRICA}${rubricaSearch(query, { vista: "griglia", p: 1 })}`;
  // Uncontrolled selects must follow the URL when a stage tile or a chip changes it; typing in the search does not remount.
  const formKey = rubricaSearch(query, { q: "", p: 1, c: "", tab: "dettagli" });
  return (
    <div className="rb-toolbar">
      <PopDismiss />
      <div className="rb-toolbar-top">
        <nav className="rb-segs" aria-label="Segmenti">
          {(Object.keys(SEGMENT_LABEL) as RubricaSegment[]).map((s) => (
            <Link key={s} href={seg(s) as Route} scroll={false} aria-current={query.seg === s ? "page" : undefined}>
              {SEGMENT_LABEL[s]}<span>{counts[s].toLocaleString("it-IT")}</span>
            </Link>
          ))}
        </nav>
        <div className="rb-toolbar-end">
          <SavedViews query={query} views={views} founder={founder} />
          <div className="rb-viewswitch" role="group" aria-label="Vista">
            <Link href={listHref as Route} aria-current={query.vista === "lista" ? "page" : undefined} scroll={false} aria-label="Vista lista" title="Lista"><CrmIcon d={LIST_ICON} /></Link>
            <Link href={gridHref as Route} aria-current={query.vista === "griglia" ? "page" : undefined} scroll={false} aria-label="Vista griglia" title="Griglia"><CrmIcon d={GRID_ICON} /></Link>
          </div>
        </div>
      </div>
      <Filters key={formKey} query={query} cities={cities} regions={regions} countries={countries} types={types} owners={owners} />
      <Chips query={query} owners={owners} />
    </div>
  );
}

function Filters({ query, cities, regions, countries, types, owners }: { query: RubricaQuery; cities: string[]; regions: string[]; countries: string[]; types: string[]; owners: { id: string; name: string }[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const queued = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "f") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, dialog, [contenteditable='true']")) return;
      if (!search.current) return;
      e.preventDefault();
      search.current.focus();
      search.current.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => () => { if (queued.current) window.clearTimeout(queued.current); }, []);
  const go = (e?: FormEvent) => {
    e?.preventDefault();
    if (!form.current) return;
    const out = new URLSearchParams();
    for (const [k, v] of new FormData(form.current)) if (typeof v === "string" && v.trim()) out.set(k, v.trim());
    const s = out.toString();
    router.push(`${RUBRICA}${s ? `?${s}` : ""}` as Route, { scroll: false });
  };
  const queueSearch = () => {
    if (queued.current) window.clearTimeout(queued.current);
    queued.current = window.setTimeout(() => go(), 200);
  };
  const extra = [query.fase, query.citta, query.regione, query.stato, query.categoria, query.fonte, query.resp, query.archivio ? "1" : ""].filter(Boolean).length;
  return (
    <form ref={form} className="rb-filters" role="search" aria-label="Cerca e filtra la rubrica" action={RUBRICA} onSubmit={go}>
      {query.seg !== "tutti" ? <input type="hidden" name="seg" value={query.seg} /> : null}
      {query.vista !== "lista" ? <input type="hidden" name="vista" value={query.vista} /> : null}
      {query.ordina !== "aggiornato" || query.dir !== "desc" ? <><input type="hidden" name="ordina" value={query.ordina} /><input type="hidden" name="dir" value={query.dir} /></> : null}
      {query.c ? <input type="hidden" name="c" value={query.c} /> : null}
      <label className="rb-search">
        <CrmIcon d={SEARCH} />
        <span className="adm-sr">Cerca</span>
        <input ref={search} name="q" data-rubrica-search defaultValue={query.q} placeholder="Cerca nome, email, telefono, sito, città, regione, paese" aria-keyshortcuts="Meta+F Control+F" onInput={queueSearch} autoComplete="off" />
        <kbd aria-hidden="true">⌘F</kbd>
        <button className="adm-sr" type="submit">Cerca</button>
      </label>
      <details className="rb-pop rb-filter-pop">
        <summary className="rb-btn" data-on={extra ? "" : undefined}><CrmIcon d={FUNNEL} /><span>Filtri</span>{extra ? <span className="rb-badge">{extra}</span> : null}</summary>
        <div className="rb-pop-panel">
          <p className="rb-pop-title">Filtra i contatti</p>
          <div className="rb-pop-grid">
            <label className="rb-field"><span>Fase</span>
              <select name="fase" defaultValue={query.fase} onChange={() => go()}><option value="">Tutte</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            </label>
            <label className="rb-field"><span>Città</span>
              <select name="citta" defaultValue={query.citta} onChange={() => go()}><option value="">Tutte</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="rb-field"><span>Regione</span>
              <select name="regione" defaultValue={query.regione} onChange={() => go()}><option value="">Tutte</option>{regions.map((r) => <option key={r}>{r}</option>)}</select>
            </label>
            <label className="rb-field"><span>Stato / Paese</span>
              <select name="stato" defaultValue={query.stato} onChange={() => go()}><option value="">Tutti</option>{countries.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="rb-field"><span>Categoria</span>
              <select name="categoria" defaultValue={query.categoria} onChange={() => go()}><option value="">Tutte</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="rb-field"><span>Fonte</span>
              <select name="fonte" defaultValue={query.fonte} onChange={() => go()}><option value="">Tutte</option>{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select>
            </label>
            <label className="rb-field rb-span"><span>Responsabile</span>
              <select name="resp" defaultValue={query.resp} onChange={() => go()}>
                <option value="">Tutti</option><option value="me">Le mie</option><option value="none">Non assegnati</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          </div>
          <label className="rb-switch"><input type="checkbox" name="archivio" value="1" defaultChecked={query.archivio} onChange={() => go()} /><span aria-hidden="true" />Mostra gli archiviati</label>
        </div>
      </details>
      <label className="rb-btn rb-sort">
        <CrmIcon d={SORT_ICON} />
        <span className="adm-sr">Ordina per</span>
        <select value={`${query.ordina}:${query.dir}`} onChange={(e) => {
          const [ordina, dir] = e.target.value.split(":");
          router.push(`${RUBRICA}${rubricaSearch(query, { ordina: ordina as RubricaSort, dir: dir === "asc" ? "asc" : "desc", p: 1 })}` as Route, { scroll: false });
        }}>
          {RUBRICA_SORTS.map((s) => {
            const dir = s === "nome" || s === "citta" || s === "azione" ? "asc" : "desc";
            const cur = query.ordina === s && query.dir !== dir ? query.dir : dir;
            return <option key={s} value={`${s}:${cur}`}>{SORT_LABEL[s]}</option>;
          })}
        </select>
      </label>
    </form>
  );
}

/** Active filters as chips; × removes one. */
function Chips({ query, owners }: { query: RubricaQuery; owners: { id: string; name: string }[] }) {
  const drop = (patch: Partial<RubricaQuery>) => `${RUBRICA}${rubricaSearch(query, { ...patch, p: 1 })}`;
  const resp = query.resp === "me" ? "Le mie" : query.resp === "none" ? "Non assegnati" : owners.find((o) => o.id === query.resp)?.name ?? "Responsabile";
  const chips: { key: string; label: string; value: string; href: string; stage?: string }[] = [
    ...(query.q ? [{ key: "q", label: "Cerca", value: `“${query.q}”`, href: drop({ q: "" }) }] : []),
    ...(query.fase && (STAGES as readonly string[]).includes(query.fase) ? [{ key: "fase", label: "Fase", value: STAGE_LABEL[query.fase as Stage], href: drop({ fase: "" }), stage: query.fase }] : []),
    ...(query.citta ? [{ key: "citta", label: "Città", value: query.citta, href: drop({ citta: "" }) }] : []),
    ...(query.regione ? [{ key: "regione", label: "Regione", value: query.regione, href: drop({ regione: "" }) }] : []),
    ...(query.stato ? [{ key: "stato", label: "Stato / Paese", value: query.stato, href: drop({ stato: "" }) }] : []),
    ...(query.categoria ? [{ key: "categoria", label: "Categoria", value: query.categoria, href: drop({ categoria: "" }) }] : []),
    ...(query.fonte ? [{ key: "fonte", label: "Fonte", value: SOURCE_LABEL[query.fonte as keyof typeof SOURCE_LABEL] ?? query.fonte, href: drop({ fonte: "" }) }] : []),
    ...(query.resp ? [{ key: "resp", label: "Responsabile", value: resp, href: drop({ resp: "" }) }] : []),
    ...(query.archivio ? [{ key: "archivio", label: "Mostra", value: "Archiviati", href: drop({ archivio: false }) }] : []),
  ];
  if (!chips.length) return null;
  return (
    <div className="rb-chips" aria-label="Filtri attivi">
      {chips.map((c) => (
        <Link key={c.key} className="rb-chip" href={c.href as Route} scroll={false} data-stage={c.stage} aria-label={`Togli il filtro ${c.label}: ${c.value}`}>
          {c.stage ? <i aria-hidden="true" /> : null}<span>{c.label}</span><b>{c.value}</b><CrmIcon d={X} />
        </Link>
      ))}
      {chips.length > 1 ? <Link className="rb-chip-clear" href={`${RUBRICA}${rubricaSearch(query, { q: "", fase: "", citta: "", categoria: "", fonte: "", resp: "", archivio: false, p: 1 })}` as Route} scroll={false}>Azzera tutto</Link> : null}
    </div>
  );
}

function SavedViews({ query, views, founder }: { query: RubricaQuery; views: SavedView[]; founder: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const current = rubricaSearch(query, { c: "", tab: "dettagli", p: 1 }).replace(/^\?/, "");
  const save = () => {
    setError("");
    start(async () => {
      const result = await createViewAction(name, current, shared);
      if ("error" in result) { setError(result.error); return; }
      setName(""); setShared(false); setOpen(false); router.refresh();
    });
  };
  return (
    <details className="rb-pop rb-saved" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="rb-btn rb-btn-quiet"><CrmIcon d={BOOKMARK} /><span>Viste salvate</span>{views.length ? <span className="rb-badge rb-badge-quiet">{views.length}</span> : null}</summary>
      <div className="rb-pop-panel rb-pop-right">
        <p className="rb-pop-title">Viste salvate</p>
        {views.length ? (
          <ul className="rb-views">
            {views.map((view) => (
              <li key={view.id}>
                <Link href={`${RUBRICA}${view.params ? `?${view.params}` : ""}` as Route}>{view.name}</Link>
                {view.shared ? <span className="rb-tag">Team</span> : null}
                {view.mine || (founder && view.shared) ? (
                  <span className="rb-views-act">
                    <button type="button" disabled={pending} onClick={() => {
                      const next = window.prompt("Nuovo nome", view.name);
                      if (!next || next === view.name) return;
                      start(async () => { const result = await renameViewAction(view.id, next); if ("error" in result) setError(result.error); else router.refresh(); });
                    }}>Rinomina</button>
                    <button type="button" disabled={pending} onClick={() => {
                      start(async () => { const result = await deleteViewAction(view.id); if ("error" in result) setError(result.error); else router.refresh(); });
                    }}>Elimina</button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p className="rb-pop-empty">Nessuna vista salvata. Imposta filtri e ordine, poi salvali qui.</p>}
        <div className="rb-pop-sep" />
        <label className="rb-field"><span>Salva i filtri attuali come</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Langhe da chiamare" />
        </label>
        {founder ? <label className="rb-switch"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /><span aria-hidden="true" />Condividi col team</label> : null}
        {error ? <p className="adm-error" role="alert">{error}</p> : null}
        <button type="button" className="rb-cta rb-cta-sm" disabled={pending || !open || !name.trim()} onClick={save}>{pending ? "Salvo…" : "Salva vista"}</button>
      </div>
    </details>
  );
}
