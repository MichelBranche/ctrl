"use client";

import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { MailIcon } from "@/components/admin/email/mailbox-ui";
import { mailListKey, readMailList, readOwnList, rememberMailList, subscribeMailMemory, type ListSnap } from "@/lib/mail/list-memory";
import { FOLDERS, folderLabel, type FolderId, type MailSummary } from "@/lib/mail/types";

export { clearMailMemory as clearMailList } from "@/lib/mail/list-memory";

const who = (m: MailSummary, sent: boolean) => (sent ? m.to.map((a) => a.name || a.address).join(", ") || "—" : m.from?.name || m.from?.address || "—");

function folderHref(id: string) {
  return (id === "inbox" ? "/admin/email" : `/admin/email?f=${encodeURIComponent(id)}`) as Route;
}

/** Writes the latest headers into tab memory. Bodies are not part of ListSnap. */
export function RememberList({ userId, folder, page, search, category, snap }: {
  userId: string; folder: string; page: number; search: string; category: string; snap: ListSnap;
}) {
  useEffect(() => {
    rememberMailList(userId, mailListKey(folder, page, search, category), snap);
  }, [userId, folder, page, search, category, snap]);
  return null;
}

/** After a stale paint, ask the server once more so the background IMAP refresh can land. */
export function MailCatchUp({ freshness }: { freshness?: string }) {
  const router = useRouter();
  const tries = useRef(0);
  useEffect(() => {
    if (freshness !== "stale") {
      tries.current = 0;
      return;
    }
    if (tries.current >= 2) return;
    const timer = window.setTimeout(() => {
      tries.current += 1;
      router.refresh();
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [freshness, router]);
  return null;
}

export function NavPending({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <span className="adm-side-text">{label}{pending ? "…" : ""}</span>;
}

function Rows({ list, sent }: { list: MailSummary[]; sent: boolean }) {
  if (!list.length) return <p className="adm-empty">Nessun messaggio in memoria per questa cartella.</p>;
  return (
    <ul className="adm-mail-items">
      {list.map((m) => (
        <li key={`${m.folder}:${m.uid}`} className="mail-message-row">
          <span className="adm-mail-item" data-unread={!m.seen || undefined}>
            <span className="adm-mail-from">{who(m, sent)}</span>
            <time className="adm-muted" dateTime={m.date}>{m.date.slice(11, 16) || m.date.slice(0, 10)}</time>
            <span className="adm-mail-subject">{m.subject || "(nessun oggetto)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MailSnapshotView({ folder = "inbox", snap, warning, busy = false, note }: {
  folder?: string; snap: ListSnap | null; warning?: string; busy?: boolean; note?: string;
}) {
  const folders = snap?.folders?.length ? snap.folders : FOLDERS.map((id) => ({ id, unread: 0, total: 0 }));
  return (
    <div className="mail-workspace" aria-busy={busy || undefined}>
      <aside className="mail-sidebar" aria-label="Navigazione email">
        <nav aria-label="Cartelle email">
          {folders.map((item) => (
            <Link key={item.id} className="mail-folder" aria-current={item.id === folder ? "page" : undefined} href={folderHref(item.id)}>
              <MailIcon name={item.id === "starred" ? "star" : item.id} />
              <span>{folderLabel(item.id as FolderId)}</span>
              {item.unread ? <b>{item.unread}</b> : null}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="mail-content">
        {warning ? (
          <p className="adm-mail-images" role="alert"><span>{warning}</span> <Link className="adm-link" href={folderHref(folder)}>Riprova</Link></p>
        ) : (
          <p className="adm-mail-images" role="status"><span>{note ?? (snap ? "Lista salvata in questa sessione. Aggiornamento in corso…" : "Apertura della casella…")}</span></p>
        )}
        <section className="adm-panel adm-mail-list" aria-label="Messaggi">
          {snap ? <div className={busy ? "mail-pending" : undefined}><Rows list={snap.list} sent={folder === "sent"} /></div> : (
            <div className="adm-skel" style={{ height: "24rem" }} />
          )}
        </section>
      </div>
    </div>
  );
}

/** Chrome plus the last list for this folder, or a skeleton when this tab has not opened it yet. */
export function MailPending({ userId, folder = "inbox", page = 1, search = "", category = "", warning }: {
  userId?: string; folder?: string; page?: number; search?: string; category?: string; warning?: string;
}) {
  const key = mailListKey(folder, page, search, category);
  const snap = useSyncExternalStore(
    subscribeMailMemory,
    () => (userId ? readMailList(userId, key) : readOwnList(key)),
    () => null,
  );
  return <MailSnapshotView folder={folder} snap={snap} warning={warning} busy />;
}
