import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PostBody } from "@/components/journal/markdown";
import { cookies, LEGAL_UPDATED, privacy } from "@/components/legal/legal-copy";
import { withGermanFallback, type Locale } from "@/lib/i18n";
import { publicMeta } from "@/lib/seo";
import "@/components/journal/journal.css";
import "./legal.css";

const DOCS = { privacy, cookies };
type Doc = keyof typeof DOCS;
const PATHS: Record<Doc, Record<Locale, string>> = {
  privacy: withGermanFallback({ it: "/privacy", en: "/en/privacy", de: "/de/privacy", fr: "/fr/privacy" }),
  cookies: withGermanFallback({ it: "/cookie", en: "/en/cookies", de: "/de/cookies", fr: "/fr/cookies" }),
};

const META: Record<Doc, Record<Locale, { title: string; description: string }>> = {
  privacy: withGermanFallback({
    it: {
      title: "Informativa privacy dello studio web ad Aosta | CTRL®",
      description: "Quali dati raccoglie il sito di CTRL®, perché e per quanto. Pochi dati, nessun cookie di profilazione, nessuna vendita a terzi. Studio ad Aosta.",
    },
    en: {
      title: "The privacy policy of our web studio in Aosta | CTRL®",
      description: "What data the CTRL® site collects, why and for how long. Very little data, no profiling cookies, nothing sold to third parties. Studio in Aosta.",
    },
    de: { title: "Datenschutzerklärung des CTRL® Studios in Aosta | CTRL®", description: "Welche Daten CTRL® erhebt, warum und wie lange. Wenige Daten, keine Tracking-Cookies und kein Verkauf an Dritte." },
    fr: { title: "Politique de confidentialité du studio CTRL® à Aoste | CTRL®", description: "Quelles données CTRL® recueille, pourquoi et pendant combien de temps. Peu de données, aucun cookie de suivi et aucune revente." },
  }),
  cookies: withGermanFallback({
    it: {
      title: "Informativa cookie del sito, studio ad Aosta | CTRL®",
      description: "Il sito pubblico di CTRL® non usa cookie di profilazione o pubblicitari. L'unico cookie è tecnico e serve solo all'area riservata di amministrazione.",
    },
    en: {
      title: "Cookie policy of the site, studio in Aosta | CTRL®",
      description: "The public CTRL® site uses no profiling or advertising cookies. The only cookie is technical and limited to the private admin area. No consent banner.",
    },
    de: { title: "Cookie-Richtlinie des CTRL® Studios in Aosta | CTRL®", description: "Die öffentliche Website von CTRL® verwendet keine Tracking- oder Werbe-Cookies. Nur der private Administrationsbereich nutzt ein notwendiges technisches Cookie." },
    fr: { title: "Politique de cookies du studio CTRL® à Aoste | CTRL®", description: "Le site public de CTRL® n’utilise aucun cookie publicitaire ou de suivi. Seul l’espace privé utilise un cookie technique nécessaire." },
  }),
};

export function legalMetadata(doc: Doc, lang: Locale): Metadata {
  const meta = META[doc][lang];
  return publicMeta(lang, { title: meta.title, description: meta.description, itPath: PATHS[doc].it, enPath: PATHS[doc].en, dePath: PATHS[doc].de, frPath: PATHS[doc].fr });
}

export function LegalView({ doc, lang }: { doc: Doc; lang: Locale }) {
  const d = DOCS[doc][lang];
  return (
    <>
      <SiteHeader />
      <main className="j-root j-article l-root">
        <header className="j-a-head">
          <h1 className="j-a-title">{d.title}</h1>
          <p className="j-a-lead">{d.lead}</p>
        </header>
        <div className="j-a-body">
          <PostBody source={d.body} />
          <p className="l-updated">
            {lang === "it" ? "Ultimo aggiornamento" : lang === "fr" ? "Dernière mise à jour" : lang === "de" ? "Zuletzt aktualisiert" : "Last updated"}: {LEGAL_UPDATED[lang]}
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
