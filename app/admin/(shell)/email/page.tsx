import { rememberMailReferences } from "@/lib/desk";
import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ComposeForm, MailFrame, MailLive, MailOpening, MarkOpened, UnreadButton } from "@/components/admin/email/mail-client";
import { requireSection, type AdminUser } from "@/lib/admin";
import { agencyAddress, mailProvider } from "@/lib/mail";
import { collabFor } from "@/lib/mail/collab";
import { MailError, PAGE_SIZE, type MailboxView } from "@/lib/mail/provider";
import { emailDocument, sanitizeEmailHtml } from "@/lib/mail/sanitize";
import { CATEGORIES, folderLabel, isFolder, type MailCategory, type Address, type Collab, type FolderId, type MailMessage, type MailSummary } from "@/lib/mail/types";

import { MailIcon, MailLabelCreate, MailMessageActions, MailRowCheck, MailSelection, MailSelectionBar, MailStar } from "@/components/admin/email/mailbox-ui";

import { MailPeople, MailPeopleProvider, MailTeamStatus } from "@/components/admin/email/mail-people";

import { MailSplitPane } from "@/components/admin/email/mail-split-pane";

type SP = Record<string, string | string[] | undefined>;

export default function EmailPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main adm-mail-main">
      <Suspense fallback={<MailSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function MailSkeleton() {
  return (
    <div aria-busy="true">
      <div className="adm-skel" style={{ height: "3rem", width: "40%" }} />
      <div className="adm-mail">
        <div className="adm-panel"><div className="adm-skel" style={{ height: "24rem" }} /></div>
        <div className="adm-panel"><div className="adm-skel" style={{ height: "24rem" }} /></div>
      </div>
    </div>
  );
}

type Q = { search?: string; category?: MailCategory; f: FolderId; p: number; m: number | null; img: boolean; compose: "new" | "reply" | "all" | "forward" | "draft" | null };

function href(q: Partial<Q> & { f: FolderId }): string {
  const s = new URLSearchParams();
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
// Request-time stamp for the "aggiornato" label (page is dynamic: it reads the session first).
const renderStamp = () => Date.now();
const shortDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString("it-IT", { timeZone: TZ });
  return d.toLocaleDateString("it-IT", { timeZone: TZ }) === today
    ? d.toLocaleTimeString("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", { timeZone: TZ, day: "numeric", month: "short" });
};
const longDate = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
const who = (a: Address | null | undefined) => (a ? a.name || a.address : "—");
const fmtAddr = (a: Address) => (a.name ? `${a.name} <${a.address}>` : a.address);
const size = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);


async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const [me, sp] = await Promise.all([requireSection("email"), searchParams]);
  const f = one(sp.f);
  const compose = one(sp.compose);
  const q: Q = {
    search: one(sp.search)?.trim().slice(0, 300),
    category: one(sp.category) && Object.hasOwn(CATEGORIES, one(sp.category)!) ? one(sp.category) as MailCategory : undefined,
    f: isFolder(f) ? f : "inbox",
    p: Math.min(Math.max(Number.parseInt(one(sp.p) ?? "1", 10) || 1, 1), 500),
    m: /^\d{1,10}$/.test(one(sp.m) ?? "") ? Number(one(sp.m)) : null,
    img: one(sp.img) === "1",
    compose: compose === "new" || compose === "reply" || compose === "all" || compose === "forward" || compose === "draft" ? compose : null,
  };
  const address = agencyAddress();
  const provider = mailProvider();

  if (!provider || !address) return <NotConnected founder={me.role === "founder"} />;

  let view: MailboxView;
  try {
    view = await provider.view({ folder: q.f, page: q.p, open: q.m, search: q.search, category: q.category });
  } catch (error) {
    return (
      <>
        <Header address={address} q={q} />
        <section className="adm-panel adm-mail-error">
          <h2 className="adm-h2">Casella non raggiungibile</h2>
          <p className="adm-muted">{error instanceof MailError ? error.message : "Errore durante la lettura della casella. Riprova tra poco."}</p>
          <Link className="adm-btn" href={href({ f: q.f }) as Route}>Riprova</Link>
        </section>
      </>
    );
  }
  const keys = [...view.list.map((m) => m.key), ...(view.open ? [view.open.key] : []), ...view.thread.map((t) => t.key)];
  // Independent DB round trips: run them together.
  const [, collab] = await Promise.all([
    rememberMailReferences(view).catch(() => {}),
    collabFor(keys).catch(() => new Map<string, Collab>()),
  ]);

  const detailOpen = Boolean(view.open || q.compose === "new");
  return (
    <>
      <Header address={address} q={q} />
      <MailPeopleProvider initial={[...collab]}>
      <div className="mail-workspace">
        <aside className="mail-sidebar" aria-label="Navigazione email">
          <Link className="mail-compose-button" href={href({ f: q.f, compose: "new" }) as Route}><MailIcon name="write" />Scrivi</Link>
          <nav aria-label="Cartelle email">
            {(["inbox", "starred", "sent", "drafts", "all", "spam", "trash"] as const).map((id) => {
              const count = view.folders.find((folder) => folder.id === id);
              return <Link key={id} className="mail-folder" aria-current={q.f === id && !q.search ? "page" : undefined} href={href({ f: id }) as Route}>
                <MailIcon name={id === "starred" ? "star" : id} /><span>{folderLabel(id)}<MailOpening label="Caricamento…" /></span>{count?.unread ? <b>{count.unread}</b> : null}
              </Link>;
            })}
          </nav>
          <div className="mail-sidebar-heading">Etichette</div>
          <nav aria-label="Etichette Gmail">
            {(view.labels ?? []).map((label) => <Link key={label.id} className="mail-folder" aria-current={q.f === label.id ? "page" : undefined} href={href({ f: label.id }) as Route}><MailIcon name="label" /><span>{label.name}<MailOpening label="Caricamento…" /></span>{label.unread ? <b>{label.unread}</b> : null}</Link>)}
            {!view.labels?.length ? <p className="mail-label-empty">Le tue etichette Gmail appariranno qui.</p> : null}
          </nav>
          <MailLabelCreate />
          <p className="mail-sidebar-foot">Sincronizzata con Gmail</p>
        </aside>
        <div className="mail-content">
          <form className="mail-search" action="/admin/email" role="search">
            <MailIcon name="search" />
            <input type="hidden" name="f" value={q.f} />
            <input aria-label="Cerca nella posta" type="search" name="search" defaultValue={q.search} key={q.search ?? ""} placeholder="Cerca nella posta · mittente, oggetto, from:, has:attachment…" maxLength={300} />
            <button className="adm-btn adm-btn-sm" type="submit">Cerca</button>
            {q.search ? <Link className="adm-link" href={href({ f: q.f }) as Route}>Cancella</Link> : null}
          </form>
          {q.f === "inbox" && !q.search ? <nav className="mail-categories" aria-label="Categorie Gmail">
            <Link aria-current={!q.category ? "page" : undefined} href={href({ f: "inbox" }) as Route}>Tutte</Link>
            {Object.entries(CATEGORIES).map(([id, name]) => <Link key={id} aria-current={q.category === id ? "page" : undefined} href={href({ f: "inbox", category: id as MailCategory }) as Route}>{name}<MailOpening label="Caricamento…" /></Link>)}
          </nav> : <div className="mail-view-title"><strong>{folderLabel(q.f)}</strong>{q.search ? <span>Risultati per “{q.search}”</span> : null}<span>{view.total} messaggi</span></div>}
          <MailSelection key={`${q.f}:${q.search}:${q.category}:${q.p}:${view.list.map((m) => m.uid).join(",")}`} folder={q.f} uids={view.list.map((message) => message.uid)} labels={view.labels ?? []}>
          <MailSelectionBar />
      <MailSplitPane detail={detailOpen}>
        <section className="adm-panel adm-mail-list adm-rise" aria-label={`Messaggi: ${folderLabel(q.f)}`}>
          <MailList q={q} list={view.list} collab={collab} me={me} />
          <Pager q={q} total={view.total} />
        </section>
        <section className="adm-panel adm-mail-detail adm-rise" style={{ "--i": 1 } as React.CSSProperties}>
          {view.open ? <nav className="mail-message-navigation" aria-label="Naviga tra i messaggi">
            <Link href={href({ ...q, m: null, compose: null }) as Route} scroll={false}>← Lista</Link>
            {view.list.findIndex((m) => m.uid === q.m) > 0 ? <Link href={href({ ...q, m: view.list[view.list.findIndex((m) => m.uid === q.m) - 1].uid, compose: null }) as Route} scroll={false} aria-label="Messaggio precedente">↑ Precedente<MailOpening /></Link> : null}
            {view.list.findIndex((m) => m.uid === q.m) >= 0 && view.list.findIndex((m) => m.uid === q.m) < view.list.length - 1 ? <Link href={href({ ...q, m: view.list[view.list.findIndex((m) => m.uid === q.m) + 1].uid, compose: null }) as Route} scroll={false} aria-label="Messaggio successivo">↓ Successivo<MailOpening /></Link> : null}
          </nav> : null}
          {q.compose === "new" ? (
            <>
              <div className="adm-panel-head">
                <h2 className="adm-h2">Nuova email</h2>
                <Link className="adm-btn adm-btn-sm adm-mail-back" href={href({ f: q.f, p: q.p }) as Route}>Chiudi</Link>
              </div>
              <ComposeForm draft={{ to: "", cc: "", subject: "", body: "" }} reply={null} from={address} cancelHref={href({ f: q.f, p: q.p })} />
            </>
          ) : view.open ? (
            <Detail q={q} msg={view.open} thread={view.thread} collab={collab} me={me} address={address} labels={view.labels ?? []} />
          ) : q.m ? (
            <p className="adm-empty">Messaggio non trovato: forse è stato spostato o eliminato in Gmail.</p>
          ) : (
            <div className="adm-mail-empty">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 6 9-6" /></svg>
              <p>Seleziona un messaggio per leggerlo.</p>
              <p className="adm-muted">La lista si aggiorna da sola ogni 30 secondi mentre la pagina è aperta.</p>
            </div>
          )}
        </section>
      </MailSplitPane>
          </MailSelection>
        </div>
      </div>
      </MailPeopleProvider>
    </>
  );
}

function Header({ address }: { address: string; q: Q }) {
  return (
    <header className="adm-top">
      <div>
        <h1 className="adm-h1">Posta</h1>
        <p className="adm-muted">Casella condivisa dell&apos;agenzia · {address}</p>
      </div>
      <div className="adm-top-actions">
        <MailLive renderedAt={renderStamp()} />

      </div>
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
  const sent = q.f === "sent";
  return (
    <ul className="adm-mail-items">
      {list.map((m) => (
        <li key={`${m.folder}:${m.uid}`} className="mail-message-row" data-current={q.m === m.uid || undefined}>
          <MailRowCheck uid={m.uid} subject={m.subject} />
          <MailStar folder={m.folder} uid={m.uid} starred={m.starred} />
          <Link
            href={href({ ...q, m: m.uid, compose: null }) as Route}
            scroll={false}
            className="adm-mail-item"
            data-unread={(!m.seen && q.m !== m.uid) || undefined}
            aria-current={q.m === m.uid ? "true" : undefined}
            prefetch={false}
          >
            <span className="adm-mail-from">
              {!m.seen && q.m !== m.uid ? <span className="adm-mail-dot" aria-label="Non letta" /> : null}
              {sent ? `A: ${m.to.map(who).join(", ") || "—"}` : who(m.from)}
            </span>
            <time className="adm-muted" dateTime={m.date}>{shortDate(m.date)}</time>
            <span className="adm-mail-subject">
              {m.hasAttachments ? (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Con allegati"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5" /></svg>
              ) : null}
              {m.subject || "(nessun oggetto)"}
            </span>
            {m.labels?.length ? <span className="mail-row-labels">{m.labels.slice(0, 3).map((label) => <span key={label}>{label}</span>)}</span> : null}
            <MailPeople mkey={m.key} initial={collab.get(m.key)} meId={me.id} />
            <MailOpening />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pager({ q, total }: { q: Q; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav className="adm-mail-pager" aria-label="Pagine">
      {q.p > 1 ? <Link className="adm-btn adm-btn-sm" href={href({ ...q, p: q.p - 1, m: null, compose: null }) as Route}>← Più recenti</Link> : <span />}
      <span className="adm-muted">Pagina {q.p} di {pages}</span>
      {q.p < pages ? <Link className="adm-btn adm-btn-sm" href={href({ ...q, p: q.p + 1, m: null, compose: null }) as Route}>Meno recenti →</Link> : <span />}
    </nav>
  );
}

function quote(msg: MailMessage) {
  const lines = msg.text.trim().split("\n").slice(0, 200).map((l) => `> ${l}`);
  return `\n\n\nIl ${longDate(msg.date)}, ${who(msg.from)} ha scritto:\n${lines.join("\n")}`;
}

function replyDraft(msg: MailMessage, all: boolean, address: string) {
  const target = msg.folder === "sent" ? msg.to : msg.replyTo.length ? msg.replyTo : msg.from ? [msg.from] : [];
  const self = address.toLowerCase();
  const cc = all ? [...(msg.folder === "sent" ? [] : msg.to), ...msg.cc].filter((a) => a.address.toLowerCase() !== self && !target.some((t) => t.address === a.address)) : [];
  return {
    to: target.map(fmtAddr).join(", "),
    cc: cc.map(fmtAddr).join(", "),
    subject: /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`,
    body: quote(msg),
  };
}

function Detail({ q, msg, thread, collab, me, address, labels }: { labels: import("@/lib/mail/types").MailLabel[]; q: Q; msg: MailMessage; thread: MailSummary[]; collab: Map<string, Collab>; me: AdminUser; address: string }) {
  const c = collab.get(msg.key);
  const att = (i: number) => `/admin/email/attachment?f=${encodeURIComponent(msg.folder)}&m=${msg.uid}&i=${i}`;
  let body: React.ReactNode;
  let blocked = 0;
  if (msg.html) {
    const clean = sanitizeEmailHtml(msg.html, {
      showImages: q.img,
      cidUrl: (cid) => `/admin/email/attachment?f=${encodeURIComponent(msg.folder)}&m=${msg.uid}&cid=${encodeURIComponent(cid)}`,
    });
    blocked = clean.blockedImages;
    body = <MailFrame doc={emailDocument(clean.html, q.img)} title={`Contenuto: ${msg.subject}`} />;
  } else {
    body = <div className="adm-mail-text">{msg.text || "(messaggio vuoto)"}</div>;
  }
  const files = msg.attachments.filter((a) => !a.inline);
  const back = href({ ...q, m: null, compose: null });
  const self = href({ f: q.f, p: q.p, m: msg.uid });
  return (
    <article className="adm-mail-msg">
      <MarkOpened folder={msg.folder} uid={msg.uid} mkey={msg.key} />
      <Link className="adm-back adm-mail-back" href={back as Route}>← Torna alla lista</Link>
      <MailMessageActions folder={msg.folder} uids={[msg.uid]} backHref={back} labels={labels} starred={msg.starred} applied={msg.labels} />
      <h2 className="adm-mail-title">{msg.subject || "(nessun oggetto)"}</h2>
      <dl className="adm-mail-meta">
        <dt>Da</dt><dd>{msg.from ? fmtAddr(msg.from) : "—"}</dd>
        <dt>A</dt><dd>{msg.to.map(fmtAddr).join(", ") || "—"}</dd>
        {msg.cc.length ? (<><dt>Cc</dt><dd>{msg.cc.map(fmtAddr).join(", ")}</dd></>) : null}
        <dt>Data</dt><dd><time dateTime={msg.date}>{longDate(msg.date)}</time></dd>
      </dl>

      <MailTeamStatus mkey={msg.key} initial={c} meId={me.id} />

      <div className="adm-row-actions adm-mail-actions">
        {msg.folder === "drafts" ? <Link className="adm-btn adm-btn-sm adm-btn-primary" href={href({ ...q, compose: "draft" }) as Route}>Modifica bozza</Link> : <Link className="adm-btn adm-btn-sm adm-btn-primary" href={href({ ...q, compose: "reply" }) as Route}>Rispondi</Link>}
        <Link className="adm-btn adm-btn-sm" href={href({ ...q, compose: "forward" }) as Route}>Inoltra</Link>
        {msg.to.length + msg.cc.length > 1 ? <Link className="adm-btn adm-btn-sm" href={href({ ...q, compose: "all" }) as Route}>Rispondi a tutti</Link> : null}
        {msg.folder !== "sent" ? <UnreadButton folder={msg.folder} uid={msg.uid} href={back} /> : null}
      </div>

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

      <div className="adm-mail-body">{body}</div>

      {files.length ? (
        <ul className="adm-mail-files" aria-label="Allegati">
          {files.map((a) => (
            <li key={a.index}>
              <a className="adm-btn adm-btn-sm" href={att(a.index)} download={a.filename}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                {a.filename}
                <span className="adm-muted">{size(a.size)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {q.compose === "reply" || q.compose === "all" || q.compose === "forward" || q.compose === "draft" ? (
        <section className="adm-mail-reply" aria-label="Risposta">
          <ComposeForm
            key={`${msg.folder}:${msg.uid}:${q.compose}`}
            draft={q.compose === "draft" ? { to: msg.to.map(fmtAddr).join(", "), cc: msg.cc.map(fmtAddr).join(", "), subject: msg.subject, body: msg.text } : q.compose === "forward" ? { to: "", cc: "", subject: /^fwd:/i.test(msg.subject) ? msg.subject : `Fwd: ${msg.subject}`, body: `\n\n---------- Messaggio inoltrato ----------\nDa: ${msg.from ? fmtAddr(msg.from) : ""}\nData: ${longDate(msg.date)}\nOggetto: ${msg.subject}\n\n${msg.text}` } : replyDraft(msg, q.compose === "all", address)}
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
                  <Link href={href({ f: "all", m: t.uid }) as Route} prefetch={false} aria-current={current ? "true" : undefined}>
                    <strong>{t.from?.address.toLowerCase() === address.toLowerCase() ? "CTRL (noi)" : who(t.from)}</strong>
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
