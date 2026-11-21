import { CtaLink } from "@/components/cta-link";
import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { team } from "@/lib/content";
import { TeamBadge } from "@/components/team-badge";
import { dict, type Locale } from "@/lib/i18n";
import { publicMeta } from "@/lib/seo";
import "./team.css";
import "./team-badge.css";

export function teamMetadata(lang: Locale): Metadata {
  return publicMeta(lang, { title: dict[lang].team.metaTitle, description: dict[lang].team.description, itPath: "/team" });
}

export function TeamView({ lang }: { lang: Locale }) {
  const t = dict[lang].team;
  return (
    <>
      <SiteHeader />
      <main className="t-root">
        <section className="t-hero">
          <Image
            className="t-hero-img"
            src="/images/home/perche.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
          />
          <div className="t-hero-copy">
            <p className="t-tag">{t.tag}</p>
            <h1 className="t-title">
              {t.title.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            <p className="t-lead">{t.lead}</p>
            <CtaLink href="#team-grid" className="t-cta">
              {t.scroll}
            </CtaLink>
          </div>
        </section>

        <ul className="tb-grid" id="team-grid">
          {team.map((member, i) => (
            <TeamBadge key={member.slug} member={member} lang={lang} priority={i < 2} />
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
