import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClaimButton, ComposeForm, MailFrame, MailLive, MarkOpened, UnreadButton } from "@/components/admin/email/mail-client";
import { requireSection, type AdminUser } from "@/lib/admin";
import { agencyAddress, mailProvider } from "@/lib/mail";
import { collabFor } from "@/lib/mail/collab";
import { MailError, PAGE_SIZE, type MailboxView } from "@/lib/mail/provider";
import { emailDocument, sanitizeEmailHtml } from "@/lib/mail/sanitize";
import { FOLDER_LABEL, isFolder, type Address, type Collab, type FolderId, type MailMessage, type MailSummary } from "@/lib/mail/types";

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

type Q = { f: FolderId; p: number; m: number | null; img: boolean; compose: "new" | "reply" | "all" | null };

function href(q: Partial<Q> & { f: FolderId }): string {
  const s = new URLSearchParams();
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
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const [me, sp] = await Promise.all([requireSection("email"), searchParams]);
  const f = one(sp.f);
  const compose = one(sp.compose);
  const q: Q = {
    f: isFolder(f) ? f : "inbox",
    p: Math.min(Math.max(Number.parseInt(one(sp.p) ?? "1", 10) || 1, 1), 500),
    m: /^\d{1,10}$/.test(one(sp.m) ?? "") ? Number(one(sp.m)) : null,
    img: one(sp.img) === "1",
    compose: compose === "new" || compose === "reply" || compose === "all" ? compose : null,
  };
  const address = agencyAddress();
  const provider = mailProvider();

  if (!provider || !address) return <NotConnected founder={me.role === "founder"} />;

  let view: MailboxView;
  try {
    view = await provider.view({ folder: q.f, page: q.p, open: q.m });
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
  const collab = await collabFor(keys).catch(() => new Map<string, Collab>());

  const detailOpen = Boolean(view.open || q.compose === "new");
  return (
    <>
      <Header address={address} q={q} />
      <nav className="adm-tabs adm-mail-folders" aria-label="Cartelle">
        {view.folders.map((fo) => (
          <Link key={fo.id} href={href({ f: fo.id }) as Route} className="adm-tab" aria-current={q.f === fo.id ? "page" : undefined}>
            {FOLDER_LABEL[fo.id]}
            {fo.unread && fo.id !== "sent" ? <span className="adm-count">{fo.unread}</span> : null}
          </Link>
        ))}
        {q.f === "all" ? <span className="adm-tab" aria-current="page">Conversazione</span> : null}
      </nav>
      <div className="adm-mail" data-detail={detailOpen || undefined}>
        <section className="adm-panel adm-mail-list adm-rise" aria-label={`Messaggi: ${FOLDER_LABEL[q.f]}`}>
          <MailList q={q} list={view.list} collab={collab} me={me} />
          <Pager q={q} total={view.total} />
        </section>
        <section className="adm-panel adm-mail-detail adm-rise" style={{ "--i": 1 } as React.CSSProperties}>
          {q.compose === "new" ? (
            <>
              <div className="adm-panel-head">
                <h2 className="adm-h2">Nuova email</h2>
                <Link className="adm-btn adm-btn-sm adm-mail-back" href={href({ f: q.f, p: q.p }) as Route}>Chiudi</Link>
              </div>
              <ComposeForm draft={{ to: "", cc: "", subject: "", body: "" }} reply={null} from={address} cancelHref={href({ f: q.f, p: q.p })} />
            </>
          ) : view.open ? (
            <Detail q={q} msg={view.open} thread={view.thread} collab={collab} me={me} address={address} />
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
      </div>
    </>
  );
}

function Header({ address, q }: { address: string; q: Q }) {
  return (
    <header className="adm-top">
      <div>
        <h1 className="adm-h1">Email</h1>
        <p className="adm-muted">Casella condivisa dell&apos;agenzia · {address}</p>
      </div>
      <div className="adm-top-actions">
        <MailLive renderedAt={renderStamp()} />
        <Link className="adm-btn adm-btn-primary" href={href({ f: q.f, p: q.p, compose: "new" }) as Route}>Scrivi</Link>
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

function CollabChips({ c, me }: { c: Collab | undefined; me: AdminUser }) {
  if (!c) return null;
  const others = c.readBy.filter((r) => r.id !== me.id);
  return (
    <span className="adm-mail-chips">
      {c.claimedBy ? (
        <span className="adm-badge adm-mail-claim" data-mine={c.claimedBy.id === me.id || undefined}>
          In carico: {c.claimedBy.id === me.id ? "tu" : c.claimedBy.name}
        </span>
      ) : null}
      {others.length ? (
        <span className="adm-mail-readers" title={`Letta da ${others.map((r) => r.name).join(", ")}`}>
          {others.slice(0, 3).map((r) => (
            <span key={r.id} className="adm-avatar adm-avatar-xs" aria-hidden="true">{initials(r.name)}</span>
          ))}
          <span className="adm-sr">Letta da {others.map((r) => r.name).join(", ")}</span>
        </span>
      ) : null}
    </span>
  );
}

function MailList({ q, list, collab, me }: { q: Q; list: MailSummary[]; collab: Map<string, Collab>; me: AdminUser }) {
  if (!list.length) return <p className="adm-empty">Nessun messaggio in {FOLDER_LABEL[q.f].toLowerCase()}.</p>;
  const sent = q.f === "sent";
  return (
    <ul className="adm-mail-items">
      {list.map((m) => (
        <li key={`${m.folder}:${m.uid}`}>
          <Link
            href={href({ f: q.f, p: q.p, m: m.uid }) as Route}
            className="adm-mail-item"
            data-unread={!m.seen || undefined}
            aria-current={q.m === m.uid ? "true" : undefined}
            prefetch={false}
          >
            <span className="adm-mail-from">
              {!m.seen ? <span className="adm-mail-dot" aria-label="Non letta" /> : null}
              {sent ? `A: ${m.to.map(who).join(", ") || "—"}` : who(m.from)}
            </span>
            <time className="adm-muted" dateTime={m.date}>{shortDate(m.date)}</time>
            <span className="adm-mail-subject">
              {m.hasAttachments ? (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Con allegati"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5" /></svg>
              ) : null}
              {m.subject || "(nessun oggetto)"}
            </span>
            <CollabChips c={collab.get(m.key)} me={me} />
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
      {q.p > 1 ? <Link className="adm-btn adm-btn-sm" href={href({ f: q.f, p: q.p - 1 }) as Route}>← Più recenti</Link> : <span />}
      <span className="adm-muted">Pagina {q.p} di {pages}</span>
      {q.p < pages ? <Link className="adm-btn adm-btn-sm" href={href({ f: q.f, p: q.p + 1 }) as Route}>Meno recenti →</Link> : <span />}
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

function Detail({ q, msg, thread, collab, me, address }: { q: Q; msg: MailMessage; thread: MailSummary[]; collab: Map<string, Collab>; me: AdminUser; address: string }) {
  const c = collab.get(msg.key);
  const att = (i: number) => `/admin/email/attachment?f=${msg.folder}&m=${msg.uid}&i=${i}`;
  let body: React.ReactNode;
  let blocked = 0;
  if (msg.html) {
    const clean = sanitizeEmailHtml(msg.html, {
      showImages: q.img,
      cidUrl: (cid) => `/admin/email/attachment?f=${msg.folder}&m=${msg.uid}&cid=${encodeURIComponent(cid)}`,
    });
    blocked = clean.blockedImages;
    body = <MailFrame doc={emailDocument(clean.html, q.img)} title={`Contenuto: ${msg.subject}`} />;
  } else {
    body = <div className="adm-mail-text">{msg.text || "(messaggio vuoto)"}</div>;
  }
  const files = msg.attachments.filter((a) => !a.inline);
  const back = href({ f: q.f, p: q.p });
  const self = href({ f: q.f, p: q.p, m: msg.uid });
  const claimedByOther = c?.claimedBy && c.claimedBy.id !== me.id ? c.claimedBy.name : null;
  return (
    <article className="adm-mail-msg">
      <MarkOpened folder={msg.folder} uid={msg.uid} mkey={msg.key} />
      <Link className="adm-back adm-mail-back" href={back as Route}>← Torna alla lista</Link>
      <h2 className="adm-mail-title">{msg.subject || "(nessun oggetto)"}</h2>
      <dl className="adm-mail-meta">
        <dt>Da</dt><dd>{msg.from ? fmtAddr(msg.from) : "—"}</dd>
        <dt>A</dt><dd>{msg.to.map(fmtAddr).join(", ") || "—"}</dd>
        {msg.cc.length ? (<><dt>Cc</dt><dd>{msg.cc.map(fmtAddr).join(", ")}</dd></>) : null}
        <dt>Data</dt><dd><time dateTime={msg.date}>{longDate(msg.date)}</time></dd>
      </dl>

      <div className="adm-mail-team">
        <span className="adm-muted">
          {c?.claimedBy ? <>In carico a <strong>{c.claimedBy.id === me.id ? "te" : c.claimedBy.name}</strong> · </> : "Nessuno l'ha presa in carico · "}
          Letta da {c?.readBy.length ? c.readBy.map((r) => (r.id === me.id ? "te" : r.name)).join(", ") : "te"}
        </span>
        <ClaimButton mkey={msg.key} mine={c?.claimedBy?.id === me.id} other={claimedByOther} />
      </div>

      <div className="adm-row-actions adm-mail-actions">
        <Link className="adm-btn adm-btn-sm adm-btn-primary" href={href({ ...q, compose: "reply" }) as Route}>Rispondi</Link>
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

      {q.compose === "reply" || q.compose === "all" ? (
        <section className="adm-mail-reply" aria-label="Risposta">
          <ComposeForm draft={replyDraft(msg, q.compose === "all", address)} reply={{ folder: msg.folder, uid: msg.uid }} from={address} cancelHref={self} />
        </section>
      ) : null}

      {thread.length > 1 ? (
        <section className="adm-mail-thread" aria-label="Conversazione">
          <h3 className="adm-kicker">Conversazione · {thread.length} messaggi</h3>
          <ol>
            {thread.map((t) => {
              const current = t.key === msg.key;
              return (
                <li key={`${t.folder}:${t.uid}`} data-current={current || undefined}>
                  <Link href={href({ f: "all", m: t.uid }) as Route} prefetch={false} aria-current={current ? "true" : undefined}>
                    <strong>{t.from?.address.toLowerCase() === address.toLowerCase() ? "CTRL (noi)" : who(t.from)}</strong>
                    <span className="adm-muted">{shortDate(t.date)}</span>
                  </Link>
                  <CollabChips c={collab.get(t.key)} me={me} />
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
