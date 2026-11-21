"use client";

import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { emailDocument } from "@/lib/mail/document";
import { brandedEmail, type EmailSender } from "@/lib/mail/template";
import { markOpened, markUnread, sendMail, saveMailDraft, toggleClaim, type SendState } from "@/app/admin/email-actions";
import { GenerateEmailButton } from "@/components/admin/crm/generate-email";
import { OutreachDialog } from "@/components/admin/crm/outreach-dialog";
import type { OutreachWarning } from "@/lib/crm-outreach-types";
import type { MailboxId, MailboxInfo } from "@/lib/mail/mailbox-types";
import { useMailBox } from "@/components/admin/email/mail-box";
import { MailIcon } from "@/components/admin/email/mailbox-ui";
import { RichEditor } from "@/components/admin/email/mail-editor";

const POLL_MS = 30_000;

/** Feedback belongs inside the Link, so it follows the latest navigation. */
export function MailOpening({ label = "Apertura email…" }: { label?: string }) {
  const { pending } = useLinkStatus();
  return <span className="adm-mail-opening" role="status">{pending ? label : ""}</span>;
}

/** Re-renders the inbox from the server every ~30s while the tab is visible, plus a manual refresh. */
export function MailLive({ renderedAt, children }: { renderedAt: number; children?: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        start(() => router.refresh());
        tick();
      }, POLL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") start(() => router.refresh());
      tick();
    };
    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  const time = new Date(renderedAt).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="mail-live" aria-live="polite">
      <span className="mail-live-time">{pending ? "Sincronizzazione…" : `Ultima sincronizzazione alle ${time}`}</span>
      <button type="button" className="mail-icon-btn" onClick={() => start(() => router.refresh())} disabled={pending} aria-label="Aggiorna" title="Aggiorna">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={pending ? "adm-spin" : undefined}>
          <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
        </svg>
      </button>
      {children}
    </div>
  );
}

/** Marks the opened message as read (IMAP \Seen + "letta da") once it is actually shown, never on prefetch. */
export function MarkOpened({ folder, uid, mkey }: { folder: string; uid: number; mkey: string }) {
  const done = useRef<string | null>(null);
  const box = useMailBox();
  useEffect(() => {
    const id = `${folder}:${uid}`;
    if (done.current === id) return;
    done.current = id;
    // A full refresh here redownloaded the newly opened message and could race
    // the next click. The scheduled refresh reconciles read/collaboration state.
    markOpened(folder, uid, mkey, box).then(() => { window.dispatchEvent(new Event("ctrl-mail-changed")); }, () => {});
  }, [folder, uid, mkey, box]);
  return null;
}

/** Sanitized email HTML in a sandboxed iframe (no scripts), sized to its content. */
export function MailFrame({ doc, title }: { doc: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let ro: ResizeObserver | undefined;
    const measure = () => {
      const doc = frame.contentDocument;
      const body = doc?.body;
      if (!doc || !body) return;
      // Content height only: <html>'s scrollHeight is never smaller than the iframe itself,
      // so using it let the frame grow and never shrink (the endless white block under the preview).
      const fit = () => {
        const content = Math.max(body.scrollHeight, Math.ceil(body.getBoundingClientRect().height));
        setHeight(Math.min(Math.max(content, 80) + 2, 12000));
      };
      fit();
      ro?.disconnect();
      ro = new ResizeObserver(fit);
      ro.observe(body);
      // Inline (cid:) images can arrive after load and change the height.
      for (const img of Array.from(doc.images)) if (!img.complete) img.addEventListener("load", fit, { once: true });
    };
    frame.addEventListener("load", measure);
    measure();
    return () => {
      frame.removeEventListener("load", measure);
      ro?.disconnect();
    };
  }, [doc]);
  return (
    <iframe
      ref={ref}
      className="adm-mail-frame"
      title={title}
      srcDoc={doc}
      // allow-same-origin only lets us measure the height; without allow-scripts nothing inside can run.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{ height }}
    />
  );
}

export function ClaimButton({ mkey, mine, other }: { mkey: string; mine: boolean; other: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <span className="mail-claim-action">
    <button
      type="button"
      className={`mail-btn${mine ? "" : " mail-btn-primary"}`}
      disabled={pending}
      onClick={() => start(async () => {
        setError("");
        try {
          const result = await toggleClaim(mkey, !mine);
          if (!result.ok) { setError("Presa in carico non aggiornata. Riprova."); return; }
          window.dispatchEvent(new Event("ctrl-mail-changed"));
        } catch { setError("Connessione interrotta. Riprova."); }
      })}
    >
      <MailIcon name="link" size={15} />{pending ? "…" : mine ? "Rilascia" : other ? `Prendi tu (ora: ${other})` : "Prendi in carico"}
    </button>
    {error ? <span className="adm-error" role="alert">{error}</span> : null}
  </span>;
}

export function UnreadButton({ folder, uid, href }: { folder: string; uid: number; href: string }) {
  const router = useRouter();
  const box = useMailBox();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="adm-btn adm-btn-sm"
      disabled={pending}
      onClick={() => start(async () => {
        await markUnread(folder, uid, box);
        router.push(href as Route);
      })}
    >
      Segna come non letta
    </button>
  );
}

type Draft = { to: string; cc: string; subject: string; body: string };

/** Splits "a@b.it, \"Rossi, M\" <m@x.it>" on commas outside quotes. */
const splitAddresses = (raw: string) => raw.split(/[,;](?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim()).filter(Boolean);

/** Recipients as removable chips; the hidden input carries the same comma list the server already parses. */
function RecipientField({ name, label, initial, autoFocus, onAddCc }: { name: string; label: string; initial: string; autoFocus?: boolean; onAddCc?: () => void }) {
  const [chips, setChips] = useState(() => splitAddresses(initial));
  const [text, setText] = useState("");
  const commit = () => { const add = splitAddresses(text); if (add.length) setChips((c) => [...c, ...add.filter((a) => !c.includes(a))]); setText(""); };
  const value = [...chips, ...splitAddresses(text)].join(", ");
  return (
    <div className="mail-compose-row">
      <label htmlFor={`compose-${name}`}>{label}</label>
      <div className="mail-chips">
        {chips.map((chip) => (
          <span key={chip} className="mail-chip">{chip}<button type="button" aria-label={`Rimuovi ${chip}`} onClick={() => setChips((c) => c.filter((x) => x !== chip))}><MailIcon name="close" size={12} /></button></span>
        ))}
        <input id={`compose-${name}`} className="mail-chip-input" value={text} autoComplete="off" autoFocus={autoFocus}
          placeholder={chips.length ? "" : "nome@esempio.it"}
          onChange={(e) => { const v = e.target.value; if (/[,;]\s*$/.test(v)) { setText(v.replace(/[,;]\s*$/, "")); setTimeout(commit); } else setText(v); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) { e.preventDefault(); commit(); }
            else if (e.key === "Backspace" && !text && chips.length) setChips((c) => c.slice(0, -1));
          }}
          onBlur={commit}
        />
        <input type="hidden" name={name} value={value} />
      </div>
      {onAddCc ? <button type="button" className="mail-compose-cc" onClick={onAddCc}>Cc</button> : null}
    </div>
  );
}

/**
 * `sentHref`: where to go after a successful send (Posta: Inviati; the CRM contact view: back to the contact's mail).
 * `outreach`: CRM warning computed on the server when the composer opens; writing stays locked until "Continua comunque".
 * The server re-checks at send time (lib/crm-outreach.ts) and may answer with an updated warning instead of sending.
 * `mailboxes`: the "Da" choices the user may send from (amministrazione@ only for founders); omitted = the shared mailbox.
 */
export function ComposeForm({ draft, reply, from, cancelHref, original, draftUid = 0, sender, sentHref = "/admin/email?f=sent", outreach = null, aiContactId, mailboxes, title }: { sender?: EmailSender | null; original?: { folder: string; uid: number; files: number }; draftUid?: number; draft: Draft; reply: { folder: string; uid: number } | null; from: string; cancelHref: string; sentHref?: string; outreach?: OutreachWarning | null; aiContactId?: string; mailboxes?: MailboxInfo[]; title?: string }) {
  const router = useRouter();
  const sourceBox = useMailBox();
  const choices = mailboxes?.length ? mailboxes : null;
  const [fromBox, setFromBox] = useState<MailboxId>(choices?.some((m) => m.id === sourceBox) ? sourceBox : (choices?.[0]?.id ?? "hello"));
  /** Idempotency key of the attempt in flight; a new one only after an attempt that certainly sent nothing new. */
  const sendKey = useRef<string | null>(null);
  const [consent, setConsent] = useState("");
  const [locked, setLocked] = useState(Boolean(outreach));
  const [dialog, setDialog] = useState<{ warning: OutreachWarning; atOpen: boolean } | null>(outreach ? { warning: outreach, atOpen: true } : null);
  const [state, action, pending] = useActionState<SendState, FormData>(async (previous, data) => {
    sendKey.current ??= crypto.randomUUID();
    data.set("sendKey", sendKey.current);
    const result = await sendMail(previous, data);
    // Keep the key after an unknown outcome: a blind resubmit is refused; only an informed "Continua comunque" renews it.
    if (!result.ok && !result.uncertain) sendKey.current = null;
    if (result.warning) { setConsent(""); setDialog({ warning: result.warning, atOpen: false }); }
    return result;
  }, {});
  const [saved, saveAction, saving] = useActionState<SendState, FormData>(async (previous, data) => {
    const result = await saveMailDraft(previous, data);
    return { ...result, draftUid: result.draftUid ?? previous.draftUid };
  }, {});
  const activeDraftUid = saved.draftUid ?? draftUid;
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [editorSeed, setEditorSeed] = useState({ n: 0, body: draft.body });
  const [preview, setPreview] = useState(true);
  const [files, setFiles] = useState<string[]>([]);
  const previewBody = useDeferredValue(body);
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const handled = useRef<number | undefined>(undefined);
  const savedHandled = useRef<number | undefined>(undefined);
  const listFiles = () => setFiles([...(fileInput.current?.files ?? []), ...(imageInput.current?.files ?? [])].map((f) => f.name));
  useEffect(() => {
    if (saved.at && saved.at !== savedHandled.current) {
      savedHandled.current = saved.at;
      form.current?.querySelectorAll<HTMLInputElement>("input[type=file]").forEach((input) => { input.value = ""; });
      setFiles([]);
    }
  }, [saved.at]);
  useEffect(() => {
    if (state.ok && state.at !== handled.current) {
      handled.current = state.at;
      form.current?.reset();
      setBody("");
      router.push(sentHref as Route);
    }
  }, [state, router, sentHref]);
  const fromAddress = choices?.find((m) => m.id === fromBox)?.address ?? from;
  const crossBox = fromBox !== sourceBox;
  return (
    <form ref={form} action={action} className="mail-composer adm-rise">
      {dialog ? (
        <OutreachDialog
          key={dialog.warning.ack}
          warning={dialog.warning}
          onContinue={() => { sendKey.current = null; setConsent(dialog.warning.ack); setLocked(false); setDialog(null); }}
          onCancel={() => { setDialog(null); if (dialog.atOpen) router.push(cancelHref as Route); }}
        />
      ) : null}
      <input type="hidden" name="crmAck" value={consent} />
      <input type="hidden" name="box" value={fromBox} />
      <input type="hidden" name="sourceBox" value={sourceBox} />
      <fieldset className="mail-composer-fields" disabled={locked}>
      {reply ? (
        <>
          <input type="hidden" name="replyFolder" value={reply.folder} />
          <input type="hidden" name="replyUid" value={reply.uid} />
        </>
      ) : null}
      <input type="hidden" name="draftUid" value={activeDraftUid} />
      <div className="mail-composer-head">
        <span className="mail-composer-title"><MailIcon name={reply ? "reply" : "write"} size={18} />{title ?? (reply ? "Rispondi" : "Nuova email")}</span>
        <Link className="mail-icon-btn" href={cancelHref as Route} aria-label="Chiudi" title="Chiudi"><MailIcon name="close" size={16} /></Link>
      </div>
      <div className="mail-compose-rows">
        <div className="mail-compose-row">
          <label htmlFor="compose-from">Da</label>
          {choices && choices.length > 1 ? (
            <span className="mail-select-wrap">
              <select id="compose-from" className="mail-select" value={fromBox} onChange={(e) => setFromBox(e.target.value as MailboxId)}>
                {choices.map((m) => <option key={m.id} value={m.id}>{m.address}</option>)}
              </select>
              <MailIcon name="chevron" size={14} />
            </span>
          ) : <span id="compose-from" className="mail-compose-static">{fromAddress}</span>}
        </div>
        <RecipientField name="to" label="A" initial={draft.to} autoFocus={!reply && !draft.to} onAddCc={showCc ? undefined : () => setShowCc(true)} />
        {showCc ? <RecipientField name="cc" label="Cc" initial={draft.cc} /> : null}
        <div className="mail-compose-row">
          <label htmlFor="compose-subject">Oggetto</label>
          <input id="compose-subject" className="mail-compose-input" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={250} required />
        </div>
      </div>
      <input type="hidden" name="body" value={body} />
      <RichEditor
        key={editorSeed.n}
        initial={editorSeed.body}
        onChange={setBody}
        disabled={locked}
        autoFocus={Boolean(reply)}
        onAttach={() => fileInput.current?.click()}
        onImage={() => imageInput.current?.click()}
        extra={aiContactId ? <GenerateEmailButton contactId={aiContactId} disabled={locked || pending || saving} onFill={(next) => { setSubject(next.subject); setBody(next.body); setEditorSeed((s) => ({ n: s.n + 1, body: next.body })); }} /> : null}
      />
      <input ref={fileInput} className="mail-file-input" name="attachments" type="file" multiple onChange={listFiles} aria-label="Allegati" />
      <input ref={imageInput} className="mail-file-input" name="attachments" type="file" accept="image/*" multiple onChange={listFiles} aria-label="Immagini allegate" />
      {files.length || original || saved.draftUid ? (
        <div className="mail-compose-files">
          {files.map((f, i) => <span key={`${f}:${i}`} className="mail-chip"><MailIcon name="clip" size={12} />{f}</span>)}
          {original || saved.draftUid ? <>
            <input type="hidden" name="originalFolder" value={saved.draftUid ? "drafts" : original!.folder} />
            <input type="hidden" name="originalUid" value={saved.draftUid ?? original!.uid} />
            <label className="mail-keep-files"><input name="keepOriginal" type="checkbox" defaultChecked={!crossBox} disabled={crossBox} /> Mantieni gli allegati {saved.draftUid ? "della bozza salvata" : `originali (${original!.files})`}{crossBox ? " (solo dalla stessa casella)" : ""}</label>
          </> : null}
          <span className="adm-muted">Massimo 10 file, 3 MB complessivi</span>
        </div>
      ) : null}
      <div className="mail-composer-foot">
        <button type="button" className="mail-pill-btn" aria-expanded={preview} onClick={() => setPreview((v) => !v)}><MailIcon name="eye" size={15} />{preview ? "Nascondi anteprima" : "Mostra anteprima"}<MailIcon name="chevron" size={13} /></button>
        <p role="status" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? (state.warning && !consent ? "Non inviata: leggi l'avviso sul contatto." : null) ?? state.ok ?? saved.error ?? saved.ok ?? ""}</p>
        {saved.draftUid ? <Link className="adm-link" href={`/admin/email?${fromBox !== "hello" ? `box=${fromBox}&` : ""}f=drafts&m=${saved.draftUid}` as Route}>Apri bozza salvata</Link> : null}
        <button type="submit" formAction={saveAction} formNoValidate className="mail-text-btn" disabled={pending || saving}>{saving ? "Salvataggio…" : "Salva bozza"}</button>
        <button className="mail-btn mail-btn-primary" disabled={pending || saving}><MailIcon name="send" size={15} />{pending ? "Invio…" : "Invia"}</button>
      </div>
      </fieldset>
      {preview ? (
        <section className="mail-preview" aria-label="Anteprima destinatario">
          <header><span><MailIcon name="eye" size={15} />Anteprima destinatario</span><span className="mail-preview-badge">HTML</span></header>
          <div className="mail-preview-body">
            <MailFrame doc={emailDocument(brandedEmail(previewBody, { sender }).html, false)} title="Anteprima dell'email" />
          </div>
        </section>
      ) : null}
    </form>
  );
}
