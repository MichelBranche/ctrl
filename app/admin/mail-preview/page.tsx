import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MailSnapshotView } from "@/components/admin/email/mail-speed";
import type { ListSnap } from "@/lib/mail/list-memory";

export const metadata: Metadata = { title: "Anteprima posta", robots: { index: false, follow: false } };

const FIXTURE: ListSnap = {
  total: 3,
  folders: [
    { id: "inbox", unread: 2, total: 3 },
    { id: "sent", unread: 0, total: 1 },
    { id: "drafts", unread: 0, total: 0 },
  ],
  labels: [],
  list: [
    { folder: "inbox", uid: 3, key: "k3", from: { name: "Studio Nord", address: "nord@example.test" }, to: [], subject: "Bozza homepage — feedback", date: "2026-11-07T09:12:00.000Z", seen: false, hasAttachments: false, threadId: null },
    { folder: "inbox", uid: 2, key: "k2", from: { name: "Fatture Example", address: "billing@example.test" }, to: [], subject: "Fattura 1842", date: "2026-11-06T16:40:00.000Z", seen: false, hasAttachments: true, threadId: null },
    { folder: "inbox", uid: 1, key: "k1", from: { name: "Newsletter Example", address: "news@example.test" }, to: [], subject: "Novità di novembre", date: "2026-11-05T08:00:00.000Z", seen: true, hasAttachments: false, threadId: null },
  ],
};

/** Local fixture only. Production returns 404. No mailbox credentials are read. */
export default function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={<main className="adm-main adm-mail-main"><p className="adm-muted">Apertura…</p></main>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const state = (await searchParams).state;
  const mode = state === "cached" || state === "ready" || state === "error" ? state : "loading";
  return (
    <main className="adm-main adm-mail-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Posta</h1>
          <p className="adm-muted">Anteprima locale con messaggi finti · {mode}</p>
        </div>
      </header>
      {mode === "loading" ? <MailSnapshotView snap={null} busy /> : null}
      {mode === "cached" ? <MailSnapshotView snap={FIXTURE} busy note="Lista salvata in questa sessione. Aggiornamento in corso…" /> : null}
      {mode === "ready" ? <MailSnapshotView snap={FIXTURE} note="Aggiornata adesso." /> : null}
      {mode === "error" ? <MailSnapshotView snap={FIXTURE} warning="Impossibile raggiungere Gmail in questo momento." /> : null}
    </main>
  );
}
