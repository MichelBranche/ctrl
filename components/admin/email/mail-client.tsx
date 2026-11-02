"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { markOpened, markUnread, sendMail, toggleClaim, type SendState } from "@/app/admin/email-actions";

const POLL_MS = 30_000;

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
  const router = useRouter();
  const done = useRef<string | null>(null);
  useEffect(() => {
    const id = `${folder}:${uid}`;
    if (done.current === id) return;
    done.current = id;
    markOpened(folder, uid, mkey).then(() => { router.refresh(); window.dispatchEvent(new Event("ctrl-mail-changed")); }, () => {});
  }, [folder, uid, mkey, router]);
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
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`adm-btn adm-btn-sm${mine ? "" : " adm-btn-primary"}`}
      disabled={pending}
      onClick={() => start(async () => {
        await toggleClaim(mkey, !mine);
        router.refresh();
      })}
    >
      {pending ? "…" : mine ? "Rilascia" : other ? `Prendi tu (ora: ${other})` : "Prendi in carico"}
    </button>
  );
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

export function ComposeForm({ draft, reply, from, cancelHref }: { draft: Draft; reply: { folder: string; uid: number } | null; from: string; cancelHref: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SendState, FormData>(sendMail, {});
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const form = useRef<HTMLFormElement>(null);
  const handled = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.ok && state.at !== handled.current) {
      handled.current = state.at;
      form.current?.reset();
      router.refresh();
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
      <div className="adm-row-actions">
        <button className="adm-btn adm-btn-primary" disabled={pending}>{pending ? "Invio…" : "Invia"}</button>
        <Link className="adm-btn" href={cancelHref as Route}>Annulla</Link>
        <p role="status" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? state.ok ?? ""}</p>
      </div>
    </form>
  );
}
