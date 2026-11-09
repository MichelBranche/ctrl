"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createViewAction, deleteViewAction, renameViewAction } from "@/app/admin/crm-view-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { SOURCES, SOURCE_LABEL, STAGES, STAGE_LABEL } from "@/lib/crm-core";
import { RUBRICA, RUBRICA_SORTS, rubricaSearch, type RubricaQuery, type RubricaSegment, type RubricaSort } from "@/lib/crm-nav";

type SavedView = { id: string; name: string; params: string; shared: boolean; mine: boolean };

const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";
const FUNNEL = "M3 4h18l-7 8.5V19l-4 2v-8.5z";
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

export function RubricaSegments({ query, counts, views, founder }: {
  query: RubricaQuery; counts: Record<RubricaSegment, number>; views: SavedView[]; founder: boolean;
}) {
  const href = (seg: RubricaSegment) => `${RUBRICA}${rubricaSearch(query, { seg, p: 1, resp: seg === "liberi" ? "" : query.resp })}`;
  return (
    <div className="crm-rubrica-segments">
      <nav aria-label="Segmenti">
        {(Object.keys(SEGMENT_LABEL) as RubricaSegment[]).map((seg) => (
          <Link key={seg} href={href(seg) as Route} aria-current={query.seg === seg ? "page" : undefined}>
            {SEGMENT_LABEL[seg]} <span>{counts[seg]}</span>
          </Link>
        ))}
      </nav>
      <SavedViews query={query} views={views} founder={founder} />
    </div>
  );
}

export function RubricaTools({ query, cities, types, owners }: {
  query: RubricaQuery; cities: string[]; types: string[]; owners: { id: string; name: string }[];
}) {
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
  const extra = [query.categoria, query.fonte, query.resp, query.archivio ? "1" : ""].filter(Boolean).length;
  const listHref = `${RUBRICA}${rubricaSearch(query, { vista: "lista", p: 1 })}`;
  const gridHref = `${RUBRICA}${rubricaSearch(query, { vista: "griglia", p: 1 })}`;
  return (
    <form ref={form} className="crm-rubrica-tools" role="search" aria-label="Cerca e filtra la rubrica" action={RUBRICA} onSubmit={go}>
      {query.seg !== "tutti" ? <input type="hidden" name="seg" value={query.seg} /> : null}
      {query.vista !== "lista" ? <input type="hidden" name="vista" value={query.vista} /> : null}
      {query.ordina !== "aggiornato" || query.dir !== "desc" ? <><input type="hidden" name="ordina" value={query.ordina} /><input type="hidden" name="dir" value={query.dir} /></> : null}
      {query.c ? <input type="hidden" name="c" value={query.c} /> : null}
      <label className="crm-search">
        <CrmIcon d={SEARCH} />
        <input ref={search} className="adm-input" name="q" data-rubrica-search defaultValue={query.q} placeholder="Cerca nome, email, telefono, sito…" aria-keyshortcuts="Meta+F Control+F" onInput={queueSearch} />
        <button className="adm-sr" type="submit">Cerca</button>
      </label>
      <details className="crm-menu">
        <summary className="adm-btn adm-btn-sm"><CrmIcon d={FUNNEL} />Filtri{extra ? <span className="crm-filter-n">{extra}</span> : null}</summary>
        <div className="crm-menu-list crm-menu-form">
          <label className="adm-field"><span>Categoria</span>
            <select className="adm-input" name="categoria" defaultValue={query.categoria} onChange={() => go()}><option value="">Tutte</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="adm-field"><span>Fonte</span>
            <select className="adm-input" name="fonte" defaultValue={query.fonte} onChange={() => go()}><option value="">Tutte</option>{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select>
          </label>
          <label className="adm-field"><span>Responsabile</span>
            <select className="adm-input" name="resp" defaultValue={query.resp} onChange={() => go()}>
              <option value="">Tutti</option><option value="me">Le mie</option><option value="none">Non assegnati</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="crm-check"><input type="checkbox" name="archivio" value="1" defaultChecked={query.archivio} onChange={() => go()} />Archiviati</label>
        </div>
      </details>
      <label className="adm-sr" htmlFor="crm-fase">Fase</label>
      <select id="crm-fase" className="adm-input" name="fase" defaultValue={query.fase} onChange={() => go()}>
        <option value="">Tutte le fasi</option>
        {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
      </select>
      <label className="adm-sr" htmlFor="crm-citta">Città</label>
      <select id="crm-citta" className="adm-input" name="citta" defaultValue={query.citta} onChange={() => go()}>
        <option value="">Tutte le città</option>
        {cities.map((c) => <option key={c}>{c}</option>)}
      </select>
      <label className="adm-sr" htmlFor="crm-ordina">Ordine</label>
      <select id="crm-ordina" className="adm-input crm-rubrica-sort" value={`${query.ordina}:${query.dir}`} onChange={(e) => {
        const [ordina, dir] = e.target.value.split(":");
        router.push(`${RUBRICA}${rubricaSearch(query, { ordina: ordina as RubricaSort, dir: dir === "asc" ? "asc" : "desc", p: 1 })}` as Route, { scroll: false });
      }}>
        {RUBRICA_SORTS.map((s) => <option key={s} value={`${s}:${s === "nome" || s === "citta" || s === "azione" ? "asc" : "desc"}`}>{SORT_LABEL[s]}</option>)}
      </select>
      <div className="crm-view-toggle" role="group" aria-label="Vista">
        <Link href={listHref as Route} aria-current={query.vista === "lista" ? "page" : undefined} scroll={false}>Lista</Link>
        <Link href={gridHref as Route} aria-current={query.vista === "griglia" ? "page" : undefined} scroll={false}>Griglia</Link>
      </div>
    </form>
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
    <details className="crm-menu crm-saved" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Viste salvate</summary>
      <div className="crm-menu-list">
        {views.length ? views.map((view) => (
          <div key={view.id} className="crm-saved-row">
            <Link href={`${RUBRICA}${view.params ? `?${view.params}` : ""}` as Route}>{view.name}</Link>
            {view.shared ? <span className="adm-muted">Team</span> : null}
            {view.mine || (founder && view.shared) ? (
              <>
                <button type="button" className="crm-textbtn" disabled={pending} onClick={() => {
                  const next = window.prompt("Nuovo nome", view.name);
                  if (!next || next === view.name) return;
                  start(async () => { const result = await renameViewAction(view.id, next); if ("error" in result) setError(result.error); else router.refresh(); });
                }}>Rinomina</button>
                <button type="button" className="crm-textbtn" disabled={pending} onClick={() => {
                  start(async () => { const result = await deleteViewAction(view.id); if ("error" in result) setError(result.error); else router.refresh(); });
                }}>Elimina</button>
              </>
            ) : null}
          </div>
        )) : <p className="adm-muted">Nessuna vista salvata.</p>}
        <label className="adm-field"><span>Nome</span>
          <input className="adm-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Langhe da chiamare" />
        </label>
        {founder ? <label className="crm-check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />Condividi col team</label> : null}
        {error ? <p className="adm-error" role="alert">{error}</p> : null}
        <button type="button" className="adm-btn adm-btn-sm adm-btn-primary" disabled={pending || !open} onClick={save}>{pending ? "Salvo…" : "Salva questa vista"}</button>
      </div>
    </details>
  );
}
