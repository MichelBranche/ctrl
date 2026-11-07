import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CopyButton, FollowUpQuick, OwnerQuick, PanelShell, StageQuick } from "@/components/admin/crm/contact-panel-client";
import { DealControls } from "@/components/admin/crm/deal-controls";
import { CrmIcon, day, eur, initials, MapsLink, meetHref, ScoreBadge, siteHref, telHref } from "@/components/admin/crm/crm-ui";
import { NoteForm } from "@/components/admin/crm/note-form";
import type { AdminUser } from "@/lib/admin";
import { AUDIT_LABEL } from "@/lib/audit";
import { listActivities, type Activity } from "@/lib/crm-activity";
import { contactHistory, crmOwners, getContact, listNotes, type Contact, type CrmEvent } from "@/lib/crm";
import { isStage, SOURCE_LABEL, STAGE_LABEL, type DealPriority, type Stage, websiteDomain } from "@/lib/crm-core";
import { ATTIVITA, contactEmailPath, CRM_HOME, PANEL_TABS, type PanelTab } from "@/lib/crm-nav";
import { canAccess, isFounder } from "@/lib/team-types";

const TAB_LABEL: Record<PanelTab, string> = { dettagli: "Dettagli", note: "Note", attivita: "Attività", cronologia: "Cronologia" };
const I = {
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  user: "M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  ext: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  close: "M6 6l12 12M18 6L6 18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};
const when = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** `email`: the contact email view with this list as its "back" (list, and the composer already open). */
export type PanelLinks = { close: string; tabs: Record<PanelTab, string>; email?: { list: string; compose: string } };
/** Extra first tab a list can mount (Radar: the Iris analysis), rendered by that list. */
export type PanelAnalysis = { href: string; render: (c: Contact) => ReactNode | Promise<ReactNode> };
/** The open deal, when the panel is mounted from the pipeline. Its phase is not the contact's stage. */
export type PanelDeal = {
  id: string; version: number; stage: Stage; title: string; valueEur: number | null;
  ownerUserId: string | null; priority: DealPriority | null; former: string | null;
};

/**
 * Contact side panel, shared by the CRM lists (Rubrica today; Pipeline and Radar can mount it with their own links).
 * Server-rendered from the URL, so the list behind it keeps its filters, sort and page.
 */
export async function ContactPanel({ id, tab: asked, me, links, analysis, deal }: {
  id: string; tab: PanelTab | "analisi"; me: AdminUser; links: PanelLinks; analysis?: PanelAnalysis; deal?: PanelDeal;
}) {
  const tab = asked === "analisi" && !analysis ? "dettagli" : asked;
  const labelId = `crm-panel-${id}`;
  const c = await getContact(id);
  if (!c) {
    return (
      <PanelShell contactId={id} closeHref={links.close} labelId={labelId}>
        <header className="crm-panel-head">
          <h2 id={labelId} className="adm-h2" tabIndex={-1}>Contatto non trovato</h2>
          <Link className="crm-icon-btn crm-panel-close" href={links.close as Route} scroll={false} aria-label="Chiudi scheda"><CrmIcon d={I.close} /></Link>
        </header>
        <p className="adm-muted">Forse è stato eliminato. Chiudi il pannello per tornare all&apos;elenco.</p>
      </PanelShell>
    );
  }
  const mail = canAccess(me, "email"), meetings = canAccess(me, "meetings");
  const founder = isFounder(me);
  const [owners, notes, history, activities] = await Promise.all([
    crmOwners(),
    tab === "note" ? listNotes(id) : Promise.resolve([]),
    tab === "cronologia" ? contactHistory(id) : Promise.resolve([]),
    tab === "attivita" ? listActivities({ contactId: id, stato: "tutte", scope: founder ? "team" : "mine" }, { id: me.id, founder }) : Promise.resolve([] as Activity[]),
  ]);
  const site = siteHref(c.website), tel = telHref(c.phone), mailSearch = c.email ? null : websiteDomain(c.website);
  const mailView = links.email ?? { list: contactEmailPath(c.id), compose: `${contactEmailPath(c.id)}?compose=new` };
  const place = [c.address, c.city, c.region].filter(Boolean).join(", ");
  const versioned = { id: c.id, version: c.version };
  const extra = tab === "analisi" && analysis ? await analysis.render(c) : null;
  return (
    <PanelShell contactId={c.id} closeHref={links.close} labelId={labelId}>
      <header className="crm-panel-head">
        <span className="crm-avatar" aria-hidden="true">{initials(c.businessName)}</span>
        <div className="crm-panel-title">
          <h2 id={labelId} className="adm-h2" tabIndex={-1}>{c.businessName}</h2>
          <p className="adm-muted">{[c.type, c.city && `${c.city}${c.region ? ` (${c.region})` : ""}`].filter(Boolean).join(" · ") || SOURCE_LABEL[c.source]}</p>
        </div>
        <ScoreBadge score={c.score} />
        <Link className="crm-icon-btn crm-panel-close" href={links.close as Route} scroll={false} aria-label="Chiudi scheda"><CrmIcon d={I.close} /></Link>
      </header>

      <div className="crm-panel-actions">
        {mail ? (c.email
          ? <Link className="adm-btn adm-btn-sm adm-btn-primary" href={mailView.compose as Route}><CrmIcon d={I.mail} />Email</Link>
          : <span className="adm-btn adm-btn-sm" aria-disabled="true" title="Nessuna email registrata"><CrmIcon d={I.mail} />Email</span>) : null}
        {tel ? <a className="adm-btn adm-btn-sm" href={tel}><CrmIcon d={I.phone} />Chiama</a> : <span className="adm-btn adm-btn-sm" aria-disabled="true" title="Nessun telefono registrato"><CrmIcon d={I.phone} />Chiama</span>}
        {site ? <a className="adm-btn adm-btn-sm" href={site} target="_blank" rel="noopener noreferrer nofollow"><CrmIcon d={I.ext} />Sito</a> : <span className="adm-btn adm-btn-sm" aria-disabled="true" title="Nessun sito registrato"><CrmIcon d={I.ext} />Sito</span>}
        <details className="crm-menu">
          <summary className="adm-btn adm-btn-sm" aria-label="Altre azioni"><CrmIcon d={I.more} /></summary>
          <div className="crm-menu-list">
            <Link href={`${CRM_HOME}/${c.id}` as Route}>Apri scheda completa</Link>
            <MapsLinkItem contact={c} />
            {meetings ? <Link href={meetHref(c) as Route}>Organizza un Meet</Link> : null}
            {mail && c.email ? <Link href={mailView.list as Route}>Email collegate</Link> : null}
            {mail && mailSearch ? <Link href={`/admin/email?search=${encodeURIComponent(mailSearch)}` as Route}>Cerca il dominio in Posta</Link> : null}
          </div>
        </details>
      </div>

      <nav className="crm-panel-tabs" aria-label="Sezioni della scheda">
        {analysis ? <Link href={analysis.href as Route} scroll={false} replace aria-current={tab === "analisi" ? "page" : undefined}>Analisi Iris</Link> : null}
        {PANEL_TABS.map((t) => <Link key={t} href={links.tabs[t] as Route} scroll={false} replace aria-current={t === tab ? "page" : undefined}>{TAB_LABEL[t]}</Link>)}
      </nav>

      <div className="crm-panel-body">
        {c.archived ? <p className="crm-notice">Contatto archiviato: ripristinalo dalla scheda completa per modificarlo.</p> : null}
        {tab === "analisi" ? extra : tab === "dettagli" ? (
          <>
            {c.archived ? null : deal ? (
              <>
                <p className="crm-hint">Stato del contatto: <strong>{STAGE_LABEL[c.stage]}</strong>. La fase qui sotto è solo della trattativa «{deal.title}».</p>
                <DealControls key={`${deal.id}:${deal.version}`} deal={deal} owners={owners} former={deal.former} />
                <FollowUpQuick key={`f${c.version}`} contact={versioned} text={c.nextAction} at={c.nextActionAt} compact label="Follow-up del contatto" />
              </>
            ) : (
              <div className="crm-quick-row">
                <StageQuick key={`s${c.version}`} contact={versioned} stage={c.stage} />
                <FollowUpQuick key={`f${c.version}`} contact={versioned} text={c.nextAction} at={c.nextActionAt} compact />
              </div>
            )}
            <ul className="crm-facts">
              <li><CrmIcon d={I.mail} />{c.email ? <><a href={`mailto:${c.email}`}>{c.email}</a><CopyButton text={c.email} label="Copia email" /></> : <span className="adm-muted">—</span>}</li>
              <li><CrmIcon d={I.link} />{site ? <><a href={site} target="_blank" rel="noopener noreferrer nofollow">{c.website}</a><a className="crm-icon-btn" href={site} target="_blank" rel="noopener noreferrer nofollow" aria-label="Apri il sito in una nuova scheda"><CrmIcon d={I.ext} /></a></> : <span className="adm-muted">—</span>}</li>
              <li><CrmIcon d={I.phone} />{tel ? <a href={tel}>{c.phone}</a> : <span className="adm-muted">—</span>}</li>
              <li><CrmIcon d={I.pin} />{place ? <><span>{place}</span><MapsLink contact={c} compact /></> : <span className="adm-muted">—</span>}</li>
              <li><CrmIcon d={I.tag} /><span className="crm-tags">{c.type ? <span className="crm-tag">{c.type}</span> : null}<span className="crm-tag">{SOURCE_LABEL[c.source]}</span>{!deal && c.valueEur !== null ? <span className="crm-tag">{eur(c.valueEur)}</span> : null}</span></li>
              {c.contactName ? <li><CrmIcon d={I.user} /><span>Referente: {c.contactName}</span></li> : null}
            </ul>
            {c.scoreReasons.length ? (
              <section className="crm-iris" aria-label={c.source === "radar" ? "Nota Iris" : "Motivi del punteggio"}>
                <h3><CrmIcon d={I.spark} />{c.source === "radar" ? "Nota Iris" : "Motivi del punteggio"}</h3>
                <ul>{c.scoreReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </section>
            ) : null}
            {c.archived || deal ? null : (
              <OwnerQuick key={`o${c.version}`} contact={versioned} ownerId={c.ownerUserId} owners={owners}
                former={c.ownerUserId && !owners.some((o) => o.id === c.ownerUserId) ? `${c.ownerName ?? "Account eliminato"} (${c.ownerActive === false ? "ex membro" : "senza accesso CRM"})` : null} />
            )}
            {c.ownerUserId && c.ownerActive === false ? <p className="crm-hint adm-muted">Non fa più parte del team: resta responsabile finché non scegli qualcun altro.</p> : null}
          </>
        ) : tab === "note" ? (
          <>
            <NoteForm contactId={c.id} />
            <ol className="desk-list crm-timeline">
              {notes.map((n) => <li key={n.id} className="desk-item"><div className="desk-item-head"><strong>{n.author ?? "Sistema"}</strong><span className="adm-muted">{when(n.createdAt)}</span></div><p className="desk-note-body">{n.body}</p></li>)}
              {c.notes ? <li className="desk-item"><div className="desk-item-head"><strong>Note iniziali</strong></div><p className="desk-note-body">{c.notes}</p></li> : null}
            </ol>
            {!notes.length && !c.notes ? <p className="crm-empty adm-muted">Ancora nessuna nota.</p> : null}
          </>
        ) : tab === "attivita" ? (
          <>
            <p className="crm-hint adm-muted">Il follow-up resta sulla scheda. Le attività sotto sono solo quelle create nella sezione Attività{founder ? "" : ", e solo le tue"}.</p>
            <Link className="adm-btn adm-btn-sm" href={`${ATTIVITA}?nuova=1&contatto=${c.id}` as Route}>Nuova attività su questo contatto</Link>
            {activities.length ? (
              <ul className="crm-act-upcoming">
                {activities.map((a) => (
                  <li key={a.id}>
                    <Link href={`${ATTIVITA}?a=${a.id}` as Route}>{a.title}</Link>
                    <span className="adm-muted">{a.doneAt ? "Completata" : a.dueDate}{a.dueTime ? ` · ${a.dueTime}` : ""}{founder && a.assigneeName ? ` · ${a.assigneeName}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="crm-empty adm-muted">Nessuna attività collegata.</p>}
            {c.nextActionAt || c.nextAction ? <p className="crm-current">Follow-up del contatto: <strong>{c.nextAction ?? "Follow-up"}</strong>{c.nextActionAt ? ` · ${day(c.nextActionAt)}` : ""}</p> : <p className="crm-empty adm-muted">Nessun follow-up pianificato.</p>}
            {c.archived ? null : <FollowUpQuick key={`a${c.version}`} contact={versioned} text={c.nextAction} at={c.nextActionAt} />}
          </>
        ) : (
          <>
            <p className="crm-hint adm-muted">Ultimi 12 mesi del registro attività: le voci più vecchie vengono eliminate, non è uno storico permanente.</p>
            {history.length ? <ol className="crm-history">{history.map((e) => <li key={e.id}><span>{historyLine(e)}</span><span className="adm-muted">{e.actor ?? "Sistema"} · {when(e.at)}</span></li>)}</ol> : <p className="crm-empty adm-muted">Nessuna voce negli ultimi 12 mesi.</p>}
            <p className="crm-foot adm-muted">Contatto creato il {when(c.createdAt)}.</p>
          </>
        )}
      </div>
    </PanelShell>
  );
}

function MapsLinkItem({ contact }: { contact: Contact }) {
  if (!contact.city && !contact.address) return null;
  return <MapsLink contact={contact} />;
}

function historyLine(e: CrmEvent) {
  const label = AUDIT_LABEL[e.action] ?? e.action;
  const { from, to } = e.details;
  if (e.action === "crm.stage" && isStage(from) && isStage(to)) return `${label}: ${STAGE_LABEL[from]} → ${STAGE_LABEL[to]}`;
  if (e.action === "crm.followup_set") return typeof e.details.at === "string" ? `${label} per il ${day(e.details.at)}` : "Follow-up rimosso";
  return e.details.bulk ? `${label} (azione multipla)` : label;
}
