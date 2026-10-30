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

function Arrow() {
  return (
    <svg className="t-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
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
            <a href="#team-grid" className="t-circle" aria-label={t.scroll}>
              <Arrow />
            </a>
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
                    sizes="(max-width: 700px) 100vw, 33vw"
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
