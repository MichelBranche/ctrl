import "server-only";
import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from "imapflow";
import nodemailer from "nodemailer";
import {
  MAX_SOURCE_BYTES, MailError, PAGE_SIZE, messageKey, parseSource, pickAttachment, replyContextOf, toMessage,
  type MailProvider, type MailboxView, type OutgoingMail,
} from "@/lib/mail/provider";
import type { FolderId, MailSummary } from "@/lib/mail/types";

type Creds = { user: string; pass: string; fromName: string };

const IMAP = { host: "imap.gmail.com", port: 993 };
const SMTP = { host: "smtp.gmail.com", port: 465 };
/** Gmail folder roles; the actual (localized) paths are discovered once per instance via SPECIAL-USE. */
const ROLE: Record<Exclude<FolderId, "inbox">, string> = { sent: "\\Sent", spam: "\\Junk", all: "\\All" };

function hasAttachment(node: MessageStructureObject | undefined): boolean {
  if (!node) return false;
  if (node.disposition === "attachment") return true;
  return (node.childNodes ?? []).some(hasAttachment);
}

function isoDate(v: Date | string | undefined): string {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
}

function summary(folder: FolderId, m: FetchMessageObject): MailSummary {
  const env = m.envelope;
  const from = env?.from?.[0];
  return {
    folder,
    uid: m.uid,
    key: messageKey(env?.messageId, `${folder}:${m.uid}`),
    from: from ? { name: from.name ?? "", address: from.address ?? "" } : null,
    to: (env?.to ?? []).map((a) => ({ name: a.name ?? "", address: a.address ?? "" })),
    subject: env?.subject ?? "",
    date: isoDate(env?.date ?? m.internalDate),
    seen: m.flags?.has("\\Seen") ?? false,
    hasAttachments: hasAttachment(m.bodyStructure),
    threadId: m.threadId ?? null,
  };
}

const LIST_QUERY = { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true, threadId: true } as const;

export class ImapProvider implements MailProvider {
  private static paths: Partial<Record<FolderId, string>> | null = null;

  constructor(private creds: Creds) {}

  private async withClient<T>(run: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = new ImapFlow({
      ...IMAP,
      secure: true,
      auth: { user: this.creds.user, pass: this.creds.pass },
      logger: false,
      disableAutoIdle: true,
      connectionTimeout: 8_000,
      greetingTimeout: 6_000,
      socketTimeout: 20_000,
    });
    client.on("error", () => {}); // socket errors surface through the pending command instead
    try {
      await client.connect();
    } catch (error) {
      const e = error as { authenticationFailed?: boolean };
      throw e?.authenticationFailed
        ? new MailError("auth", "Gmail ha rifiutato l'accesso: controlla la password per le app.")
        : new MailError("network", "Impossibile raggiungere Gmail in questo momento.");
    }
    try {
      return await run(client);
    } finally {
      await client.logout().catch(() => client.close());
    }
  }

  private async path(client: ImapFlow, folder: FolderId): Promise<string | null> {
    if (folder === "inbox") return "INBOX";
    if (!ImapProvider.paths) {
      const boxes = await client.list();
      const found: Partial<Record<FolderId, string>> = { inbox: "INBOX" };
      for (const [id, role] of Object.entries(ROLE) as [FolderId, string][]) found[id] = boxes.find((b) => b.specialUse === role)?.path;
      ImapProvider.paths = found;
    }
    return ImapProvider.paths[folder] ?? null;
  }

  async view({ folder, page, open }: { folder: FolderId; page: number; open?: number | null }): Promise<MailboxView> {
    return this.withClient(async (client) => {
      const folders = [];
      for (const id of ["inbox", "sent", "spam"] as const) {
        const p = await this.path(client, id);
        if (!p) continue;
        const st = await client.status(p, { messages: true, unseen: true });
        folders.push({ id, unread: st ? st.unseen ?? 0 : 0, total: st ? st.messages ?? 0 : 0 });
      }
      const path = await this.path(client, folder);
      if (!path) throw new MailError("notfound", "Cartella non disponibile.");

      let list: MailSummary[] = [];
      let total = 0;
      let opened: MailboxView["open"] = null;
      let threadId: string | null = null;
      const lock = await client.getMailboxLock(path, { readOnly: true });
      try {
        total = client.mailbox ? client.mailbox.exists : 0;
        const end = total - (page - 1) * PAGE_SIZE;
        if (end >= 1) {
          const start = Math.max(1, end - PAGE_SIZE + 1);
          list = (await client.fetchAll(`${start}:${end}`, LIST_QUERY)).map((m) => summary(folder, m)).reverse();
        }
        if (open) {
          const head = await client.fetchOne(String(open), { ...LIST_QUERY, size: true }, { uid: true });
          if (head) {
            if ((head.size ?? 0) > MAX_SOURCE_BYTES) throw new MailError("toolarge", "Messaggio troppo grande da aprire qui: aprilo in Gmail.");
            const full = await client.fetchOne(String(open), { uid: true, source: true }, { uid: true });
            const base = summary(folder, head);
            threadId = base.threadId;
            if (full && full.source) opened = toMessage(await parseSource(full.source), base);
          }
        }
      } finally {
        lock.release();
      }

      let thread: MailSummary[] = [];
      const allPath = threadId ? await this.path(client, "all") : null;
      if (threadId && allPath) {
        const tl = await client.getMailboxLock(allPath, { readOnly: true });
        try {
          const uids = await client.search({ threadId }, { uid: true });
          if (uids && uids.length > 1) {
            thread = (await client.fetchAll(uids.slice(-20).join(","), LIST_QUERY, { uid: true })).map((m) => summary("all", m));
            thread.sort((a, b) => a.date.localeCompare(b.date));
          }
        } finally {
          tl.release();
        }
      }
      return { folders, list, total, open: opened, thread };
    });
  }

  async unread(): Promise<number> {
    return this.withClient(async (client) => {
      const st = await client.status("INBOX", { unseen: true });
      return st ? st.unseen ?? 0 : 0;
    });
  }

  async setSeen(folder: FolderId, uid: number, seen: boolean): Promise<void> {
    await this.withClient(async (client) => {
      const path = await this.path(client, folder);
      if (!path) return;
      const lock = await client.getMailboxLock(path);
      try {
        if (seen) await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        else await client.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
      } finally {
        lock.release();
      }
    });
  }

  private async source(folder: FolderId, uid: number) {
    return this.withClient(async (client) => {
      const path = await this.path(client, folder);
      if (!path) return null;
      const lock = await client.getMailboxLock(path, { readOnly: true });
      try {
        const head = await client.fetchOne(String(uid), { uid: true, size: true }, { uid: true });
        if (!head) return null;
        if ((head.size ?? 0) > MAX_SOURCE_BYTES) throw new MailError("toolarge", "Messaggio troppo grande.");
        const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
        return msg && msg.source ? parseSource(msg.source) : null;
      } finally {
        lock.release();
      }
    });
  }

  async attachment(folder: FolderId, uid: number, pick: { index?: number; cid?: string }) {
    const parsed = await this.source(folder, uid);
    return parsed ? pickAttachment(parsed, pick) : null;
  }

  async replyContext(folder: FolderId, uid: number) {
    const parsed = await this.source(folder, uid);
    return parsed ? replyContextOf(parsed) : null;
  }

  async send(mail: OutgoingMail) {
    const transport = nodemailer.createTransport({
      ...SMTP,
      secure: true,
      auth: { user: this.creds.user, pass: this.creds.pass },
      connectionTimeout: 8_000,
      greetingTimeout: 6_000,
      socketTimeout: 20_000,
    });
    try {
      // Gmail stores a copy in "Inviati" automatically for SMTP-submitted mail.
      const info = await transport.sendMail({
        from: { name: this.creds.fromName, address: this.creds.user },
        to: mail.to,
        cc: mail.cc.length ? mail.cc : undefined,
        subject: mail.subject,
        text: mail.text,
        inReplyTo: mail.inReplyTo ?? undefined,
        references: mail.references?.length ? mail.references : undefined,
      });
      return { messageId: info.messageId };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      throw code === "EAUTH"
        ? new MailError("auth", "Gmail ha rifiutato l'invio: controlla la password per le app.")
        : new MailError("network", "Invio non riuscito, riprova tra poco.");
    } finally {
      transport.close();
    }
  }
}
