import "server-only";
import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from "imapflow";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { brandedEmail } from "@/lib/mail/template";
import MailComposer from "nodemailer/lib/mail-composer";
import {
  MAX_SOURCE_BYTES, MailError, PAGE_SIZE, messageKey, parseSource, pickAttachment, replyContextOf, toMessage,
  type ViewQuery, type MailProvider, type MailboxView, type OutgoingMail,
} from "@/lib/mail/provider";
import type { FolderId, MailSummary, MailLabel, MailMutation } from "@/lib/mail/types";

/** user/pass authenticate IMAP+SMTP; fromAddress is the visible sender (MAIL_FROM alias, else user). */
type Creds = { user: string; pass: string; fromName: string; fromAddress: string };

const IMAP = { host: "imap.gmail.com", port: 993 };
const SMTP = { host: "smtp.gmail.com", port: 465 };
/** Gmail folder roles; the actual (localized) paths are discovered once per instance via SPECIAL-USE. */
const ROLE = { sent: "\\Sent", drafts: "\\Drafts", spam: "\\Junk", all: "\\All", trash: "\\Trash" } as const;

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
    starred: m.flags?.has("\\Flagged") ?? false,
    labels: [...(m.labels ?? [])].filter((label) => !label.startsWith("\\")),
    seen: m.flags?.has("\\Seen") ?? false,
    hasAttachments: hasAttachment(m.bodyStructure),
    threadId: m.threadId ?? null,
  };
}

const LIST_QUERY = { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true, threadId: true, labels: true } as const;

export class ImapProvider implements MailProvider {
  private clients = new Set<{ client: ImapFlow; busy: boolean; expiresAt: number; timer?: ReturnType<typeof setTimeout> }>();
  private catalog: { expiresAt: number; labels: MailLabel[]; folders: MailboxView["folders"] } | null = null;
  private paths: Partial<Record<FolderId, string>> | null = null;
  // Metadata only: never retain message bodies or attachments here. Bounded per account,
  // expires after 15 seconds, and is bypassed for a fresh folder/manual refresh.
  private overview = new Map<string, {
    expiresAt: number;
    folders: MailboxView["folders"];
    list: MailSummary[];
    total: number;
  }>();

  constructor(private creds: Creds) {}

  private async withClient<T>(run: (client: ImapFlow) => Promise<T>): Promise<T> {
    // Keep at most two idle connections in a warm instance. Concurrent overflow
    // uses a short connection; expired/frozen sockets are never leased again.
    for (const entry of this.clients) {
      if (!entry.busy && (!entry.client.usable || entry.expiresAt <= Date.now())) {
        clearTimeout(entry.timer); entry.client.close(); this.clients.delete(entry);
      }
    }
    let lease = [...this.clients].find((entry) => !entry.busy);
    const retained = Boolean(lease) || this.clients.size < 2;
    if (!lease) {
      const client = new ImapFlow({ ...IMAP, secure: true, auth: { user: this.creds.user, pass: this.creds.pass }, logger: false, disableAutoIdle: true, connectionTimeout: 8_000, greetingTimeout: 6_000, socketTimeout: 20_000 });
      client.on("error", () => {});
      lease = { client, busy: true, expiresAt: 0, timer: undefined };
      if (retained) this.clients.add(lease);
      try { await client.connect(); }
      catch (error) {
        this.clients.delete(lease); client.close();
        throw (error as { authenticationFailed?: boolean })?.authenticationFailed
          ? new MailError("auth", "Gmail ha rifiutato l'accesso: controlla la password per le app.")
          : new MailError("network", "Impossibile raggiungere Gmail in questo momento.");
      }
    }
    lease.busy = true;
    clearTimeout(lease.timer);
    try { return await run(lease.client); }
    catch (error) { lease.client.close(); this.clients.delete(lease); throw error; }
    finally {
      lease.busy = false;
      if (retained && lease.client.usable) {
        lease.expiresAt = Date.now() + 15_000;
        const released = lease;
        lease.timer = setTimeout(() => { released.client.close(); this.clients.delete(released); }, 15_000);
        lease.timer.unref();
      } else { lease.client.close(); this.clients.delete(lease); }
    }
  }

  private async loadCatalog(client: ImapFlow) {
    if (this.catalog && this.catalog.expiresAt > Date.now()) return this.catalog;
    // Full LIST processing assigns specialUse; listOnly returns before that step.
    // No statusQuery: avoid per-folder STATUS round trips.
    const boxes = await client.list();
    const inbox = boxes.find((box) => box.path === "INBOX");
    if (inbox) inbox.status = (await client.status("INBOX", { messages: true, unseen: true })) || undefined;
    this.paths = { inbox: "INBOX" };
    for (const [id, role] of Object.entries(ROLE)) {
      this.paths[id as FolderId] = boxes.find((box) => box.specialUse === role)?.path;
    }
    const ids = ["inbox", "sent", "drafts", "all", "spam", "trash"] as const;
    const folders = ids.flatMap((id) => {
      const box = boxes.find((b) => b.path === this.paths?.[id]);
      return box ? [{ id, unread: box.status?.unseen ?? 0, total: box.status?.messages ?? 0 }] : [];
    });
    const labels: MailLabel[] = boxes.filter((box) => !box.specialUse && box.path !== "INBOX" && !box.flags.has("\\Noselect"))
      .map((box) => ({ id: `label:${box.path}`, name: box.path, unread: box.status?.unseen ?? 0, total: box.status?.messages ?? 0 }));
    this.catalog = { expiresAt: Date.now() + 15_000, folders, labels };
    return this.catalog;
  }

  private async path(client: ImapFlow, folder: FolderId): Promise<string | null> {
    if (folder === "inbox") return "INBOX";
    const catalog = await this.loadCatalog(client);
    if (folder.startsWith("label:")) return catalog.labels.some((l) => l.id === folder) ? folder.slice(6) : null;
    return this.paths?.[folder === "starred" ? "all" : folder] ?? null;
  }

  async view({ folder, page, open, search = "", category }: ViewQuery): Promise<MailboxView> {
    return this.withClient(async (client) => {
      const cacheKey = JSON.stringify([folder, page, search, category]);
      for (const [key, entry] of this.overview) {
        if (entry.expiresAt <= Date.now()) this.overview.delete(key);
      }
      if (!open) this.catalog = null;
      const catalog = await this.loadCatalog(client);
      const cached = open ? this.overview.get(cacheKey) : undefined;
      const folders = catalog.folders;
      const path = await this.path(client, folder);
      if (!path) throw new MailError("notfound", "Cartella non disponibile.");

      let list: MailSummary[] = [];
      let total = 0;
      let opened: MailboxView["open"] = null;
      let threadId: string | null = null;
      const lock = await client.getMailboxLock(path, { readOnly: true });
      try {
        total = client.mailbox ? client.mailbox.exists : 0;
        const raw = [search ? `(${search})` : "", category && folder === "inbox" ? `category:${category}` : "", folder === "starred" ? "is:starred" : ""].filter(Boolean).join(" ");
        if (cached) {
          list = cached.list;
          total = cached.total;
        } else if (raw) {
          const matches = await client.search({ gmraw: raw }, { uid: true });
          const uids = (matches || []).sort((a, b) => b - a);
          total = uids.length;
          const slice = uids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
          if (slice.length) list = (await client.fetchAll(slice.join(","), LIST_QUERY, { uid: true })).map((m) => summary(folder, m)).sort((a, b) => b.uid - a.uid);
        } else {
          const end = total - (page - 1) * PAGE_SIZE;
          if (end >= 1) list = (await client.fetchAll(`${Math.max(1, end - PAGE_SIZE + 1)}:${end}`, LIST_QUERY)).map((m) => summary(folder, m)).reverse();
        }
        if (!cached) {
          if (this.overview.size >= 12) this.overview.delete(this.overview.keys().next().value!);
          this.overview.set(cacheKey, { expiresAt: Date.now() + 15_000, folders, list, total });
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
      return { labels: catalog.labels, folders, list, total, open: opened, thread };
    });
  }

  async createLabel(name: string) {
    await this.withClient(async (client) => { await client.mailboxCreate(name); });
    this.catalog = null;
    this.overview.clear();
  }

  async mutate(folder: FolderId, uids: number[], operation: MailMutation, label?: string) {
    await this.withClient(async (client) => {
      const source = await this.path(client, folder);
      if (!source) throw new MailError("notfound", "Cartella non disponibile.");
      if ((operation === "label" || operation === "unlabel") && !(await this.loadCatalog(client)).labels.some((l) => l.name === label)) {
        throw new MailError("notfound", "Etichetta non disponibile. Aggiorna la casella.");
      }
      const destination = operation === "archive" && folder === "inbox"
        ? await this.path(client, "all")
        : operation === "trash" || operation === "spam" || operation === "inbox" ? await this.path(client, operation) : null;
      if ((["trash", "spam", "inbox"].includes(operation) || (operation === "archive" && folder === "inbox")) && !destination) {
        throw new MailError("notfound", "Cartella Gmail di destinazione non disponibile. Controlla che sia visibile in IMAP e aggiorna la casella.");
      }
      const lock = await client.getMailboxLock(source);
      try {
        const range = uids.join(",");
        let ok: unknown;
        if (destination) ok = await client.messageMove(range, destination, { uid: true });
        else if (operation === "archive") ok = await client.messageFlagsRemove(range, ["\\Inbox"], { uid: true, useLabels: true });
        else if (operation === "read" || operation === "unread") ok = await client[operation === "read" ? "messageFlagsAdd" : "messageFlagsRemove"](range, ["\\Seen"], { uid: true });
        else if (operation === "star" || operation === "unstar") ok = await client[operation === "star" ? "messageFlagsAdd" : "messageFlagsRemove"](range, ["\\Flagged"], { uid: true });
        else if (label && (operation === "label" || operation === "unlabel")) ok = await client[operation === "label" ? "messageFlagsAdd" : "messageFlagsRemove"](range, [label], { uid: true, useLabels: true });
        if (!ok) throw new MailError("network", "Operazione non riuscita. Aggiorna la casella e riprova.");
      } finally { lock.release(); }
    });
    this.overview.clear();
    this.catalog = null;
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
      // Several cached searches may reference the same message/catalog.
      // Update each list, but adjust each shared counter just once.
      const counters = new Set<MailboxView["folders"]>();
      for (const entry of this.overview.values()) {
        const item = entry.list.find((m) => m.folder === folder && m.uid === uid);
        if (item && item.seen !== seen) { item.seen = seen; counters.add(entry.folders); }
      }
      for (const folders of counters) {
        const box = folders.find((f) => f.id === folder);
        if (box) box.unread = Math.max(0, box.unread + (seen ? -1 : 1));
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

  private async outgoingAttachments(mail: OutgoingMail) {
    const existing = mail.attachmentsFrom ? await this.source(mail.attachmentsFrom.folder, mail.attachmentsFrom.uid) : null;
    if (mail.attachmentsFrom && !existing) throw new MailError("notfound", "Messaggio originale non disponibile: gli allegati non possono essere recuperati.");
    return [...(existing?.attachments.map((a) => ({ filename: a.filename || "allegato", contentType: a.contentType, content: a.content, cid: a.cid })) ?? []), ...(mail.attachments ?? [])];
  }

  async saveDraft(mail: OutgoingMail, previousUid?: number): Promise<number> {
    const attachments = await this.outgoingAttachments(mail);
    const source = await new MailComposer({ from: { name: this.creds.fromName, address: this.creds.fromAddress }, to: mail.to, cc: mail.cc, subject: mail.subject, ...brandedEmail(mail.text), attachments, inReplyTo: mail.inReplyTo ?? undefined, references: mail.references }).compile().build();
    return this.withClient(async (client) => {
      const path = await this.path(client, "drafts");
      if (!path) throw new MailError("notfound", "Cartella bozze non disponibile.");
      const result = await client.append(path, source, ["\\Draft"]);
      if (!result || !result.uid) throw new MailError("network", "Salvataggio bozza non confermato. Aggiorna la cartella Bozze.");
      // Preserve the old draft in Trash until the replacement has been saved.
      if (previousUid) {
        const trash = await this.path(client, "trash");
        if (trash) {
          const lock = await client.getMailboxLock(path);
          try { await client.messageMove(String(previousUid), trash, { uid: true }); }
          finally { lock.release(); }
        }
      }
      this.overview.clear(); this.catalog = null;
      return result.uid;
    });
  }

  /**
   * With RESEND_API_KEY + MAIL_FROM: submit through Resend SMTP (DKIM signed for the MAIL_FROM domain, no "via gmail.com"),
   * then APPEND the exact same raw message to Gmail's Sent folder so Inviati and threading keep working.
   * Returns null if Resend is not configured or refused the message (caller falls back to Gmail SMTP).
   */
  private async sendViaResend(mail: OutgoingMail, attachments: Awaited<ReturnType<ImapProvider["outgoingAttachments"]>>): Promise<{ messageId: string } | null> {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key || !process.env.MAIL_FROM?.trim()) return null;
    const domain = this.creds.fromAddress.split("@")[1] || "ctrlagency.dev";
    const messageId = `<${randomUUID()}@${domain}>`;
    const raw = await new MailComposer({
      from: { name: this.creds.fromName, address: this.creds.fromAddress },
      to: mail.to,
      cc: mail.cc.length ? mail.cc : undefined,
      subject: mail.subject,
      ...brandedEmail(mail.text, { cta: mail.cta }),
      attachments,
      messageId,
      date: new Date(),
      inReplyTo: mail.inReplyTo ?? undefined,
      references: mail.references?.length ? mail.references : undefined,
    }).compile().build();
    const transport = nodemailer.createTransport({
      host: "smtp.resend.com", port: 465, secure: true, auth: { user: "resend", pass: key },
      connectionTimeout: 8_000, greetingTimeout: 6_000, socketTimeout: 20_000,
    });
    try {
      await transport.sendMail({ envelope: { from: this.creds.fromAddress, to: [...mail.to, ...mail.cc] }, raw });
    } catch {
      console.warn("[mail] Resend SMTP non riuscito, uso Gmail");
      return null;
    } finally {
      transport.close();
    }
    // Already delivered: a failed copy in Inviati must not report the send as failed.
    try {
      await this.withClient(async (client) => {
        const path = await this.path(client, "sent");
        if (path) await client.append(path, raw, ["\\Seen"]);
      });
      this.overview.clear(); this.catalog = null;
    } catch {
      console.warn("[mail] copia in Inviati non salvata");
    }
    return { messageId };
  }

  async send(mail: OutgoingMail) {
    const attachments = await this.outgoingAttachments(mail);
    const viaResend = await this.sendViaResend(mail, attachments);
    if (viaResend) return viaResend;
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
        from: { name: this.creds.fromName, address: this.creds.fromAddress },
        envelope: { from: this.creds.fromAddress, to: [...mail.to, ...mail.cc] },
        attachments,
        to: mail.to,
        cc: mail.cc.length ? mail.cc : undefined,
        subject: mail.subject,
        // multipart/alternative: branded HTML + the same words as plain text. Gmail files this exact MIME in Inviati.
        ...brandedEmail(mail.text, { cta: mail.cta }),
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
