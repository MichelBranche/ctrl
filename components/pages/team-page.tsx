import { CtaLink } from "@/components/cta-link";
import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { team } from "@/lib/content";
import { dict, type Locale } from "@/lib/i18n";
import "./team.css";

export function teamMetadata(lang: Locale): Metadata {
  return { title: dict[lang].nav.team, description: dict[lang].team.description };
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

        <ul className="t-grid" id="team-grid">
          {team.map((member) => {
            const site = member.links[0];
            const body = (
              <>
                {member.photo ? (
                  <Image
                    className="t-photo"
                    src={member.photo}
                    alt={member.name}
                    fill
                    sizes="(max-width: 700px) min(80vw, 320px), 320px"
                    quality={90}
                  />
                ) : null}
                <span className="t-grain" aria-hidden="true" />
                <span className="t-meta">
                  <span className="t-name">{member.name}</span>
                  <span className="t-role">{member.role[lang]}</span>
                </span>
              </>
            );
            return (
              <li key={member.slug} className="t-card">
                {site ? (
                  <a href={site.href} target="_blank" rel="noreferrer" className="t-card-link">
                    {body}
                  </a>
                ) : (
                  <div className="t-card-link">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
