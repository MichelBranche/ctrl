import { CONTACT_EMAIL, projects, services, team } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };
export type ChatLink = { label: string; href: string };
export type ChatReply = { reply: string; links: ChatLink[]; source: "faq" | "llm" };

/**
 * Pluggable answer provider. The FAQ provider below is deterministic and
 * only uses lib/content.ts. A real LLM provider can implement the same
 * interface (see app/api/chat/route.ts).
 */
export interface AssistantProvider {
  answer(messages: ChatMessage[], lang: Locale): Promise<ChatReply>;
}

const contactHref = (lang: Locale) => localize("/#contact", lang);

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type Intent = "services" | "pricing" | "timing" | "contact" | "team" | "work" | "greeting";

const keywords: Record<Intent, string[]> = {
  pricing: ["prezz", "cost", "preventiv", "budget", "price", "pricing", "quote", "tariff", "quanto"],
  timing: ["tempi", "tempo", "quando", "durata", "settiman", "mesi", "time", "timeline", "how long", "deadline", "scadenz"],
  contact: ["contatt", "email", "mail", "scriv", "chiam", "contact", "reach", "call", "telefon"],
  team: ["team", "chi siete", "chi sei", "michel", "kallebe", "who are", "persone", "people"],
  work: ["progett", "lavori", "portfolio", "case", "work", "project", "esempi", "example"],
  services: ["serviz", "cosa fate", "offr", "service", "what do you", "brand", "sito", "siti", "web", "app", "motion", "ai", "design", "svilupp"],
  greeting: ["ciao", "salve", "buongiorno", "hello", "hi", "hey"],
};

function detect(text: string): Intent | null {
  const t = ` ${norm(text)} `;
  for (const intent of Object.keys(keywords) as Intent[]) {
    if (keywords[intent].some((k) => t.includes(k.length <= 3 ? ` ${k} ` : k))) return intent;
  }
  return null;
}

export function faqAnswer(text: string, lang: Locale): ChatReply {
  const it = lang === "it";
  const contact: ChatLink = { label: it ? "Contatti" : "Contact", href: contactHref(lang) };
  const mail: ChatLink = { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` };
  const out = (reply: string, links: ChatLink[]): ChatReply => ({ reply, links, source: "faq" });

  switch (detect(text)) {
    case "services":
      return out(
        (it ? "Ecco cosa facciamo:\n" : "Here is what we do:\n") +
          services.map((s) => `${s.index} ${s.title[lang]}: ${s.text[lang]}`).join("\n"),
        services.map((s) => ({ label: s.title[lang], href: localize(`/services/${s.slug}`, lang) })),
      );
    case "pricing":
      return out(
        it
          ? "Ogni progetto è diverso, quindi lo quotiamo su richiesta. Raccontaci obiettivi e contesto e ti prepariamo un preventivo su misura."
          : "Every project is different, so we quote each one on request. Tell us your goals and context and we will prepare a tailored quote.",
        [contact, mail],
      );
    case "timing":
      return out(
        it
          ? "I tempi dipendono da perimetro e obiettivi del progetto: li definiamo insieme in fase di preventivo. Scrivici e ne parliamo."
          : "Timing depends on the scope and goals of the project: we define it together when we prepare the quote. Write to us and let's talk.",
        [contact],
      );
    case "contact":
      return out(
        it
          ? `Puoi scriverci a ${CONTACT_EMAIL} oppure usare la sezione contatti in fondo alla pagina.`
          : `You can write to us at ${CONTACT_EMAIL} or use the contact section at the bottom of the page.`,
        [mail, contact],
      );
    case "team":
      return out(
        (it ? "Siamo un piccolo team:\n" : "We are a small team:\n") +
          team.map((m) => `${m.name}: ${m.role[lang]}`).join("\n"),
        [{ label: "Team", href: localize("/team", lang) }],
      );
    case "work":
      return out(
        (it ? "Alcuni progetti:\n" : "Some projects:\n") +
          projects.map((p) => `${p.name}: ${p.meta[lang]}`).join("\n"),
        [{ label: it ? "Tutti i lavori" : "All work", href: localize("/work", lang) }],
      );
    case "greeting":
      return out(
        it ? "Ciao! Chiedimi dei servizi, dei progetti, del team o di come contattarci." : "Hi! Ask me about our services, projects, team or how to reach us.",
        [],
      );
    default:
      return out(
        it
          ? "Non sono sicuro di aver capito. Posso parlarti di servizi, progetti, team, preventivi e contatti. Per qualsiasi altra domanda scrivici."
          : "I'm not sure I understood. I can tell you about services, projects, team, quotes and contact. For anything else, write to us.",
        [contact],
      );
  }
}

export const faqProvider: AssistantProvider = {
  async answer(messages, lang) {
    const last = [...messages].reverse().find((m) => m.role === "user");
    return faqAnswer(last?.content ?? "", lang);
  },
};
