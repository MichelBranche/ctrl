"use client";
import { useRef, useState, type FormEvent } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { SOURCES, SOURCE_LABEL, STAGES, STAGE_LABEL } from "@/lib/crm-core";
import { RADAR, RUBRICA, savedViewParams, savedViewsKey, type RadarPrio, type RubricaQuery } from "@/lib/crm-nav";

const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";
const FUNNEL = "M3 4h18l-7 8.5V19l-4 2v-8.5z";
const BOOKMARK = "M6 3h12v18l-6-4-6 4z";

/**
 * Search and filters as a GET form: works without JavaScript, and with it every change navigates at once (empty
 * fields dropped). The open contact and its tab stay open; the page goes back to 1.
 */
type ToolbarQuery = Omit<RubricaQuery, "tab"> & { tab: string; prio?: RadarPrio | "" };
/** Radar layout: categoria, priorità and stato inline (as in the mockup), città/responsabile/archivio under Filtri. */
type Layout = { basePath: string; defaultTab: string; defaultSort: string; radar: boolean; label: string; placeholder: string };
const RUBRICA_LAYOUT: Layout = { basePath: RUBRICA, defaultTab: "dettagli", defaultSort: "aggiornato", radar: false, label: "Cerca e filtra la rubrica", placeholder: "Cerca nome, email, telefono, sito…" };
const PRIO_LABEL: Record<RadarPrio, string> = { alta: "Alta (70+)", media: "Media (40–69)", bassa: "Bassa (sotto 40)", senza: "Senza punteggio" };

export const RADAR_LAYOUT: Layout = { basePath: RADAR, defaultTab: "analisi", defaultSort: "punteggio", radar: true, label: "Cerca e filtra i prospect del Radar", placeholder: "Cerca azienda, settore, località…" };

export function RubricaToolbar({ query, types, cities, owners, userId, layout = RUBRICA_LAYOUT }: {
  query: ToolbarQuery; types: string[]; cities: string[]; owners: { id: string; name: string }[]; userId: string; layout?: Layout;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const { basePath, radar } = layout;
  const extra = (radar ? [query.citta, query.resp, query.archivio ? "1" : ""] : [query.categoria, query.fonte, query.resp, query.archivio ? "1" : ""]).filter(Boolean).length;
  const go = (e?: FormEvent) => {
    e?.preventDefault();
    if (!form.current) return;
    const out = new URLSearchParams();
    for (const [k, v] of new FormData(form.current)) if (typeof v === "string" && v.trim()) out.set(k, v.trim());
    const s = out.toString();
    router.push(`${basePath}${s ? `?${s}` : ""}` as Route, { scroll: false });
  };
  const change = () => go();
  const key = [query.q, query.fase, query.citta, query.categoria, query.fonte, query.resp, query.archivio, query.prio].join("|");
  const categoria = <select className={`adm-input${radar ? " crm-toolbar-select" : ""}`} name="categoria" defaultValue={query.categoria} onChange={change} aria-label={radar ? "Categoria" : undefined}><option value="">{radar ? "Tutte le categorie" : "Tutte"}</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>;
  const citta = (inline: boolean) => <select className={`adm-input${inline ? " crm-toolbar-select" : ""}`} name="citta" defaultValue={query.citta} onChange={change} aria-label={inline ? "Città" : undefined}><option value="">{inline ? "Tutte le città" : "Tutte"}</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>;
  return (
    <div className="crm-toolbar">
      <form ref={form} key={key} className="crm-toolbar-form" method="get" action={basePath} onSubmit={go} role="search" aria-label={layout.label}>
        <label className="crm-search">
          <CrmIcon d={SEARCH} /><span className="adm-sr">Cerca</span>
          <input className="adm-input" type="search" name="q" defaultValue={query.q} maxLength={120} placeholder={layout.placeholder} />
        </label>
        {query.ordina !== layout.defaultSort || query.dir !== "desc" ? <><input type="hidden" name="ordina" value={query.ordina} /><input type="hidden" name="dir" value={query.dir} /></> : null}
        {query.c ? <input type="hidden" name="c" value={query.c} /> : null}
        {query.c && query.tab !== layout.defaultTab ? <input type="hidden" name="tab" value={query.tab} /> : null}
        <details className="crm-menu">
          <summary className="adm-btn adm-btn-sm crm-toolbar-btn"><CrmIcon d={FUNNEL} />Filtri{extra ? <span className="crm-count">{extra}</span> : null}</summary>
          <div className="crm-menu-list crm-menu-form">
            {radar
              ? <label className="adm-field"><span>Città</span>{citta(false)}</label>
              : <>
                <label className="adm-field"><span>Categoria</span>{categoria}</label>
                <label className="adm-field"><span>Fonte</span><select className="adm-input" name="fonte" defaultValue={query.fonte} onChange={change}><option value="">Tutte</option>{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select></label>
              </>}
            <label className="adm-field"><span>Responsabile</span>
              <select className="adm-input" name="resp" defaultValue={query.resp} onChange={change}>
                <option value="">Tutti</option><option value="me">I miei</option><option value="none">Non assegnati</option>
                {owners.filter((o) => o.id !== userId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="adm-chip"><input type="checkbox" name="archivio" value="1" defaultChecked={query.archivio} onChange={change} /> Solo archiviati</label>
          </div>
        </details>
        {radar ? (
          <>
            {categoria}
            <select className="adm-input crm-toolbar-select" name="prio" defaultValue={query.prio ?? ""} onChange={change} aria-label="Priorità (punteggio Iris)"><option value="">Tutte le priorità</option>{(Object.keys(PRIO_LABEL) as RadarPrio[]).map((p) => <option key={p} value={p}>{PRIO_LABEL[p]}</option>)}</select>
            <select className="adm-input crm-toolbar-select" name="fase" defaultValue={query.fase} onChange={change} aria-label="Stato"><option value="">Tutti gli stati</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
          </>
        ) : (
          <>
            <select className="adm-input crm-toolbar-select" name="fase" defaultValue={query.fase} onChange={change} aria-label="Fase"><option value="">Tutte le fasi</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            {citta(true)}
          </>
        )}
        <noscript><button className="adm-btn adm-btn-sm">Filtra</button></noscript>
      </form>
      {radar ? null : <SavedViews userId={userId} query={query} />}
    </div>
  );
}

type View = { name: string; params: string };
const MAX_VIEWS = 12;

function readViews(userId: string): View[] {
  try {
    const raw = JSON.parse(localStorage.getItem(savedViewsKey(userId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is View => v && typeof v.name === "string" && typeof v.params === "string").map((v) => ({ name: v.name.slice(0, 40), params: savedViewParams(v.params) })).slice(0, MAX_VIEWS) : [];
  } catch {
    return [];
  }
}

/**
 * Per-user views in this browser. Only filter and sort keys are stored (see savedViewParams): no search text, contact,
 * name or email ever reaches localStorage.
 */
function SavedViews({ userId, query }: { userId: string; query: ToolbarQuery }) {
  const router = useRouter();
  const [views, setViews] = useState<View[]>([]);
  const [name, setName] = useState("");
  const current = savedViewParams(new URLSearchParams({
    fase: query.fase, categoria: query.categoria, citta: query.citta, fonte: query.fonte, resp: query.resp,
    archivio: query.archivio ? "1" : "", ...(query.ordina !== "aggiornato" || query.dir !== "desc" ? { ordina: query.ordina, dir: query.dir } : {}),
  }).toString());
  const store = (next: View[]) => {
    setViews(next);
    try { localStorage.setItem(savedViewsKey(userId), JSON.stringify(next)); } catch { /* storage full or disabled: views stay for this page only */ }
  };
  return (
    <details className="crm-menu crm-views" onToggle={(e) => { if (e.currentTarget.open) setViews(readViews(userId)); }}>
      <summary className="adm-btn adm-btn-sm crm-toolbar-btn"><CrmIcon d={BOOKMARK} />Viste salvate</summary>
      <div className="crm-menu-list crm-menu-form">
        {views.length ? (
          <ul className="crm-view-list">
            {views.map((v, i) => (
              <li key={`${v.name}-${i}`}>
                <button type="button" className="crm-view" aria-current={v.params === current ? "true" : undefined}
                  onClick={(e) => { e.currentTarget.closest("details")?.removeAttribute("open"); router.push(`${RUBRICA}${v.params ? `?${v.params}` : ""}` as Route, { scroll: false }); }}>{v.name}</button>
                <button type="button" className="crm-icon-btn" aria-label={`Elimina la vista ${v.name}`} onClick={() => store(views.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
        ) : <p className="adm-muted crm-hint">Nessuna vista salvata in questo browser.</p>}
        <form onSubmit={(e) => { e.preventDefault(); const n = name.trim().slice(0, 40); if (!n) return; store([{ name: n, params: current }, ...views.filter((v) => v.name !== n)].slice(0, MAX_VIEWS)); setName(""); }}>
          <label className="adm-field"><span>Salva i filtri attuali</span><input className="adm-input" value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={40} placeholder="Nome vista (es. Cantine da chiamare)" /></label>
          <p className="adm-muted crm-hint">Salva fase, città, categoria, fonte, responsabile e ordinamento. La ricerca testuale non viene salvata.</p>
          <button className="adm-btn adm-btn-sm" disabled={!name.trim()}>Salva vista</button>
        </form>
      </div>
    </details>
  );
}
