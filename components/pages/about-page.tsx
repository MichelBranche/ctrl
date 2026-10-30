import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ArrowIcon } from "@/components/icons";
import { CONTACT_EMAIL } from "@/lib/content";
import { dict, type Locale } from "@/lib/i18n";

export function aboutMetadata(lang: Locale): Metadata {
  return { title: dict[lang].nav.about, description: dict[lang].about.description };
}

export function AboutView({ lang }: { lang: Locale }) {
  const t = dict[lang];
  return (
    <>
      <SiteHeader />
      <main className="subpage">
        <p className="kicker">{t.nav.about}</p>
        <h1>
          {t.about.title.map((line) => (
            <span className="h-line" key={line}>
              {line}
            </span>
          ))}
        </h1>
        <div className="subpage-copy">
          {t.about.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <a className="cta-button" href={`mailto:${CONTACT_EMAIL}`} data-cursor="Mail">
          <span>{t.cta}</span>
          <ArrowIcon />
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
