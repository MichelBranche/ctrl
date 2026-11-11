import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { ComposeForm, MailFrame, MailOpening, MarkOpened } from "@/components/admin/email/mail-client";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import type { AdminUser } from "@/lib/admin";
import { composeOutreach } from "@/lib/crm-outreach";
import { contactEmailPath, contactMailSearch, type ContactMailQuery } from "@/lib/crm-nav";
import { rememberedMessageId, rememberMailReferences } from "@/lib/desk";
import { isAgencyAddress, mailProvider } from "@/lib/mail";
import { involvesAddress, mailDirection, type ContactAddress, type ContactMail } from "@/lib/mail/contact";
import { MailError } from "@/lib/mail/provider";
import { fmtAddr, longDate, replyDraft, who } from "@/lib/mail/reply";
import { locateMessage, type Located } from "@/lib/mail/resolve";
import { emailDocument, sanitizeEmailHtml, textDocumentBody } from "@/lib/mail/sanitize";
import { emailSender } from "@/lib/mail/sender";
import { folderLabel, type MailMessage, type MailSummary } from "@/lib/mail/types";

/*
 * CRM contact email view: list of the contact's conversations (left) and reading / composing (right).
 * Server-rendered from the URL with the same provider, sanitizer and composer as Posta. Nothing is kept in the browser.
 */

const TZ = "Europe/Rome";
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { timeZone: TZ }) === new Date().toLocaleDateString("it-IT", { timeZone: TZ })
    ? d.toLocaleTimeString("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", { timeZone: TZ, day: "numeric", month: "short" });
};
const size = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const ICON = {
  sent: "M21 3L10 14M21 3l-7 18-4-7-7-4z",
  received: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v4",
  write: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  file: "M12 4v11M7 10l5 5 5-5M5 20h14",
  clip: "M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
};
const DIRECTION_LABEL = { sent: "Inviata", received: "Ricevuta" } as const;

export type ContactMailCtx = { id: string; name: string; address: ContactAddress; q: ContactMailQuery; me: AdminUser; from: string };
const hrefOf = (ctx: ContactMailCtx, patch: Partial<ContactMailQuery>) => `${contactEmailPath(ctx.id)}${contactMailSearch(ctx.q, patch)}`;

export function ContactMailListSkeleton() {
  return (
    <div className="crm-mail-items" aria-busy="true" aria-label="Caricamento delle email del contatto">
      {[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel" style={{ height: "4.2rem", borderRadius: ".6rem" }} />)}
    </div>
  );
}

export function ContactMailDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Caricamento dell'email">
      <div className="adm-skel" style={{ height: "2.2rem", width: "60%", borderRadius: ".5rem" }} />
      <div className="adm-skel" style={{ height: "18rem", marginTop: "1rem", borderRadius: ".7rem" }} />
    </div>
  );
}

/** Left column: the contact's messages, newest first, filtered by direction. */
export async function ContactMailList({ ctx }: { ctx: ContactMailCtx }) {
  const provider = mailProvider();
  if (!provider) return <p className="crm-mail-note" role="status">Casella non collegata: la lista delle email non è disponibile.</p>;
  let data: ContactMail;
  try {
    data = await provider.contactMessages(ctx.address);
  } catch (error) {
    return (
      <div className="crm-mail-note" role="alert">
        <p>{error instanceof MailError ? error.message : "Impossibile leggere le email del contatto in questo momento."}</p>
        <Link className="adm-btn adm-btn-sm" href={hrefOf(ctx, {}) as Route}>Riprova</Link>
      </div>
    );
  }
  const items = data.list.map((m) => ({ m, dir: mailDirection(m.from, isAgencyAddress) }));
  const shown = items.filter(({ dir }) => ctx.q.vista === "tutte" || (ctx.q.vista === "inviate" ? dir === "sent" : dir === "received"));
  return (
    <>
      {data.warning ? <p className="crm-mail-note" role="status">{data.warning}</p> : null}
      {shown.length ? (
        <ul className="crm-mail-items">
          {shown.map(({ m, dir }) => {
            const current = ctx.q.m === m.uid && ctx.q.k === m.key;
            return (
              <li key={`${m.folder}:${m.uid}`}>
                <Link className="crm-mail-item" href={hrefOf(ctx, { m: m.uid, k: m.key, compose: null, img: false }) as Route} scroll={false} prefetch={false}
                  aria-current={current ? "true" : undefined} data-unread={(!m.seen && !current) || undefined}>
                  <span className="crm-mail-dir" data-dir={dir} aria-hidden="true"><CrmIcon d={ICON[dir]} /></span>
                  <span className="crm-mail-subject">{m.subject || "(nessun oggetto)"}</span>
                  <time dateTime={m.date}>{shortDate(m.date)}</time>
                  <span className="crm-mail-who">
                    {m.hasAttachments ? <span className="crm-mail-clip" aria-label="Con allegati"><CrmIcon d={ICON.clip} /></span> : null}
                    {dir === "sent" ? `A: ${m.to.map(who).join(", ") || "—"}` : `Da: ${who(m.from)}`}
                  </span>
                  <span className="crm-mail-badge" data-dir={dir}>{DIRECTION_LABEL[dir]}</span>
                  {!m.seen && !current ? <span className="adm-sr">Non letta</span> : null}
                  <MailOpening />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="crm-mail-empty">
          <p>{data.list.length ? `Nessuna email ${ctx.q.vista === "inviate" ? "inviata" : "ricevuta"} con questo filtro.` : `Nessuna email scambiata con ${ctx.address}.`}</p>
          <p className="adm-muted">Cerco in Tutta la posta (in arrivo, inviate, archiviate); Spam e Cestino sono esclusi.</p>
        </div>
      )}
      {data.more ? (
        <p className="crm-mail-note adm-muted">
          Mostro le {data.list.length} più recenti.{" "}
          <Link className="adm-link" href={`/admin/email?${new URLSearchParams({ f: "all", search: ctx.address })}` as Route}>Cerca le più vecchie in Posta</Link>
        </p>
      ) : null}
    </>
  );
}

/** Right column: new message, or one opened message (with reply) verified by uid + stable key. */
export async function ContactMailDetail({ ctx }: { ctx: ContactMailCtx }) {
  const { q } = ctx;
  const list = hrefOf(ctx, { m: null, k: "", compose: null, img: false });
  if (q.compose === "new" && !q.m) {
    return (
      <>
        <div className="crm-mail-detail-head">
          <h2 className="adm-h2">Nuova email a {ctx.name}</h2>
          <Link className="adm-btn adm-btn-sm crm-mail-back" href={list as Route}>← Email del contatto</Link>
        </div>
        <ComposeForm key={`new:${ctx.address}`} draft={{ to: ctx.address, cc: "", subject: "", body: "" }} reply={null} sender={emailSender(ctx.me)} from={ctx.from} cancelHref={list} sentHref={list}
          outreach={await composeOutreach(ctx.me, ctx.address, "")} aiContactId={ctx.id} />
      </>
    );
  }
  if (!q.m) {
    return (
      <div className="crm-mail-empty is-detail">
        <span className="crm-mail-dir" aria-hidden="true"><CrmIcon d={ICON.mail} /></span>
        <p>Seleziona un&apos;email per leggerla, oppure scrivine una nuova.</p>
        <Link className="adm-btn adm-btn-sm adm-btn-primary" href={hrefOf(ctx, { compose: "new", m: null, k: "" }) as Route}><CrmIcon d={ICON.write} />Nuova email</Link>
      </div>
    );
  }
  if (!q.k) return <Notice back={list} text="Link non valido: riapri l'email dalla lista del contatto." />;
  const provider = mailProvider();
  if (!provider) return <Notice back={list} text="Casella non collegata." />;
  let found: Located;
  try {
    found = await locateMessage(provider, { folder: "all", uid: q.m, key: q.k, messageId: () => rememberedMessageId(q.k) });
  } catch (error) {
    return <Notice back={list} text={error instanceof MailError ? error.message : "Impossibile aprire l'email in questo momento. Riprova tra poco."} />;
  }
  if (found.kind === "missing") return <Notice back={list} text="Email non più disponibile: forse è stata eliminata o spostata in Gmail." />;
  if (found.kind === "moved") {
    // Same message under a new All Mail uid: follow it. Elsewhere (Trash, Spam) it is no longer part of this view.
    if (found.folder === "all") redirect(hrefOf(ctx, { m: found.uid }) as Route);
    return <Notice back={list} text={`Email spostata in ${folderLabel(found.folder)}: non fa più parte della vista del contatto.`}
      extra={<Link className="adm-link" href={`/admin/email?${new URLSearchParams({ f: found.folder, m: String(found.uid) })}` as Route}>Apri in Posta</Link>} />;
  }
  const detail = found.detail;
  const msg = detail.open;
  if (!msg) return <Notice back={list} text="Email non più disponibile." />;
  // The uid came from the URL: show it here only when it really involves this contact's exact address.
  if (!involvesAddress(msg, ctx.address)) return <Notice back={list} text={`Questa email non riguarda ${ctx.address}.`} />;
  await rememberMailReferences({ folders: [], list: [], total: 0, open: msg, thread: detail.thread }).catch(() => {});
  return <Message ctx={ctx} msg={msg} thread={detail.thread} list={list} />;
}

function Notice({ text, back, extra }: { text: string; back: string; extra?: React.ReactNode }) {
  return (
    <div className="crm-mail-empty is-detail" role="status">
      <p>{text}</p>
      <p className="crm-mail-actions"><Link className="adm-btn adm-btn-sm" href={back as Route}>← Email del contatto</Link>{extra}</p>
    </div>
  );
}

async function Message({ ctx, msg, thread, list }: { ctx: ContactMailCtx; msg: MailMessage; thread: MailSummary[]; list: string }) {
  const { q } = ctx;
  const dir = mailDirection(msg.from, isAgencyAddress);
  const self = hrefOf(ctx, { compose: null });
  let blocked = 0;
  let doc: string;
  if (msg.html) {
    const clean = sanitizeEmailHtml(msg.html, {
      showImages: q.img,
      cidUrl: (cid) => `/admin/email/attachment?f=${encodeURIComponent(msg.folder)}&m=${msg.uid}&cid=${encodeURIComponent(cid)}`,
    });
    blocked = clean.blockedImages;
    doc = emailDocument(clean.html, q.img);
  } else {
    doc = emailDocument(textDocumentBody(msg.text || "(messaggio vuoto)"), false);
  }
  const files = msg.attachments.filter((a) => !a.inline);
  const replying = q.compose === "reply" || q.compose === "all";
  const reply = replying ? replyDraft(msg, q.compose === "all") : null;
  const outreach = reply ? await composeOutreach(ctx.me, reply.to, reply.cc) : null;
  return (
    <article className="crm-mail-msg">
      <MarkOpened folder={msg.folder} uid={msg.uid} mkey={msg.key} />
      <div className="crm-mail-detail-head">
        <h2 className="adm-h2">{msg.subject || "(nessun oggetto)"}</h2>
        <Link className="adm-btn adm-btn-sm crm-mail-back" href={list as Route}>← Email del contatto</Link>
      </div>
      <dl className="adm-mail-meta">
        <dt>Da</dt><dd>{msg.from ? fmtAddr(msg.from) : "—"} <span className="crm-mail-badge" data-dir={dir}>{DIRECTION_LABEL[dir]}</span></dd>
        <dt>A</dt><dd>{msg.to.map(fmtAddr).join(", ") || "—"}</dd>
        {msg.cc.length ? <><dt>Cc</dt><dd>{msg.cc.map(fmtAddr).join(", ")}</dd></> : null}
        <dt>Data</dt><dd><time dateTime={msg.date}>{longDate(msg.date)}</time></dd>
      </dl>
      <div className="adm-row-actions crm-mail-actions">
        <Link className="adm-btn adm-btn-sm adm-btn-primary" href={hrefOf(ctx, { compose: "reply" }) as Route}>Rispondi</Link>
        {msg.to.length + msg.cc.length > 1 ? <Link className="adm-btn adm-btn-sm" href={hrefOf(ctx, { compose: "all" }) as Route}>Rispondi a tutti</Link> : null}
        <Link className="adm-btn adm-btn-sm" href={`/admin/email?${new URLSearchParams({ f: msg.folder, m: String(msg.uid) })}` as Route}>Apri in Posta</Link>
      </div>
      {blocked > 0 && !q.img ? (
        <p className="adm-mail-images">
          <span>{blocked === 1 ? "1 immagine remota bloccata" : `${blocked} immagini remote bloccate`} per privacy.</span>
          <Link className="adm-link" href={hrefOf(ctx, { img: true, compose: null }) as Route} scroll={false}>Mostra immagini</Link>
        </p>
      ) : q.img && msg.html ? (
        <p className="adm-mail-images"><span>Immagini remote visibili.</span><Link className="adm-link" href={hrefOf(ctx, { img: false, compose: null }) as Route} scroll={false}>Nascondi immagini</Link></p>
      ) : null}
      <div className="adm-mail-body"><MailFrame doc={doc} title={`Contenuto: ${msg.subject}`} /></div>
      {files.length ? (
        <ul className="adm-mail-files" aria-label="Allegati">
          {files.map((a) => (
            <li key={a.index}>
              <a className="adm-btn adm-btn-sm" href={`/admin/email/attachment?f=${encodeURIComponent(msg.folder)}&m=${msg.uid}&i=${a.index}`} download={a.filename}>
                <CrmIcon d={ICON.file} />{a.filename}<span className="adm-muted">{size(a.size)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {reply ? (
        <section className="adm-mail-reply" aria-label="Risposta">
          <ComposeForm key={`${msg.folder}:${msg.uid}:${q.compose}`} sender={emailSender(ctx.me)} draft={reply}
            reply={{ folder: msg.folder, uid: msg.uid }} from={ctx.from} cancelHref={self} sentHref={list} outreach={outreach} aiContactId={ctx.id} />
        </section>
      ) : null}
      {thread.length > 1 ? (
        <details className="adm-mail-thread mail-thread-compact" aria-label="Conversazione">
          <summary><span>Conversazione</span><span className="mail-thread-count">{thread.length} messaggi</span><span className="mail-thread-chevron" aria-hidden="true">⌄</span></summary>
          <ol>
            {thread.map((t) => {
              const current = t.key === msg.key;
              return (
                <li key={`${t.folder}:${t.uid}`} data-current={current || undefined}>
                  <Link href={hrefOf(ctx, { m: t.uid, k: t.key, compose: null, img: false }) as Route} prefetch={false} aria-current={current ? "true" : undefined}>
                    <strong>{isAgencyAddress(t.from?.address) ? "CTRL (noi)" : who(t.from)}</strong>
                    <span className="adm-muted">{shortDate(t.date)}</span>
                    <MailOpening />
                  </Link>
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}
    </article>
  );
}
