import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ContactForm } from "@/components/admin/crm/contact-form";
import { CrmTabs, day, eur, MapsLink, romeToday, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { requireSection } from "@/lib/admin";
import { backfillRequests, crmOwners, crmStats, facets, listContacts } from "@/lib/crm";
import { conversionRate, isSource, isStage, SOURCES, SOURCE_LABEL, STAGES, STAGE_LABEL } from "@/lib/crm-core";

type SP = Record<string, string | string[] | undefined>;
export default function CrmPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main">
      <Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento…</p>}><Body searchParams={searchParams} /></Suspense>
    </main>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 120) : "");

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSection("crm");
  const sp = await searchParams;
  // Lazy backfill of site requests into leads: once per instance, never blocks the page on failure.
  await backfillRequests().catch(() => {});
  const q = one(sp.q), stage = one(sp.fase), type = one(sp.categoria), city = one(sp.citta), source = one(sp.fonte), archived = sp.archivio === "1";
  const [contacts, f, stats, owners] = await Promise.all([
    listContacts({ q: q || undefined, stage: isStage(stage) ? stage : undefined, type: type || undefined, city: city || undefined, source: isSource(source) ? source : undefined, archived }),
    facets(), crmStats(), crmOwners(),
  ]);
  const rate = conversionRate(stats.won, stats.lost);
  const today = romeToday();
  return (
    <>
      <header className="adm-top"><div><p className="adm-muted">Clienti e opportunità</p><h1 className="adm-h1">CRM</h1></div></header>
      <CrmTabs current="/admin/crm" />
      {sp.archiviato === "1" ? <p className="adm-ok" role="status">Contatto archiviato.</p> : null}
      <section className="adm-stats" aria-label="Numeri">
        <div className="adm-stat"><span className="adm-stat-num">{stats.leadsMonth}</span><span className="adm-muted">Lead questo mese</span></div>
        <div className="adm-stat"><span className="adm-stat-num">{rate === null ? "n.d." : `${Math.round(rate * 100)}%`}</span><span className="adm-muted">Conversione ({stats.won} vinti, {stats.lost} persi)</span></div>
        <div className="adm-stat"><span className="adm-stat-num">{eur(stats.openValue) || "0 €"}</span><span className="adm-muted">Pipeline aperta</span></div>
        <div className="adm-stat"><span className="adm-stat-num">{eur(stats.wonValue) || "0 €"}</span><span className="adm-muted">Valore vinto</span></div>
      </section>
      <section className="adm-panel">
        <div className="adm-panel-head"><h2 className="adm-h2">Rubrica</h2><span className="adm-muted">{contacts.length} contatti</span></div>
        <form className="crm-filters" method="get">
          <input className="adm-input" type="search" name="q" defaultValue={q} placeholder="Cerca nome, email, telefono, sito" aria-label="Cerca" />
          <select className="adm-input" name="fase" defaultValue={stage} aria-label="Fase"><option value="">Tutte le fasi</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
          <select className="adm-input" name="categoria" defaultValue={type} aria-label="Categoria"><option value="">Tutte le categorie</option>{f.types.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="adm-input" name="citta" defaultValue={city} aria-label="Città"><option value="">Tutte le città</option>{f.cities.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="adm-input" name="fonte" defaultValue={source} aria-label="Fonte"><option value="">Tutte le fonti</option>{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select>
          <label className="adm-chip"><input type="checkbox" name="archivio" value="1" defaultChecked={archived} /> Archiviati</label>
          <button className="adm-btn adm-btn-sm">Filtra</button>
        </form>
        {contacts.length ? (
          <div className="crm-table-wrap"><table className="adm-table">
            <thead><tr><th>Nome</th><th>Fase</th><th>Città</th><th>Fonte</th><th>Valore</th><th>Prossima azione</th><th>Punteggio</th></tr></thead>
            <tbody>{contacts.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/crm/${c.id}` as Route}>{c.businessName}</Link>{c.type ? <div className="adm-muted">{c.type}</div> : null}</td>
                <td><span className="adm-badge">{STAGE_LABEL[c.stage]}</span></td>
                <td>{c.city ?? ""}{c.city || c.address ? <MapsLink contact={c} compact /> : null}</td><td>{SOURCE_LABEL[c.source]}</td><td>{eur(c.valueEur)}</td>
                <td className={c.nextActionAt && c.nextActionAt.slice(0, 10) < today && !["vinto", "perso"].includes(c.stage) ? "adm-error" : undefined}>{c.nextAction ?? ""}{c.nextActionAt ? <div className="adm-muted">{day(c.nextActionAt)}</div> : null}</td>
                <td><ScoreBadge score={c.score} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="adm-muted">Nessun contatto con questi filtri.</p>}
      </section>
      <section className="adm-panel">
        <details><summary className="adm-h2">+ Nuovo contatto</summary><ContactForm owners={owners} /></details>
      </section>
    </>
  );
}
