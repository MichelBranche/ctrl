import { isFounder } from "@/lib/team-types";
import { emailSender } from "@/lib/mail/sender";
import { rememberMailReferences } from "@/lib/desk";
import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ComposeForm, MailFrame, MailLive, MailOpening, MarkOpened, UnreadButton } from "@/components/admin/email/mail-client";
import { requireSection, type AdminUser } from "@/lib/admin";
import { isAgencyAddress, mailboxAddress, mailboxesFor, mailProvider, resolveMailbox, type MailboxId, type MailboxInfo } from "@/lib/mail";
import { assignableUsers } from "@/lib/mail/assignees";
import { collabFor } from "@/lib/mail/collab";
import { composeOutreach } from "@/lib/crm-outreach";
import { MailError, PAGE_SIZE, type MailboxView } from "@/lib/mail/provider";
import { emailDocument, sanitizeEmailHtml, textDocumentBody } from "@/lib/mail/sanitize";
import { stripSignature } from "@/lib/mail/template";
import { fmtAddr, longDate, replyDraft, who } from "@/lib/mail/reply";
import { CATEGORIES, folderLabel, isFolder, type MailCategory, type Collab, type FolderId, type MailLabel, type MailMessage, type MailSummary } from "@/lib/mail/types";

import { LabelDot, MailIcon, MailLabelCreate, MailMessageActions, MailRowCheck, MailSelection, MailSelectionBar, MailStar } from "@/components/admin/email/mailbox-ui";
import { MailCatchUp, MailPending, RememberList } from "@/components/admin/email/mail-speed";
import { labelColor } from "@/lib/mail/label-color";
import { MailBoxProvider } from "@/components/admin/email/mail-box";
import { MailboxSwitch, MailSwitchFrame, MailTabs } from "@/components/admin/email/mail-box-switch";

import { MailPeople, MailPeopleProvider, MailTeamStatus } from "@/components/admin/email/mail-people";

type SP = Record<string, string | string[] | undefined>;

export default function EmailPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main adm-mail-main">
      <Suspense fallback={<MailPending />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type Q = { box: MailboxId; search?: string; category?: MailCategory; f: FolderId; p: number; m: number | null; img: boolean; compose: "new" | "reply" | "all" | "forward" | "draft" | null; to?: string };

function href(q: Partial<Q> & { f: FolderId; box?: MailboxId }): string {
  const s = new URLSearchParams();
  if (q.box && q.box !== "hello") s.set("box", q.box);
  if (q.search) s.set("search", q.search);
  if (q.category) s.set("category", q.category);
  if (q.f !== "inbox") s.set("f", q.f);
  if (q.p && q.p > 1) s.set("p", String(q.p));
  if (q.m) s.set("m", String(q.m));
  if (q.img) s.set("img", "1");
  if (q.compose) s.set("compose", q.compose);
  const str = s.toString();
  return `/admin/email${str ? `?${str}` : ""}`;
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const TZ = "Europe/Rome";
// Request-time stamp for the "sincronizzazione" label (page is dynamic: it reads the session first).
const renderStamp = () => Date.now();
const shortDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString("it-IT", { timeZone: TZ });
  return d.toLocaleDateString("it-IT", { timeZone: TZ }) === today
    ? d.toLocaleTimeString("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", { timeZone: TZ, day: "numeric", month: "short" });
};
const size = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const num = (n: number) => n.toLocaleString("it-IT");
const CATEGORY_ICON: Record<MailCategory, string> = { primary: "primary", promotions: "promotions", social: "social", updates: "updates", forums: "forums" };

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const [me, sp] = await Promise.all([requireSection("email"), searchParams]);
  const f = one(sp.f);
  const compose = one(sp.compose);
  // A mailbox the user may not open (or that is not configured) falls back to the shared one.
  const box = resolveMailbox(me, one(sp.box)) ?? "hello";
  const q: Q = {
    box,
    search: one(sp.search)?.trim().slice(0, 300),
    category: one(sp.category) && Object.hasOwn(CATEGORIES, one(sp.category)!) ? one(sp.category) as MailCategory : undefined,
    f: isFolder(f) ? f : "inbox",
    p: Math.min(Math.max(Number.parseInt(one(sp.p) ?? "1", 10) || 1, 1), 500),
    m: /^\d{1,10}$/.test(one(sp.m) ?? "") ? Number(one(sp.m)) : null,
    img: one(sp.img) === "1",
    compose: compose === "new" || compose === "reply" || compose === "all" || compose === "forward" || compose === "draft" ? compose : null,
  };
  // Recipient prefill from a CRM contact ("Email" in the contact panel): one plain address, new message only, never sent by itself.
  const to = one(sp.a)?.trim();
  if (q.compose === "new" && to && to.length <= 200 && /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(to)) q.to = to;
  const address = mailboxAddress(box);
  const provider = mailProvider(box);

  if (!provider || !address) return <NotConnected founder={isFounder(me)} />;
  const boxes = mailboxesFor(me);

  return (
    <MailBoxProvider box={box}>
      <MailSwitchFrame box={box} boxes={boxes} navKey={href(q) + (q.to ? `&a=${q.to}` : "")}>
      {/* Detail and composer go full width without the page header, like the mockup; auto refresh stays on. */}
      {q.m || q.compose === "new" ? <div className="mail-live-hidden"><MailLive renderedAt={renderStamp()} /></div> : <Header q={q} boxes={boxes} founder={isFounder(me)} />}
      <Suspense fallback={<MailPending userId={me.id} folder={q.f} page={q.p} search={q.search ?? ""} category={q.category ?? ""} />}>
        <Mailbox me={me} q={q} address={address} boxes={boxes} />
      </Suspense>
      </MailSwitchFrame>
    </MailBoxProvider>
  );
}

async function Mailbox({ me, q, address, boxes }: { me: AdminUser; q: Q; address: string; boxes: MailboxInfo[] }) {
  const provider = mailProvider(q.box);
  if (!provider) return <MailPending userId={me.id} folder={q.f} warning="Casella non collegata." />;
  let view: MailboxView;
  try {
    view = await provider.view({ folder: q.f, page: q.p, open: q.m, search: q.search, category: q.category });
  } catch (error) {
    return <MailPending userId={me.id} folder={q.f} page={q.p} search={q.search ?? ""} category={q.category ?? ""} warning={error instanceof MailError ? error.message : "Errore durante la lettura della casella. Riprova tra poco."} />;
  }
  const keys = [...view.list.map((m) => m.key), ...(view.open ? [view.open.key] : []), ...view.thread.map((t) => t.key)];
  // Independent DB round trips: run them together.
  const [, collab, assignees] = await Promise.all([
    rememberMailReferences(view, q.box).catch(() => {}),
    collabFor(keys).catch(() => new Map<string, Collab>()),
    view.open ? assignableUsers(q.box).catch(() => []) : Promise.resolve([]),
  ]);

  const snap = { list: view.list, total: view.total, folders: view.folders, labels: view.labels ?? [] };
  const notices = <>
    <RememberList userId={me.id} folder={q.f} page={q.p} search={q.search ?? ""} category={q.category ?? ""} snap={snap} />
    <MailCatchUp freshness={view.freshness} />
    {view.warning || view.freshness === "stale" ? <p className="adm-mail-images" role="status"><span>{view.warning ?? "Lista recente. Aggiornamento in background…"}</span></p> : null}
  </>;
  const idx = q.m ? view.list.findIndex((m) => m.uid === q.m) : -1;
  const prev = idx > 0 ? view.list[idx - 1] : null;
  const next = idx >= 0 && idx < view.list.length - 1 ? view.list[idx + 1] : null;
  const back = href({ ...q, m: null, compose: null });

  // Opened message or new email: full width, like the mockup (list hidden; back arrow returns to it).
  if (view.open || q.compose === "new" || q.m) {
    return (
      <>
        {notices}
        <MailPeopleProvider initial={[...collab]}>
          <div className="mail-detail">
            {q.compose === "new" ? (
              <>
                <div className="mail-detail-toolbar">
                  <Link className="mail-back-btn" href={back as Route} aria-label="Torna alla lista" title="Torna alla lista"><MailIcon name="back" /></Link>
                </div>
                <ComposeForm key={`new:${q.to ?? ""}`} title="Nuova email" draft={{ to: q.to ?? "", cc: "", subject: "", body: "" }} reply={null} sender={emailSender(me)} from={address} mailboxes={boxes} cancelHref={back}
                  sentHref={href({ box: q.box, f: "sent" })}
                  outreach={q.to ? await composeOutreach(me, q.to, "") : null} />
              </>
            ) : view.open ? (
              <Detail q={q} msg={view.open} thread={view.thread} collab={collab} me={me} address={address} labels={view.labels ?? []} boxes={boxes} assignees={assignees}
                nav={{ back, prev: prev ? href({ ...q, m: prev.uid, compose: null }) : null, next: next ? href({ ...q, m: next.uid, compose: null }) : null }} />
            ) : (
              <>
                <div className="mail-detail-toolbar"><Link className="mail-back-btn" href={back as Route} aria-label="Torna alla lista"><MailIcon name="back" /></Link></div>
                <p className="adm-empty">Messaggio non trovato: forse è stato spostato o eliminato in Gmail.</p>
              </>
            )}
          </div>
        </MailPeopleProvider>
      </>
    );
  }

  const from = (q.p - 1) * PAGE_SIZE + 1;
  const toN = Math.min(q.p * PAGE_SIZE, view.total);
  const pages = Math.max(1, Math.ceil(view.total / PAGE_SIZE));
  const pager = (
    <nav className="mail-pager" aria-label="Pagine">
      <span>{view.total ? `${num(from)}–${num(toN)} di ${num(view.total)}` : "0 messaggi"}</span>
      {q.p > 1 ? <Link className="mail-icon-btn" href={href({ ...q, p: q.p - 1, m: null, compose: null }) as Route} aria-label="Più recenti"><MailIcon name="prev" size={16} /></Link> : <span className="mail-icon-btn" aria-disabled="true"><MailIcon name="prev" size={16} /></span>}
      {q.p < pages ? <Link className="mail-icon-btn" href={href({ ...q, p: q.p + 1, m: null, compose: null }) as Route} aria-label="Meno recenti"><MailIcon name="next" size={16} /></Link> : <span className="mail-icon-btn" aria-disabled="true"><MailIcon name="next" size={16} /></span>}
    </nav>
  );
  return (
    <>
      {notices}
      <MailPeopleProvider initial={[...collab]}>
      <div className="mail-workspace">
        <aside className="mail-sidebar" aria-label="Navigazione email">
          <Link className="mail-compose-button" href={href({ box: q.box, f: q.f, compose: "new" }) as Route}><MailIcon name="write" />Scrivi</Link>
          <nav aria-label="Cartelle email">
            {(["inbox", "starred", "sent", "drafts", "all", "trash", "spam"] as const).map((id) => {
              const count = view.folders.find((folder) => folder.id === id);
              const n = id === "drafts" ? count?.total : id === "inbox" ? count?.unread : 0;
              return <Link key={id} className="mail-folder" aria-current={q.f === id && !q.search ? "page" : undefined} href={href({ box: q.box, f: id }) as Route}>
                <MailIcon name={id === "starred" ? "star" : id} size={17} /><span>{folderLabel(id)}<MailOpening label="Caricamento…" /></span>{n ? <b data-strong={id === "inbox" || undefined}>{num(n)}</b> : null}
              </Link>;
            })}
          </nav>
          <div className="mail-sidebar-heading"><span>Etichette</span><MailLabelCreate /></div>
          <nav aria-label="Etichette Gmail">
            {(view.labels ?? []).map((label) => <Link key={label.id} className="mail-folder" aria-current={q.f === label.id ? "page" : undefined} href={href({ box: q.box, f: label.id }) as Route}><LabelDot name={label.name} /><span>{label.name}<MailOpening label="Caricamento…" /></span>{label.unread ? <b>{label.unread}</b> : null}</Link>)}
            {!view.labels?.length ? <p className="mail-label-empty">Le tue etichette Gmail appariranno qui.</p> : null}
          </nav>
        </aside>
        <div className="mail-main-col">
          <form className="mail-search-row" action="/admin/email" role="search">
            <div className="mail-search">
              <MailIcon name="search" size={17} />
              {q.box !== "hello" ? <input type="hidden" name="box" value={q.box} /> : null}
              <input type="hidden" name="f" value={q.f} />
              <input aria-label="Cerca nella posta" type="search" name="search" defaultValue={q.search} key={q.search ?? ""} placeholder="Cerca nella posta (mittente, oggetto, contenuto…)" maxLength={300} />
              {q.search ? <Link className="adm-link" href={href({ box: q.box, f: q.f }) as Route}>Cancella</Link> : null}
            </div>
            <details className="mail-menu mail-filter" data-align="right">
              <summary className="mail-square-btn" aria-label="Filtri di ricerca" title="Filtri"><MailIcon name="filter" size={17} /></summary>
              <div className="mail-menu-pop">
                <strong className="mail-menu-title">Filtri rapidi</strong>
                {[["Non lette", "is:unread"], ["Con allegati", "has:attachment"], ["Speciali", "is:starred"], ["Ultimi 7 giorni", "newer_than:7d"], ["Più grandi di 5 MB", "larger:5M"]].map(([label, rule]) => (
                  <Link key={rule} className="mail-menu-item" href={href({ box: q.box, f: q.f, search: q.search ? `${q.search} ${rule}` : rule }) as Route}>{label}<code>{rule}</code></Link>
                ))}
                <p className="adm-muted">Puoi scrivere anche from:, to:, subject: nella ricerca.</p>
              </div>
            </details>
          </form>
          <div className="mail-content">
            {q.f === "inbox" && !q.search ? <MailTabs>
              <Link aria-current={!q.category ? "page" : undefined} href={href({ box: q.box, f: "inbox" }) as Route}><MailIcon name="everything" size={16} />Tutte</Link>
              {Object.entries(CATEGORIES).map(([id, name]) => <Link key={id} aria-current={q.category === id ? "page" : undefined} href={href({ box: q.box, f: "inbox", category: id as MailCategory }) as Route}><MailIcon name={CATEGORY_ICON[id as MailCategory]} size={16} />{name}</Link>)}
            </MailTabs> : <div className="mail-view-title"><strong>{folderLabel(q.f)}</strong>{q.search ? <span>Risultati per “{q.search}”</span> : null}</div>}
            <MailSelection key={`${q.f}:${q.search}:${q.category}:${q.p}:${view.list.map((m) => m.uid).join(",")}`} folder={q.f} uids={view.list.map((message) => message.uid)} rows={view.list.map((m) => ({ uid: m.uid, seen: m.seen, starred: Boolean(m.starred) }))} labels={view.labels ?? []}>
              <MailSelectionBar pager={pager} />
              <section className="mail-list" aria-label={`Messaggi: ${folderLabel(q.f)}`}>
                <MailList q={q} list={view.list} collab={collab} me={me} />
              </section>
            </MailSelection>
          </div>
        </div>
      </div>
      </MailPeopleProvider>
    </>
  );
}

function Header({ q, boxes, founder }: { q: Q; boxes: MailboxInfo[]; founder: boolean }) {
  const current = boxes.find((b) => b.id === q.box) ?? boxes[0];
  return (
    <header className="mail-head">
      <div className="mail-head-title">
        <h1 className="adm-h1">Posta</h1>
        <div className="mail-head-sub">
          <span className="mail-head-desc">{current?.description}</span>
          {boxes.length > 1 ? (
            <MailboxSwitch box={q.box} boxes={boxes} hrefs={Object.fromEntries(boxes.map((b) => [b.id, href({ box: b.id, f: "inbox" })]))} />
          ) : <span className="mail-head-address">{current?.address}</span>}
          <span className="mail-sync-pill"><span aria-hidden="true" />Sincronizzata</span>
        </div>
      </div>
      <MailLive renderedAt={renderStamp()}>
        <details className="mail-menu" data-align="right">
          <summary className="mail-icon-btn" aria-label="Impostazioni della casella" title="Impostazioni"><MailIcon name="settings" size={16} /></summary>
          <div className="mail-menu-pop mail-settings">
            <strong className="mail-menu-title">{current?.label}</strong>
            <p>{current?.address}</p>
            <p className="adm-muted">Sincronizzata con Gmail. La lista si aggiorna da sola ogni 30 secondi mentre la pagina è aperta.</p>
            {q.box === "admin" ? <p className="adm-muted">Visibile solo ai founder. Questi messaggi non vengono usati dall’assistente AI.</p> : <p className="adm-muted">Condivisa con chi ha il permesso Email.</p>}
            {founder ? <Link className="mail-menu-item" href={"/admin/team" as Route}>Gestisci i permessi del team</Link> : null}
          </div>
        </details>
      </MailLive>
    </header>
  );
}

function NotConnected({ founder }: { founder: boolean }) {
  return (
    <>
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Email</h1>
          <p className="adm-muted">Casella condivisa dell&apos;agenzia</p>
        </div>
      </header>
      <section className="adm-panel adm-mail-off adm-rise">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 6 9-6M4 20 20 4" /></svg>
        <h2 className="adm-h2">Casella non collegata</h2>
        {founder ? (
          <p className="adm-muted">
            Per collegare la casella Gmail dell&apos;agenzia imposta su Vercel le variabili <code>AGENCY_IMAP_USER</code> (l&apos;indirizzo Gmail) e{" "}
            <code>AGENCY_IMAP_PASSWORD</code> (una password per le app di Google, con la verifica in due passaggi attiva), poi ripubblica il sito.
          </p>
        ) : (
          <p className="adm-muted">La casella email dell&apos;agenzia non è ancora collegata. Chiedi al founder di configurarla.</p>
        )}
      </section>
    </>
  );
}

function MailList({ q, list, collab, me }: { q: Q; list: MailSummary[]; collab: Map<string, Collab>; me: AdminUser }) {
  if (!list.length) return <p className="adm-empty">Nessun messaggio in {folderLabel(q.f).toLowerCase()}.</p>;
  const sent = q.f === "sent" || q.f === "drafts";
  return (
    <ul className="mail-rows">
      {list.map((m) => (
        <li key={`${m.folder}:${m.uid}`} className="mail-row" data-unread={!m.seen || undefined}>
          <MailRowCheck uid={m.uid} subject={m.subject} />
          <MailStar folder={m.folder} uid={m.uid} starred={m.starred} />
          <Link href={href({ ...q, m: m.uid, compose: null }) as Route} className="mail-row-link" prefetch={false}>
            <span className="mail-row-dot" aria-label={m.seen ? undefined : "Non letta"} />
            <span className="mail-row-from">{sent ? `A: ${m.to.map(who).join(", ") || "—"}` : who(m.from)}</span>
            <span className="mail-row-subject">{m.subject || "(nessun oggetto)"}</span>
            <span className="mail-row-tags">
              <MailPeople mkey={m.key} initial={collab.get(m.key)} meId={me.id} />
              {m.labels?.slice(0, 2).map((label) => <span key={label} className="mail-tag" style={{ "--tag": labelColor(label) } as React.CSSProperties}>{label}</span>)}
            </span>
            <span className="mail-row-clip">{m.hasAttachments ? <MailIcon name="clip" size={15} /> : null}</span>
            <time dateTime={m.date}>{shortDate(m.date)}</time>
            <MailOpening />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Detail({ q, msg, thread, collab, me, address, labels, boxes, assignees, nav }: { labels: MailLabel[]; q: Q; msg: MailMessage; thread: MailSummary[]; collab: Map<string, Collab>; me: AdminUser; address: string; boxes: MailboxInfo[]; assignees: import("@/lib/mail/assignees").Assignee[]; nav: { back: string; prev: string | null; next: string | null } }) {
  const c = collab.get(msg.key);
  const boxQ = q.box !== "hello" ? `box=${q.box}&` : "";
  const att = (i: number) => `/admin/email/attachment?${boxQ}f=${encodeURIComponent(msg.folder)}&m=${msg.uid}&i=${i}`;
  const composeDraft = q.compose === "draft" ? { to: msg.to.map(fmtAddr).join(", "), cc: msg.cc.map(fmtAddr).join(", "), subject: msg.subject, body: stripSignature(msg.text) }
    : q.compose === "forward" ? { to: "", cc: "", subject: /^fwd:/i.test(msg.subject) ? msg.subject : `Fwd: ${msg.subject}`, body: `\n\n---------- Messaggio inoltrato ----------\nDa: ${msg.from ? fmtAddr(msg.from) : ""}\nData: ${longDate(msg.date)}\nOggetto: ${msg.subject}\n\n${msg.text}` }
    : q.compose === "reply" || q.compose === "all" ? replyDraft(msg, q.compose === "all") : null;
  // CRM check when the composer opens with recipients (reply, reply all, saved draft); forward starts empty.
  const outreach = composeDraft && (composeDraft.to || composeDraft.cc) ? await composeOutreach(me, composeDraft.to, composeDraft.cc) : null;
  let body: React.ReactNode;
  let blocked = 0;
  if (msg.html) {
    const clean = sanitizeEmailHtml(msg.html, {
      showImages: q.img,
      cidUrl: (cid) => `/admin/email/attachment?${boxQ}f=${encodeURIComponent(msg.folder)}&m=${msg.uid}&cid=${encodeURIComponent(cid)}`,
    });
    blocked = clean.blockedImages;
    body = <MailFrame doc={emailDocument(clean.html, q.img)} title={`Contenuto: ${msg.subject}`} />;
  } else {
    body = <MailFrame doc={emailDocument(textDocumentBody(msg.text || "(messaggio vuoto)"), false)} title={`Contenuto: ${msg.subject}`} />;
  }
  const files = msg.attachments.filter((a) => !a.inline);
  const back = nav.back;
  const self = href({ box: q.box, f: q.f, p: q.p, m: msg.uid });
  const senderName = msg.from?.name || msg.from?.address || "Sconosciuto";
  const composeTitle = q.compose === "forward" ? "Inoltra" : q.compose === "draft" ? "Modifica bozza" : q.compose === "all" ? `Rispondi a tutti` : `Rispondi a ${msg.from?.name || msg.from?.address || ""}`;
  return (
    <article className="mail-message">
      <MarkOpened folder={msg.folder} uid={msg.uid} mkey={msg.key} />
      <div className="mail-detail-toolbar">
        <Link className="mail-back-btn" href={back as Route} aria-label="Torna alla lista" title="Torna alla lista"><MailIcon name="back" /></Link>
        <span className="mail-toolbar-sep" aria-hidden="true" />
        <MailMessageActions folder={msg.folder} uids={[msg.uid]} backHref={back} labels={labels} starred={msg.starred} applied={msg.labels} variant={composeDraft ? "text" : "icons"} />
        <span className="mail-status-spacer" />
        {nav.prev ? <Link className="mail-icon-btn" href={nav.prev as Route} aria-label="Messaggio precedente" title="Precedente"><MailIcon name="prev" size={16} /></Link> : <span className="mail-icon-btn" aria-disabled="true"><MailIcon name="prev" size={16} /></span>}
        {nav.next ? <Link className="mail-icon-btn" href={nav.next as Route} aria-label="Messaggio successivo" title="Successivo"><MailIcon name="next" size={16} /></Link> : <span className="mail-icon-btn" aria-disabled="true"><MailIcon name="next" size={16} /></span>}
      </div>

      <div className="mail-subject-row">
        <h2 className="mail-subject">{msg.subject || "(nessun oggetto)"}</h2>
        <span className="mail-folder-chip">{msg.folder === "inbox" ? "Posta in arrivo" : folderLabel(msg.folder)}</span>
        {msg.labels?.map((label) => <span key={label} className="mail-tag" style={{ "--tag": labelColor(label) } as React.CSSProperties}>{label}</span>)}
        <span className="mail-status-spacer" />
        <MailStar folder={msg.folder} uid={msg.uid} starred={msg.starred} />
      </div>

      <div className="mail-sender-row">
        <span className="mail-avatar" aria-hidden="true">{senderName.trim().slice(0, 1).toUpperCase()}</span>
        <div className="mail-sender-meta">
          <p><strong>{isAgencyAddress(msg.from?.address) ? `${senderName} (noi)` : msg.from?.name || msg.from?.address || "—"}</strong>{msg.from?.name ? <span className="adm-muted"> &lt;{msg.from.address}&gt;</span> : null}</p>
          <details className="mail-menu mail-recipients">
            <summary>a {msg.to.map((a) => a.address).join(", ") || "—"}{msg.cc.length ? `, cc ${msg.cc.length}` : ""}<MailIcon name="chevron" size={13} /></summary>
            <div className="mail-menu-pop">
              <dl className="adm-mail-meta">
                <dt>Da</dt><dd>{msg.from ? fmtAddr(msg.from) : "—"}</dd>
                <dt>A</dt><dd>{msg.to.map(fmtAddr).join(", ") || "—"}</dd>
                {msg.cc.length ? (<><dt>Cc</dt><dd>{msg.cc.map(fmtAddr).join(", ")}</dd></>) : null}
                <dt>Data</dt><dd><time dateTime={msg.date}>{longDate(msg.date)}</time></dd>
              </dl>
            </div>
          </details>
        </div>
        <time className="mail-sender-date" dateTime={msg.date}>{longDate(msg.date)}</time>
        <Link className="mail-icon-btn" href={href({ ...q, compose: "reply" }) as Route} aria-label="Rispondi" title="Rispondi"><MailIcon name="reply" size={16} /></Link>
        <details className="mail-menu" data-align="right">
          <summary className="mail-icon-btn" aria-label="Altre azioni sul messaggio" title="Altro"><MailIcon name="more" size={16} /></summary>
          <div className="mail-menu-pop">
            <Link className="mail-menu-item" href={href({ ...q, compose: "all" }) as Route}><MailIcon name="replyAll" size={15} />Rispondi a tutti</Link>
            <Link className="mail-menu-item" href={href({ ...q, compose: "forward" }) as Route}><MailIcon name="forward" size={15} />Inoltra</Link>
            {msg.html ? <Link className="mail-menu-item" href={(q.img ? self : href({ ...q, compose: null, img: true })) as Route}><MailIcon name="image" size={15} />{q.img ? "Nascondi immagini" : "Mostra immagini"}</Link> : null}
            {msg.folder !== "sent" ? <UnreadButton folder={msg.folder} uid={msg.uid} href={back} /> : null}
          </div>
        </details>
      </div>

      <MailTeamStatus mkey={msg.key} initial={c} meId={me.id} assignees={assignees} />

      {blocked > 0 && !q.img ? (
        <p className="adm-mail-images">
          <span>{blocked === 1 ? "1 immagine remota bloccata" : `${blocked} immagini remote bloccate`} per privacy.</span>
          <Link className="adm-link" href={href({ ...q, compose: null, img: true }) as Route}>Mostra immagini</Link>
        </p>
      ) : q.img && msg.html ? (
        <p className="adm-mail-images">
          <span>Immagini remote visibili.</span>
          <Link className="adm-link" href={self as Route}>Nascondi immagini</Link>
        </p>
      ) : null}

      <div className="mail-body-card">{body}</div>

      {files.length ? (
        <ul className="adm-mail-files" aria-label="Allegati">
          {files.map((a) => (
            <li key={a.index}>
              <a className="mail-btn mail-file" href={att(a.index)} download={a.filename}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                {a.filename}
                <span className="adm-muted">{size(a.size)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {!composeDraft ? (
        <div className="mail-reply-actions">
          {msg.folder === "drafts" ? <Link className="mail-btn mail-btn-primary" href={href({ ...q, compose: "draft" }) as Route}><MailIcon name="write" size={16} />Modifica bozza</Link> : <Link className="mail-btn mail-btn-primary" href={href({ ...q, compose: "reply" }) as Route}><MailIcon name="reply" size={16} />Rispondi</Link>}
          <Link className="mail-btn" href={href({ ...q, compose: "forward" }) as Route}><MailIcon name="forward" size={16} />Inoltra</Link>
          {msg.to.length + msg.cc.length > 1 || msg.folder !== "drafts" ? <Link className="mail-btn" href={href({ ...q, compose: "all" }) as Route}><MailIcon name="replyAll" size={16} />Rispondi a tutti</Link> : null}
        </div>
      ) : null}

      {composeDraft ? (
        <section className="mail-reply" aria-label="Risposta">
          <ComposeForm
            title={composeTitle}
            mailboxes={boxes}
            sentHref={href({ box: q.box, f: "sent" })}
            sender={emailSender(me)}
            key={`${msg.folder}:${msg.uid}:${q.compose}`}
            draft={composeDraft}
            outreach={outreach}
            reply={q.compose === "reply" || q.compose === "all" ? { folder: msg.folder, uid: msg.uid } : null}
            original={(q.compose === "draft" || q.compose === "forward") && msg.attachments.length ? { folder: msg.folder, uid: msg.uid, files: msg.attachments.length } : undefined}
            draftUid={q.compose === "draft" ? msg.uid : undefined}
            from={address} cancelHref={self}
          />
        </section>
      ) : null}

      {thread.length > 1 ? (
        <details className="adm-mail-thread mail-thread-compact" aria-label="Conversazione">
          <summary><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 4H3v12h5M8 8h13v12H8V8Z" /></svg><span>Conversazione</span><span className="mail-thread-count">{thread.length} messaggi</span><span className="mail-thread-chevron" aria-hidden="true">⌄</span></summary>
          <ol>
            {thread.map((t) => {
              const current = t.key === msg.key;
              return (
                <li key={`${t.folder}:${t.uid}`} data-current={current || undefined}>
                  <Link href={href({ box: q.box, f: "all", m: t.uid }) as Route} prefetch={false} aria-current={current ? "true" : undefined}>
                    <strong>{isAgencyAddress(t.from?.address) ? "CTRL (noi)" : who(t.from)}</strong>
                    <span className="adm-muted">{shortDate(t.date)}</span>
                    <MailOpening />
                  </Link>
                  <MailPeople mkey={t.key} initial={collab.get(t.key)} meId={me.id} />
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}
    </article>
  );
}
