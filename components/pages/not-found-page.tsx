import { CtaLink } from "@/components/cta-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { localize, type Locale } from "@/lib/i18n";

const copy = {
  it: { kicker: "Errore 404", title: "Pagina non trovata.", lead: "Il link potrebbe essere vecchio o la pagina è stata spostata.", home: "Torna alla home" },
  en: { kicker: "Error 404", title: "Page not found.", lead: "The link may be out of date, or the page has moved.", home: "Back to home" },
} as const;

export function NotFoundView({ lang }: { lang: Locale }) {
  const c = copy[lang];
  return (
    <>
      <SiteHeader />
      <main className="subpage nf-page">
        <p className="kicker">{c.kicker}</p>
        <h1>{c.title}</h1>
        <p className="nf-lead">{c.lead}</p>
        <CtaLink href={localize("/", lang)} className="nf-cta">
          {c.home}
        </CtaLink>
      </main>
      <SiteFooter />
    </>
  );
}
