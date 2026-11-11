import { MailPending } from "@/components/admin/email/mail-speed";

/** Shown on the first click, before the mailbox request finishes. Reuses the last list in this tab when there is one. */
export default function Loading() {
  return (
    <main className="adm-main adm-mail-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Posta</h1>
          <p className="adm-muted">Casella condivisa dell&apos;agenzia</p>
        </div>
      </header>
      <MailPending />
    </main>
  );
}
