"use client";

import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { markOpened, markUnread, sendMail, saveMailDraft, toggleClaim, type SendState } from "@/app/admin/email-actions";

const POLL_MS = 30_000;

/** Feedback belongs inside the Link, so it follows the latest navigation. */
export function MailOpening({ label = "Apertura email…" }: { label?: string }) {
  const { pending } = useLinkStatus();
  return <span className="adm-mail-opening" role="status">{pending ? label : ""}</span>;
}

/** Re-renders the inbox from the server every ~30s while the tab is visible, plus a manual refresh. */
export function MailLive({ renderedAt }: { renderedAt: number }) {
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
  const time = new Date(renderedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="adm-mail-live" aria-live="polite">
      <span className="adm-muted">
        <span className="adm-pill-dot" data-busy={pending || undefined} aria-hidden="true" /> {pending ? "Aggiornamento…" : `Aggiornata alle ${time}`}
      </span>
      <button type="button" className="adm-btn adm-btn-sm" onClick={() => start(() => router.refresh())} disabled={pending}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={pending ? "adm-spin" : undefined}>
          <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
        </svg>
        Aggiorna
      </button>
    </div>
  );
}

/** Marks the opened message as read (IMAP \Seen + "letta da") once it is actually shown, never on prefetch. */
export function MarkOpened({ folder, uid, mkey }: { folder: string; uid: number; mkey: string }) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    const id = `${folder}:${uid}`;
    if (done.current === id) return;
    done.current = id;
    // A full refresh here redownloaded the newly opened message and could race
    // the next click. The scheduled refresh reconciles read/collaboration state.
    markOpened(folder, uid, mkey).then(() => { window.dispatchEvent(new Event("ctrl-mail-changed")); }, () => {});
  }, [folder, uid, mkey]);
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
      const body = frame.contentDocument?.body;
      if (!body) return;
      setHeight(Math.min(Math.max(body.scrollHeight + 4, 120), 6000));
      ro?.disconnect();
      ro = new ResizeObserver(() => setHeight(Math.min(Math.max(body.scrollHeight + 4, 120), 6000)));
      ro.observe(body);
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
      className={`adm-btn adm-btn-sm${mine ? "" : " adm-btn-primary"}`}
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
      {pending ? "…" : mine ? "Rilascia" : other ? `Prendi tu (ora: ${other})` : "Prendi in carico"}
    </button>
    {error ? <span className="adm-error" role="alert">{error}</span> : null}
  </span>;
}

export function UnreadButton({ folder, uid, href }: { folder: string; uid: number; href: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="adm-btn adm-btn-sm"
      disabled={pending}
      onClick={() => start(async () => {
        await markUnread(folder, uid);
        router.push(href as Route);
      })}
    >
      Segna come non letta
    </button>
  );
}

type Draft = { to: string; cc: string; subject: string; body: string };

export function ComposeForm({ draft, reply, from, cancelHref, original, draftUid = 0 }: { original?: { folder: string; uid: number; files: number }; draftUid?: number; draft: Draft; reply: { folder: string; uid: number } | null; from: string; cancelHref: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SendState, FormData>(sendMail, {});
  const [saved, saveAction, saving] = useActionState<SendState, FormData>(async (previous, data) => {
    const result = await saveMailDraft(previous, data);
    return { ...result, draftUid: result.draftUid ?? previous.draftUid };
  }, {});
  const activeDraftUid = saved.draftUid ?? draftUid;
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const form = useRef<HTMLFormElement>(null);
  const handled = useRef<number | undefined>(undefined);
  const savedHandled = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (saved.at && saved.at !== savedHandled.current) {
      savedHandled.current = saved.at;
      const upload = form.current?.elements.namedItem("attachments") as HTMLInputElement | null;
      if (upload) upload.value = "";
    }
  }, [saved.at]);
  useEffect(() => {
    if (state.ok && state.at !== handled.current) {
      handled.current = state.at;
      form.current?.reset();
      router.push("/admin/email?f=sent" as Route);
    }
  }, [state, router]);
  return (
    <form ref={form} action={action} className="adm-form adm-mail-compose adm-rise">
      {reply ? (
        <>
          <input type="hidden" name="replyFolder" value={reply.folder} />
          <input type="hidden" name="replyUid" value={reply.uid} />
        </>
      ) : null}
      <input type="hidden" name="draftUid" value={activeDraftUid} />
      {original || saved.draftUid ? <>
        <input type="hidden" name="originalFolder" value={saved.draftUid ? "drafts" : original!.folder} />
        <input type="hidden" name="originalUid" value={saved.draftUid ?? original!.uid} />
        <label className="mail-keep-files"><input name="keepOriginal" type="checkbox" defaultChecked /> Mantieni gli allegati {saved.draftUid ? "della bozza salvata" : `originali (${original!.files})`}</label>
      </> : null}
      <p className="adm-muted">Da: <strong>{from}</strong></p>
      <label className="adm-field">
        <span>A</span>
        <input className="adm-input" name="to" defaultValue={draft.to} required autoComplete="off" placeholder="nome@esempio.it, …" />
      </label>
      {showCc ? (
        <label className="adm-field">
          <span>Cc</span>
          <input className="adm-input" name="cc" defaultValue={draft.cc} autoComplete="off" />
        </label>
      ) : (
        <button type="button" className="adm-link adm-mail-cc" onClick={() => setShowCc(true)}>+ Cc</button>
      )}
      <label className="adm-field">
        <span>Oggetto</span>
        <input className="adm-input" name="subject" defaultValue={draft.subject} maxLength={250} required />
      </label>
      <label className="adm-field">
        <span>Messaggio</span>
        <textarea className="adm-input" name="body" defaultValue={draft.body} rows={12} required autoFocus={Boolean(reply)} />
      </label>
      <label className="adm-field"><span>Allegati · massimo 10 file, 3 MB complessivi</span><input className="adm-input" name="attachments" type="file" multiple /></label>
      <div className="adm-row-actions">
        <button className="adm-btn adm-btn-primary" disabled={pending || saving}>{pending ? "Invio…" : "Invia"}</button>
        <button type="submit" formAction={saveAction} formNoValidate className="adm-btn" disabled={pending || saving}>{saving ? "Salvataggio…" : "Salva bozza"}</button>
        {saved.draftUid ? <Link className="adm-link" href={`/admin/email?f=drafts&m=${saved.draftUid}` as Route}>Apri bozza salvata</Link> : null}
        <Link className="adm-btn" href={cancelHref as Route}>Chiudi</Link>
        <p role="status" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? state.ok ?? saved.error ?? saved.ok ?? ""}</p>
      </div>
    </form>
  );
}
