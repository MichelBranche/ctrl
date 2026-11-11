/*
 * Public contact wizard: options, validation, the text we store, and the Discord embed.
 * No database and no secrets. Safe for the browser and for tests.
 * Italian labels are what the team reads in the CRM and in Discord. The visitor's language
 * is only for the page and for the summary they copy.
 */

export const SERVICE_IDS = ["website", "hotel", "shop", "app", "brand", "other"] as const;
export const GOAL_IDS = ["leads", "bookings", "rebuild", "scratch", "other"] as const;
export const BUDGET_IDS = ["under_1500", "to_3000", "to_6000", "over_6000", "unsure"] as const;
export const TIMING_IDS = ["asap", "quarter", "exploring"] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];
export type GoalId = (typeof GOAL_IDS)[number];
export type BudgetId = (typeof BUDGET_IDS)[number];
export type TimingId = (typeof TIMING_IDS)[number];
export type InquiryLang = "it" | "en";

const SERVICE_SET = new Set<string>(SERVICE_IDS);
const GOAL_SET = new Set<string>(GOAL_IDS);
const BUDGET_SET = new Set<string>(BUDGET_IDS);
const TIMING_SET = new Set<string>(TIMING_IDS);

export const isServiceId = (v: string): v is ServiceId => SERVICE_SET.has(v);
export const isGoalId = (v: string): v is GoalId => GOAL_SET.has(v);
export const isBudgetId = (v: string): v is BudgetId => BUDGET_SET.has(v);
export const isTimingId = (v: string): v is TimingId => TIMING_SET.has(v);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Inquiry = {
  services: ServiceId[];
  goal: GoalId;
  budget: BudgetId;
  timing: TimingId;
  name: string;
  email: string;
  phone: string | null;
  note: string;
  lang: InquiryLang;
};

export type InquiryIssue = "services" | "goal" | "budget" | "timing" | "name" | "email" | "phone";

export type Draft = {
  services: ServiceId[];
  goal: GoalId | null;
  budget: BudgetId | null;
  timing: TimingId | null;
  name: string;
  email: string;
  phone: string;
  note: string;
  step: number;
};

type Copy = {
  kicker: string;
  continue: string;
  send: string;
  sending: string;
  back: string;
  step: string;
  of: string;
  sent: string;
  questions: { title: string; hint: string }[];
  services: Record<ServiceId, string>;
  goals: Record<GoalId, string>;
  budgets: Record<BudgetId, string>;
  timings: Record<TimingId, string>;
  name: string;
  email: string;
  phone: string;
  note: string;
  noteHint: string;
  needOne: string;
  needChoice: string;
  needName: string;
  badEmail: string;
  badPhone: string;
  thanks: string;
  promise: string;
  copy: string;
  copied: string;
  home: string;
  again: string;
  summaryTitle: string;
  summaryServices: string;
  summaryGoal: string;
  summaryBudget: string;
  summaryTiming: string;
  summaryPhone: string;
  summaryNote: string;
  vat: string;
  noPhone: string;
};

export const inquiryCopy = {
  it: {
    kicker: "Una domanda alla volta",
    continue: "Continua",
    send: "Invia",
    sending: "Invio…",
    back: "Indietro",
    step: "Passo",
    of: "di",
    sent: "Inviato",
    questions: [
      { title: "Di cosa hai bisogno?", hint: "Puoi sceglierne più di una." },
      { title: "Qual è l'obiettivo?", hint: "Una sola risposta." },
      { title: "Budget indicativo", hint: "Gli importi sono IVA esclusa. Una stima va benissimo." },
      { title: "Quando vorresti partire?", hint: "Anche una finestra larga ci aiuta." },
      { title: "Come ti raggiungiamo?", hint: "Nome e email bastano. Il telefono è facoltativo." },
    ],
    services: {
      website: "Sito web",
      hotel: "Sito per hotel con prenotazione diretta",
      shop: "E-commerce",
      app: "Web app o software",
      brand: "Brand e identità",
      other: "Altro",
    },
    goals: {
      leads: "Più contatti e clienti",
      bookings: "Più prenotazioni dirette",
      rebuild: "Rifare un sito vecchio",
      scratch: "Partire da zero",
      other: "Altro",
    },
    budgets: {
      under_1500: "Sotto 1.500 €",
      to_3000: "1.500-3.000 €",
      to_6000: "3.000-6.000 €",
      over_6000: "Oltre 6.000 €",
      unsure: "Non lo so ancora",
    },
    timings: {
      asap: "Appena possibile",
      quarter: "Entro 1-3 mesi",
      exploring: "Sto valutando",
    },
    name: "Nome",
    email: "Email",
    phone: "Telefono",
    note: "Nota",
    noteHint: "Se vuoi, aggiungi un dettaglio.",
    needOne: "Scegline almeno una.",
    needChoice: "Scegli un'opzione.",
    needName: "Scrivi il tuo nome.",
    badEmail: "Inserisci un'email valida.",
    badPhone: "Controlla il numero, oppure lascialo vuoto.",
    thanks: "Grazie, {name}.",
    promise: "Ti rispondiamo noi, di persona, entro 24 ore.",
    copy: "Copia il riepilogo",
    copied: "Riepilogo copiato",
    home: "Torna alla home",
    again: "Ricomincia",
    summaryTitle: "Richiesta per CTRL",
    summaryServices: "Di cosa hai bisogno",
    summaryGoal: "Obiettivo",
    summaryBudget: "Budget",
    summaryTiming: "Tempi",
    summaryPhone: "Telefono",
    summaryNote: "Nota",
    vat: "IVA esclusa",
    noPhone: "Non indicato",
  },
  en: {
    kicker: "One question at a time",
    continue: "Continue",
    send: "Send",
    sending: "Sending…",
    back: "Back",
    step: "Step",
    of: "of",
    sent: "Sent",
    questions: [
      { title: "What do you need?", hint: "You can pick more than one." },
      { title: "What is the goal?", hint: "One answer is enough." },
      { title: "A rough budget", hint: "Amounts exclude VAT. A guess is fine." },
      { title: "When do you want to start?", hint: "A wide window still helps." },
      { title: "How do we reach you?", hint: "Name and email are enough. Phone is optional." },
    ],
    services: {
      website: "Website",
      hotel: "Hotel website with direct booking",
      shop: "E-commerce",
      app: "Web app or software",
      brand: "Brand and identity",
      other: "Something else",
    },
    goals: {
      leads: "More enquiries and clients",
      bookings: "More direct bookings",
      rebuild: "Rebuild an old website",
      scratch: "Start from scratch",
      other: "Something else",
    },
    budgets: {
      under_1500: "Under €1,500",
      to_3000: "€1,500-3,000",
      to_6000: "€3,000-6,000",
      over_6000: "Over €6,000",
      unsure: "Not sure yet",
    },
    timings: {
      asap: "As soon as possible",
      quarter: "Within 1-3 months",
      exploring: "Still deciding",
    },
    name: "Name",
    email: "Email",
    phone: "Phone",
    note: "Note",
    noteHint: "Add a detail if you want.",
    needOne: "Pick at least one.",
    needChoice: "Pick one option.",
    needName: "Write your name.",
    badEmail: "Enter a valid email.",
    badPhone: "Check the number, or leave it empty.",
    thanks: "Thank you, {name}.",
    promise: "We reply ourselves, in person, within 24 hours.",
    copy: "Copy summary",
    copied: "Summary copied",
    home: "Back to home",
    again: "Start again",
    summaryTitle: "Request for CTRL",
    summaryServices: "What you need",
    summaryGoal: "Goal",
    summaryBudget: "Budget",
    summaryTiming: "Timing",
    summaryPhone: "Phone",
    summaryNote: "Note",
    vat: "VAT excluded",
    noPhone: "Not given",
  },
} satisfies Record<InquiryLang, Copy>;

const clipText = (v: string, max: number) => v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);

/** First word, for "Grazie, Mario." The full name stays in the summary and in the CRM. */
export function greetingName(name: string): string {
  const clean = clipText(name, 120).replace(/\s+/g, " ");
  return (clean.split(" ")[0] || clean).slice(0, 40);
}

export function thanksLine(lang: InquiryLang, name: string): string {
  return inquiryCopy[lang].thanks.replace("{name}", greetingName(name));
}

/**
 * Optional phone. Empty, or a bare +39, is "not given".
 * A national number gets +39. A value that already starts with + or 00 is kept as international.
 */
export function normalizePhone(raw: string): { ok: true; phone: string | null } | { ok: false } {
  const t = raw.trim();
  if (!t || t === "+" || t === "+39" || t === "0039" || t === "39") return { ok: true, phone: null };
  const digits = t.replace(/\D/g, "");
  if (!digits) return { ok: true, phone: null };
  if (digits.length < 6 || digits.length > 15) return { ok: false };
  if (t.startsWith("+")) return { ok: true, phone: `+${digits}` };
  if (t.startsWith("00")) {
    const rest = digits.slice(2);
    if (rest.length < 6 || rest.length > 15) return { ok: false };
    return { ok: true, phone: `+${rest}` };
  }
  const national = digits.startsWith("39") && digits.length > 10 ? digits.slice(2) : digits;
  if (national.length < 6 || national.length > 12) return { ok: false };
  return { ok: true, phone: `+39${national}` };
}

export function budgetLine(id: BudgetId, lang: InquiryLang): string {
  const label = inquiryCopy[lang].budgets[id];
  if (id === "unsure") return label;
  return `${label}, ${inquiryCopy[lang].vat}`;
}

const unique = <T extends string>(ids: readonly T[]): T[] => [...new Set(ids)];

export function parseInquiry(input: {
  services?: readonly string[];
  goal?: string | null;
  budget?: string | null;
  timing?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  note?: string;
  lang?: string;
}): { ok: true; inquiry: Inquiry } | { ok: false; issues: InquiryIssue[] } {
  const issues: InquiryIssue[] = [];
  const services = unique((input.services ?? []).map((v) => v.trim()).filter(isServiceId));
  const unknownService = (input.services ?? []).some((v) => v.trim() && !isServiceId(v.trim()));
  if (!services.length || unknownService) issues.push("services");
  const goal = (input.goal ?? "").trim();
  const budget = (input.budget ?? "").trim();
  const timing = (input.timing ?? "").trim();
  if (!isGoalId(goal)) issues.push("goal");
  if (!isBudgetId(budget)) issues.push("budget");
  if (!isTimingId(timing)) issues.push("timing");
  const name = clipText(input.name ?? "", 120).replace(/\s+/g, " ");
  const email = clipText(input.email ?? "", 200).toLowerCase();
  if (!name) issues.push("name");
  if (!email || email.length > 200 || !EMAIL.test(email)) issues.push("email");
  const phone = normalizePhone(input.phone ?? "");
  if (!phone.ok) issues.push("phone");
  if (issues.length || !isGoalId(goal) || !isBudgetId(budget) || !isTimingId(timing) || !phone.ok) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    inquiry: {
      services,
      goal,
      budget,
      timing,
      name,
      email,
      phone: phone.phone,
      note: clipText(input.note ?? "", 2000),
      lang: input.lang === "en" ? "en" : "it",
    },
  };
}

export function inquiryFromForm(form: FormData): { ok: true; inquiry: Inquiry } | { ok: false; issues: InquiryIssue[] } {
  return parseInquiry({
    services: form.getAll("services").map((v) => String(v)),
    goal: String(form.get("goal") ?? ""),
    budget: String(form.get("budget") ?? ""),
    timing: String(form.get("timing") ?? ""),
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    note: String(form.get("note") ?? ""),
    lang: String(form.get("lang") ?? ""),
  });
}

/** Which step is still missing something. 5 means the draft is complete enough to show the thank-you. */
export function clampStep(draft: Draft): number {
  if (!draft.services.length) return 0;
  if (draft.step <= 0) return 0;
  if (!draft.goal) return 1;
  if (draft.step <= 1) return 1;
  if (!draft.budget) return 2;
  if (draft.step <= 2) return 2;
  if (!draft.timing) return 3;
  if (draft.step <= 3) return 3;
  if (draft.step === 4) return 4;
  const parsed = parseInquiry({ ...draft, lang: "it" });
  return parsed.ok ? 5 : 4;
}

export function stepIssue(step: number, draft: Draft): InquiryIssue | null {
  if (step <= 0) return draft.services.length ? null : "services";
  if (step === 1) return draft.goal ? null : "goal";
  if (step === 2) return draft.budget ? null : "budget";
  if (step === 3) return draft.timing ? null : "timing";
  if (!clipText(draft.name, 120)) return "name";
  const email = clipText(draft.email, 200).toLowerCase();
  if (!email || !EMAIL.test(email)) return "email";
  if (!normalizePhone(draft.phone).ok) return "phone";
  return null;
}

/** Subject and message stored on the request row. Always Italian, so the admin reads one language. */
export function adminBrief(inquiry: Inquiry): { subject: string; message: string } {
  const it = inquiryCopy.it;
  const services = inquiry.services.map((id) => it.services[id]).join(", ");
  const lines = [
    `Servizi: ${services}`,
    `Obiettivo: ${it.goals[inquiry.goal]}`,
    `Budget: ${budgetLine(inquiry.budget, "it")}`,
    `Tempi: ${it.timings[inquiry.timing]}`,
  ];
  if (inquiry.phone) lines.push(`Telefono: ${inquiry.phone}`);
  if (inquiry.note) lines.push("", inquiry.note);
  const subject = services.length <= 120 ? services : `${services.slice(0, 117).trimEnd()}...`;
  return { subject, message: lines.join("\n").slice(0, 5000) };
}

export function summaryText(lang: InquiryLang, inquiry: Inquiry): string {
  const c = inquiryCopy[lang];
  const lines = [
    c.summaryTitle,
    `${c.name}: ${inquiry.name}`,
    `${c.email}: ${inquiry.email}`,
    `${c.summaryPhone}: ${inquiry.phone ?? c.noPhone}`,
    `${c.summaryServices}: ${inquiry.services.map((id) => c.services[id]).join(", ")}`,
    `${c.summaryGoal}: ${c.goals[inquiry.goal]}`,
    `${c.summaryBudget}: ${budgetLine(inquiry.budget, lang)}`,
    `${c.summaryTiming}: ${c.timings[inquiry.timing]}`,
  ];
  if (inquiry.note) lines.push(`${c.summaryNote}: ${inquiry.note}`);
  return lines.join("\n");
}

/** Discord markdown and mentions, without removing addresses or phone numbers. */
export function discordPlain(input: string, max = 900): string {
  const clean = input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return clean
    .replace(/\\/g, "\\\\")
    .replace(/([*_~`|>])/g, "\\$1")
    .replace(/@(everyone|here)/gi, "@\u200b$1")
    .replace(/<@/g, "<@\u200b");
}

type EmbedField = { name: string; value: string; inline: boolean };

/** One embed for #crm-notifiche. Mentions stay off. Contact details stay in, because the team replies from here. */
export function siteInquiryDiscordPayload(inquiry: Inquiry, url: string, at: string): {
  allowed_mentions: { parse: [] };
  embeds: { title: string; description: string; url: string; color: number; timestamp: string; fields: EmbedField[] }[];
} {
  const it = inquiryCopy.it;
  const fields: EmbedField[] = [
    { name: "Email", value: discordPlain(inquiry.email, 200) || "Email", inline: true },
    { name: "Telefono", value: discordPlain(inquiry.phone ?? it.noPhone, 40), inline: true },
    { name: "Servizi", value: discordPlain(inquiry.services.map((id) => it.services[id]).join(", ")), inline: false },
    { name: "Obiettivo", value: discordPlain(it.goals[inquiry.goal]), inline: true },
    { name: "Budget", value: discordPlain(budgetLine(inquiry.budget, "it")), inline: true },
    { name: "Tempi", value: discordPlain(it.timings[inquiry.timing]), inline: true },
  ];
  if (inquiry.note) fields.push({ name: "Nota", value: discordPlain(inquiry.note), inline: false });
  const stamp = Number.isFinite(Date.parse(at)) ? new Date(at).toISOString() : new Date().toISOString();
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: "Richiesta dal sito",
      description: discordPlain(inquiry.name, 200) || "CTRL",
      url,
      color: 0x3498db,
      timestamp: stamp,
      fields,
    }],
  };
}

export function readDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.v !== 1) return null;
  const services = Array.isArray(row.services) ? unique(row.services.map((v) => String(v)).filter(isServiceId)) : [];
  const goal = typeof row.goal === "string" && isGoalId(row.goal) ? row.goal : null;
  const budget = typeof row.budget === "string" && isBudgetId(row.budget) ? row.budget : null;
  const timing = typeof row.timing === "string" && isTimingId(row.timing) ? row.timing : null;
  const step = typeof row.step === "number" && Number.isInteger(row.step) ? row.step : 0;
  const draft: Draft = {
    services,
    goal,
    budget,
    timing,
    name: typeof row.name === "string" ? clipText(row.name, 120) : "",
    email: typeof row.email === "string" ? clipText(row.email, 200) : "",
    phone: typeof row.phone === "string" ? clipText(row.phone, 40) : "",
    note: typeof row.note === "string" ? clipText(row.note, 2000) : "",
    step,
  };
  draft.step = clampStep(draft);
  return draft;
}
