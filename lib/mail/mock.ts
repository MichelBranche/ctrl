import "server-only";
import MailComposer from "nodemailer/lib/mail-composer";
import { brandedEmail } from "@/lib/mail/template";
import {
  PAGE_SIZE, parseSource, pickAttachment, replyContextOf, toMessage,
  type ViewQuery, type MailProvider, type MailboxView, type OutgoingMail,
} from "@/lib/mail/provider";
import type { FolderId, MailSummary, MailMutation } from "@/lib/mail/types";

/**
 * Fake mailbox for local development and UI tests (AGENCY_MAIL_MOCK=1, never on Vercel production).
 * Messages are real RFC 822 sources built with nodemailer's composer, so parsing, sanitizing and
 * attachments go through exactly the same code as the IMAP provider. State lives in memory.
 */
type Stored = { folder: FolderId; starred?: boolean; labels?: string[]; uid: number; seen: boolean; threadId: string; date: Date; source: Buffer };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAUElEQVR42u3WsQ0AIAgEQFZwAgdy/3l0ASmNxR+hJOEq+NprXns09Xq+gICA4kC/FnfzQEBAeSCXGggISB7yOoCA5CGXGggISB7yOoCAokEHoHQ+ajbjuNMAAAAASUVORK5CYII=",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const AGENCY = { name: "CTRL", address: "agenzia@example.test" };

type Seed = { folder: Stored["folder"]; seen?: boolean; thread?: string; hoursAgo: number; mail: ConstructorParameters<typeof MailComposer>[0] };

const NEWSLETTER = `<!doctype html><html><head><style>.btn{background:#ff4b1f;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none} body{font-family:Arial}</style>
<script>alert('xss')</script></head><body>
<table width="100%" style="max-width:560px;margin:auto"><tr><td>
<img src="https://cdn.example-news.test/header.png" width="560" alt="Design Weekly">
<h1 style="color:#111">Le 5 tendenze del web design 2027</h1>
<p onclick="steal()">Tipografia variabile, interfacce “calme”, micro-animazioni, colori saturi e siti che si caricano in meno di un secondo.</p>
<p><a class="btn" href="https://news.example.test/leggi?utm=1">Leggi l'articolo</a> <a href="javascript:alert(1)">link sospetto</a></p>
<iframe src="https://evil.example.test"></iframe>
<form action="https://evil.example.test/login"><input name="pw"></form>
<p style="background:url(https://track.example.test/bg.png)">Ricevi questa email perché sei iscritto.</p>
<img src="https://track.example.test/open.gif?id=42" width="1" height="1">
</td></tr></table></body></html>`;

const SEEDS: Seed[] = [
  { folder: "inbox", seen: true, thread: "t-preventivo", hoursAgo: 52, mail: {
    from: '"Laura Bianchi" <laura@studiobianchi.example>', to: AGENCY, subject: "Preventivo sito e-commerce",
    messageId: "<prev-1@studiobianchi.example>",
    text: "Ciao CTRL,\n\nvorremmo rifare il sito dello studio con un piccolo shop (circa 40 prodotti).\nCi mandate un preventivo e i tempi?\n\nGrazie,\nLaura Bianchi\nStudio Bianchi Architetti" } },
  { folder: "sent", seen: true, thread: "t-preventivo", hoursAgo: 30, mail: {
    from: AGENCY, to: '"Laura Bianchi" <laura@studiobianchi.example>', subject: "Re: Preventivo sito e-commerce",
    messageId: "<prev-2@ctrl.example>", inReplyTo: "<prev-1@studiobianchi.example>", references: ["<prev-1@studiobianchi.example>"],
    text: "Ciao Laura,\n\ngrazie! Ti alleghiamo a breve una proposta: sito Next.js + shop, 5-6 settimane.\nPossiamo sentirci giovedì alle 11?\n\nCTRL" } },
  { folder: "inbox", seen: false, thread: "t-preventivo", hoursAgo: 3, mail: {
    from: '"Laura Bianchi" <laura@studiobianchi.example>', to: AGENCY, cc: '"Paolo Bianchi" <paolo@studiobianchi.example>', subject: "Re: Preventivo sito e-commerce",
    messageId: "<prev-3@studiobianchi.example>", inReplyTo: "<prev-2@ctrl.example>", references: ["<prev-1@studiobianchi.example>", "<prev-2@ctrl.example>"],
    text: "Perfetto, giovedì alle 11 va benissimo.\nMetto in copia Paolo che segue la parte amministrativa.\n\nLaura" } },
  { folder: "inbox", seen: false, thread: "t-brief", hoursAgo: 6, mail: {
    from: '"Marco Ferri" <marco@pizzeriaferri.example>', to: AGENCY, subject: "Brief logo pizzeria + foto locale",
    messageId: "<brief@pizzeriaferri.example>",
    html: '<p>Ciao ragazzi,</p><p>ecco il brief per il nuovo logo. Vi metto anche il logo attuale qui sotto:</p><p><img src="cid:logo-attuale" alt="Logo attuale" width="96"></p><p>Il PDF con i riferimenti è in allegato.</p><p>Marco<br><b>Pizzeria Ferri</b></p>',
    text: "Ciao ragazzi, ecco il brief per il nuovo logo. Il PDF è in allegato. Marco",
    attachments: [
      { filename: "logo-attuale.png", content: PNG, cid: "logo-attuale", contentType: "image/png", contentDisposition: "inline" },
      { filename: "Brief logo Pizzeria Ferri.pdf", content: PDF, contentType: "application/pdf" },
    ] } },
  { folder: "inbox", seen: false, thread: "t-news", hoursAgo: 9, mail: {
    from: '"Design Weekly" <news@designweekly.example>', to: AGENCY, subject: "Le 5 tendenze del web design 2027",
    messageId: "<dw-2027@designweekly.example>", html: NEWSLETTER, text: "Le 5 tendenze del web design 2027" } },
  { folder: "inbox", seen: true, thread: "t-foto", hoursAgo: 28, mail: {
    from: '"Giulia Conti" <giulia.conti@cantinaconti.example>', to: AGENCY, subject: "Foto per la pagina Chi siamo",
    messageId: "<foto@cantinaconti.example>",
    text: "Buongiorno,\nin allegato le foto della cantina per la pagina Chi siamo.\nFatemi sapere se servono in risoluzione più alta.\n\nGiulia Conti",
    attachments: [
      { filename: "cantina-esterno.png", content: PNG, contentType: "image/png" },
      { filename: "vigneto.png", content: PNG, contentType: "image/png" },
    ] } },
  { folder: "inbox", seen: true, thread: "t-fattura", hoursAgo: 75, mail: {
    from: '"Aruba" <noreply@aruba.example>', to: AGENCY, subject: "Fattura n. 2026/48113 disponibile",
    messageId: "<fatt@aruba.example>", text: "Gentile cliente, la fattura per il rinnovo del dominio ctrl-agency è disponibile nell'area clienti." } },
  { folder: "inbox", seen: true, thread: "t-call", hoursAgo: 100, mail: {
    from: '"Andrea Russo" <andrea@russofitness.example>', to: AGENCY, subject: "Call per la campagna social di gennaio",
    messageId: "<call@russofitness.example>", text: "Ciao! Possiamo fare una call la prossima settimana per la campagna di gennaio? Siamo liberi martedì e mercoledì pomeriggio.\n\nAndrea" } },
  { folder: "inbox", seen: true, thread: "t-sc", hoursAgo: 130, mail: {
    from: '"Google Search Console" <sc-noreply@google.example>', to: AGENCY, subject: "Nuovo problema di copertura rilevato per ctrl-agency.it",
    messageId: "<sc@google.example>", text: "Search Console ha rilevato 3 pagine con errore 404 su ctrl-agency.it." } },
  { folder: "sent", seen: true, thread: "t-offerta", hoursAgo: 80, mail: {
    from: AGENCY, to: '"Ottica Luce" <info@otticaluce.example>', subject: "Proposta restyling logo",
    messageId: "<offerta@ctrl.example>", text: "Buongiorno,\nin allegato la proposta per il restyling del logo.\n\nCTRL" } },
  // Kallebe's branded send from Gmail: multipart/alternative + inline cid logo, as Gmail keeps it in Inviati.
  { folder: "sent", seen: true, thread: "t-brand", hoursAgo: 20, mail: {
    from: AGENCY, to: '"Ottica Luce" <info@otticaluce.example>', subject: "Benvenuti in Ctrl Agency",
    messageId: "<brand@ctrl.example>", ...(() => {
      const b = brandedEmail("Buongiorno,\n\ngrazie per averci scelto. Nei prossimi giorni vi invieremo:\n- la bozza del nuovo sito\n- il calendario dei contenuti\n\nPer qualsiasi dubbio scriveteci a info@ctrlagency.dev.");
      return { text: b.text, html: b.html.replace(/<td style="font:900 22px[^>]*>C<\/td>/, '<td style="padding-right:10px"><img src="cid:ctrl-logo" alt="C" width="28" height="28" style="display:block"></td>') };
    })(),
    attachments: [{ filename: "ctrl-logo.png", content: PNG, cid: "ctrl-logo", contentType: "image/png", contentDisposition: "inline" }] } },
  // Plain-text only, markdown-ish: must stay readable text with clickable links, never rendered as raw HTML.
  { folder: "inbox", seen: false, thread: "t-md", hoursAgo: 1, mail: {
    from: '"Sara Neri" <sara@neristudio.example>', to: AGENCY, subject: "Note per la landing",
    messageId: "<md@neristudio.example>",
    text: "Ciao!\n\n## Punti chiave\n- **Hero** con video breve\n- Prezzi in evidenza\n- <b>niente</b> popup\n\nRiferimento: https://example.com/brief?id=42\nScrivetemi a sara@neristudio.example\n\n> Citazione dal cliente:\n> vogliamo un sito pulito\n\nSara" } },
  { folder: "spam", seen: false, thread: "t-spam1", hoursAgo: 12, mail: {
    from: '"Premio" <win@lottery.example>', to: AGENCY, subject: "Hai vinto un iPhone 18!!!",
    messageId: "<spam1@lottery.example>", html: '<p>Clicca <a href="http://phish.example/login">qui</a> per riscattare.</p><img src="http://phish.example/p.gif">' } },
  { folder: "spam", seen: true, thread: "t-spam2", hoursAgo: 60, mail: {
    from: '"SEO Pro" <seo@agency.example>', to: AGENCY, subject: "Prima posizione su Google in 7 giorni",
    messageId: "<spam2@agency.example>", text: "Garantiamo la prima posizione..." } },
];

const build = (mail: Seed["mail"]) => new MailComposer(mail).compile().build();

type State = { boxes: Stored[]; nextUid: number; labels: string[] };
const g = globalThis as unknown as { __ctrlMockMail?: Promise<State> };

function state(): Promise<State> {
  g.__ctrlMockMail ??= (async () => {
    const now = Date.now();
    const boxes: Stored[] = [];
    let uid = 100;
    for (const s of SEEDS) {
      const date = new Date(now - s.hoursAgo * 3600_000);
      boxes.push({ folder: s.folder, uid: uid++, seen: s.seen ?? false, starred: uid % 4 === 0, labels: [uid % 2 ? "Clienti" : "Amministrazione"], threadId: s.thread ?? `t-${uid}`, date, source: await build({ ...s.mail, date }) });
    }
    return { boxes, nextUid: uid, labels: ["Clienti", "Amministrazione"] };
  })();
  return g.__ctrlMockMail;
}

const inFolder = (st: State, folder: FolderId) => st.boxes.filter((b) => folder === "all" ? b.folder !== "spam" && b.folder !== "trash" : folder === "starred" ? Boolean(b.starred) : folder.startsWith("label:") ? b.labels?.includes(folder.slice(6)) : b.folder === folder).sort((a, b) => a.date.getTime() - b.date.getTime());
/** "all" uses its own uid space (like Gmail All Mail): uid + 10000. */
const uidIn = (b: Stored, folder: FolderId) => ((folder === "all" || folder === "starred") ? b.uid + 10000 : b.uid);
const find = (st: State, folder: FolderId, uid: number) => inFolder(st, folder).find((b) => uidIn(b, folder) === uid) ?? null;

async function summarize(b: Stored, folder: FolderId): Promise<MailSummary> {
  const parsed = await parseSource(b.source);
  const m = toMessage(parsed, { folder, uid: uidIn(b, folder), from: null, to: [], subject: "", date: b.date.toISOString(), seen: b.seen, threadId: b.threadId });
  return { folder, uid: m.uid, key: m.key, from: m.from, to: m.to, subject: m.subject, date: m.date, starred: b.starred, labels: b.labels, seen: m.seen, hasAttachments: m.hasAttachments, threadId: m.threadId };
}

export class MockProvider implements MailProvider {
  async view({ folder, page, open, search, category }: ViewQuery): Promise<MailboxView> {
    await new Promise((r) => setTimeout(r, 120)); // a little latency, like a real IMAP round trip
    const st = await state();
    const folders = (["inbox", "sent", "drafts", "all", "spam", "trash"] as const).map((id) => {
      const msgs = inFolder(st, id);
      return { id, unread: msgs.filter((m) => !m.seen).length, total: msgs.length };
    });
    let all = inFolder(st, folder).reverse();
    if (search) all = all.filter((box) => box.source.toString().toLowerCase().includes(search.toLowerCase()));
    if (category && folder === "inbox") all = all.filter((box) => (box.threadId === "t-news" ? "promotions" : box.threadId === "t-sc" || box.threadId === "t-fattura" ? "updates" : "primary") === category);
    const slice = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const list = await Promise.all(slice.map((b) => summarize(b, folder)));
    let openMsg: MailboxView["open"] = null;
    let thread: MailSummary[] = [];
    const hit = open ? find(st, folder, open) : null;
    if (hit) {
      openMsg = toMessage(await parseSource(hit.source), {
        folder, uid: uidIn(hit, folder), from: null, to: [], subject: "", date: hit.date.toISOString(), starred: hit.starred, labels: hit.labels, seen: hit.seen, threadId: hit.threadId,
      });
      const conv = inFolder(st, "all").filter((b) => b.threadId === hit.threadId);
      if (conv.length > 1) thread = await Promise.all(conv.map((b) => summarize(b, "all")));
    }
    return { labels: st.labels.map((name) => ({ id: `label:${name}`, name, unread: 0, total: 0 })), folders, list, total: all.length, open: openMsg, thread };
  }

  async createLabel(name: string) { const st = await state(); if (st.labels.includes(name)) throw new Error("exists"); st.labels.push(name); }

  async mutate(folder: FolderId, uids: number[], operation: MailMutation, label?: string) {
    const st = await state();
    for (const uid of uids) {
      const box = find(st, folder, uid); if (!box) continue;
      if (operation === "read" || operation === "unread") box.seen = operation === "read";
      else if (operation === "star" || operation === "unstar") box.starred = operation === "star";
      else if (operation === "archive") box.folder = "all";
      else if (operation === "trash" || operation === "spam" || operation === "inbox") box.folder = operation;
      else if (label && st.labels.includes(label)) box.labels = operation === "label" ? [...new Set([...(box.labels ?? []), label])] : box.labels?.filter((value) => value !== label);
    }
  }

  async saveDraft(mail: OutgoingMail, previousUid?: number) {
    const st = await state();
    const original = mail.attachmentsFrom ? find(st, mail.attachmentsFrom.folder, mail.attachmentsFrom.uid) : null;
    const parsed = original ? await parseSource(original.source) : null;
    const uid = st.nextUid++;
    st.boxes.push({ folder: "drafts", uid, seen: true, date: new Date(), threadId: `draft-${uid}`, source: await build({ from: AGENCY, to: mail.to, cc: mail.cc, subject: mail.subject, ...brandedEmail(mail.text), attachments: [...(parsed?.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content, cid: a.cid })) ?? []), ...(mail.attachments ?? [])] }) });
    if (previousUid) await this.mutate("drafts", [previousUid], "trash");
    return uid;
  }

  async unread() {
    return inFolder(await state(), "inbox").filter((m) => !m.seen).length;
  }

  async setSeen(folder: FolderId, uid: number, seen: boolean) {
    const hit = find(await state(), folder, uid);
    if (hit) hit.seen = seen;
  }

  async attachment(folder: FolderId, uid: number, pick: { index?: number; cid?: string }) {
    const hit = find(await state(), folder, uid);
    return hit ? pickAttachment(await parseSource(hit.source), pick) : null;
  }

  async replyContext(folder: FolderId, uid: number) {
    const hit = find(await state(), folder, uid);
    return hit ? replyContextOf(await parseSource(hit.source)) : null;
  }

  async send(mail: OutgoingMail) {
    const st = await state();
    const original = mail.attachmentsFrom ? find(st, mail.attachmentsFrom.folder, mail.attachmentsFrom.uid) : null;
    const parsed = original ? await parseSource(original.source) : null;
    const attachments = [...(parsed?.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content, cid: a.cid })) ?? []), ...(mail.attachments ?? [])];
    const messageId = `<${crypto.randomUUID()}@ctrl.example>`;
    const parent = mail.inReplyTo ? st.boxes.find((b) => b.source.includes(mail.inReplyTo!)) : undefined;
    const date = new Date();
    st.boxes.push({
      folder: "sent", uid: st.nextUid++, seen: true, threadId: parent?.threadId ?? `t-${messageId}`, date,
      source: await build({ from: AGENCY, to: mail.to, cc: mail.cc, subject: mail.subject, ...brandedEmail(mail.text, { cta: mail.cta, sender: mail.sender }), attachments, messageId, inReplyTo: mail.inReplyTo ?? undefined, references: mail.references, date }),
    });
    return { messageId };
  }
}

