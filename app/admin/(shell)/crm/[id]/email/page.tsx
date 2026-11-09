import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ContactMailDetail, ContactMailDetailSkeleton, ContactMailList, ContactMailListSkeleton, type ContactMailCtx } from "@/components/admin/crm/contact-mail";
import { CrmIcon, initials, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { requireSection } from "@/lib/admin";
import { getContact } from "@/lib/crm";
import { SOURCE_LABEL } from "@/lib/crm-core";
import { CONTACT_MAIL_VIEWS, contactEmailPath, contactMailSearch, MAIL_RETURN_LABEL, mailReturn, PANEL_TABS, parseContactMailQuery, type ContactMailQuery, type ContactMailView, type PanelTab } from "@/lib/crm-nav";
import { agencyAddress, mailProvider } from "@/lib/mail";
import { contactAddress } from "@/lib/mail/contact";
import { canAccess } from "@/lib/team-types";

/** Build-time placeholder only (an invalid id renders notFound inside Suspense); real ids render on request. */
export function generateStaticParams() {
  return [{ id: "_" }];
}

type SP = Record<string, string | string[] | undefined>;

export default function ContactEmailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  return (
    <main className="adm-main crm-main crm-mail-main">
      <Suspense fallback={<PageSkeleton />}><Body params={params} searchParams={searchParams} /></Suspense>
    </main>
  );
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Caricamento delle email del contatto">
      <div className="adm-skel" style={{ height: "3.5rem", width: "min(26rem, 80%)", borderRadius: ".6rem" }} />
      <div className="crm-mail" style={{ marginTop: "1.5rem" }}>
        <div className="crm-mail-side"><ContactMailListSkeleton /></div>
        <div className="crm-mail-detail"><ContactMailDetailSkeleton /></div>
      </div>
    </div>
  );
}

const TAB_LABEL: Record<PanelTab, string> = { dettagli: "Dettagli", note: "Note", attivita: "Attività", opportunita: "Opportunità", cronologia: "Cronologia" };
const TAB_ICON: Record<PanelTab | "email", string> = {
  dettagli: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  note: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  attivita: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9",
  opportunita: "M4 16l4-8 4 5 3-4 5 7",
  email: "M3 6h18v12H3zM3 7l9 6 9-6",
  cronologia: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
};
const VIEW_LABEL: Record<ContactMailView, string> = { tutte: "Tutte le email", ricevute: "Ricevute", inviate: "Inviate" };
const ID_RE = /^[0-9a-f-]{36}$/i;

async function Body({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!ID_RE.test(id)) notFound();
  const c = await getContact(id);
  if (!c) notFound();
  const q = parseContactMailQuery(sp);
  const back = mailReturn(c.id, q);
  const backLabel = MAIL_RETURN_LABEL[q.origin];
  const here = (patch: Partial<ContactMailQuery>) => `${contactEmailPath(c.id)}${contactMailSearch(q, patch)}`;

  const head = (
    <header className="crm-mail-top">
      <Link className="crm-icon-btn crm-mail-return" href={back as Route} aria-label={backLabel}><CrmIcon d="M15 6l-6 6 6 6" /></Link>
      <span className="crm-avatar" aria-hidden="true">{initials(c.businessName)}</span>
      <div className="crm-mail-who-head">
        <h1 className="adm-h2">{c.businessName} <ScoreBadge score={c.score} /></h1>
        <p className="adm-muted">{[c.type, c.city && `${c.city}${c.region ? ` (${c.region})` : ""}`].filter(Boolean).join(" · ") || SOURCE_LABEL[c.source]}</p>
      </div>
      <nav className="crm-mail-tabs" aria-label="Sezioni del contatto">
        {PANEL_TABS.slice(0, 3).map((t) => <Link key={t} href={mailReturn(c.id, q, t) as Route}><CrmIcon d={TAB_ICON[t]} />{TAB_LABEL[t]}</Link>)}
        <Link href={here({ m: null, k: "", compose: null, img: false }) as Route} aria-current="page"><CrmIcon d={TAB_ICON.email} />Email</Link>
        <Link href={mailReturn(c.id, q, "cronologia") as Route}><CrmIcon d={TAB_ICON.cronologia} />{TAB_LABEL.cronologia}</Link>
      </nav>
    </header>
  );

  // Both permissions: CRM (above) and Email. Without Email nothing below touches the mailbox.
  if (!canAccess(me, "email")) {
    return <>{head}<section className="crm-card-panel crm-mail-off"><p>Non hai accesso alla posta dell&apos;agenzia: chiedi al founder di abilitare la sezione Email.</p><Link className="adm-btn adm-btn-sm" href={back as Route}>← {backLabel}</Link></section></>;
  }
  const address = contactAddress(c.email);
  if (!address) {
    return <>{head}<section className="crm-card-panel crm-mail-off">
      <p>{c.email ? "L'email registrata non è un indirizzo singolo valido, quindi non posso collegare la posta." : "Questo contatto non ha un indirizzo email."}</p>
      <p className="adm-muted">Collego le email solo per indirizzo esatto: aggiungilo o correggilo nella scheda.</p>
      <Link className="adm-btn adm-btn-sm" href={`/admin/crm/${c.id}` as Route}>Apri scheda completa</Link>
    </section></>;
  }
  const from = agencyAddress();
  if (!mailProvider() || !from) {
    return <>{head}<section className="crm-card-panel crm-mail-off"><p>Casella non collegata: la posta del contatto non è disponibile.</p><Link className="adm-btn adm-btn-sm" href={back as Route}>← {backLabel}</Link></section></>;
  }
  const ctx: ContactMailCtx = { id: c.id, name: c.businessName, address, q, me, from };
  const detailKey = `${q.m ?? ""}:${q.k}:${q.compose ?? ""}:${q.img}`;
  return (
    <>
      {head}
      <div className="crm-mail" data-detail={q.m || q.compose ? "" : undefined}>
        <aside className="crm-mail-side" aria-label={`Email con ${c.businessName}`}>
          <Link className="adm-btn adm-btn-primary crm-mail-new" href={here({ compose: "new", m: null, k: "", img: false }) as Route}><CrmIcon d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />Nuova email</Link>
          <p className="crm-mail-address adm-muted">Collegate per indirizzo esatto: <strong>{address}</strong></p>
          <nav className="crm-mail-views" aria-label="Filtra le email">
            {CONTACT_MAIL_VIEWS.map((v) => <Link key={v} href={here({ vista: v }) as Route} scroll={false} replace aria-current={q.vista === v ? "page" : undefined}>{VIEW_LABEL[v]}</Link>)}
          </nav>
          <Suspense key={`${address}:${q.vista}`} fallback={<ContactMailListSkeleton />}><ContactMailList ctx={ctx} /></Suspense>
        </aside>
        <section className="crm-mail-detail" aria-label="Lettura e scrittura">
          <Suspense key={detailKey} fallback={<ContactMailDetailSkeleton />}><ContactMailDetail ctx={ctx} /></Suspense>
        </section>
      </div>
    </>
  );
}
