import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PArrow } from "@/components/projects/arrow";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { AGENDA_EASY_LIVE, AGENDA_EASY_VIDEO, agendaCopy } from "./copy";
import { YouTubeFacade } from "./youtube-facade";
import { localize, type Locale } from "@/lib/i18n";
import { alternates, openGraph } from "@/lib/seo";
import "@/components/projects/projects.css";
import "./agenda-easy.css";

export const AGENDA_EASY_PATH = "/projects/webapps/agenda-easy";
const IMG = "/images/projects/agenda-easy";

export function agendaEasyMetadata(lang: Locale): Metadata {
  const c = agendaCopy[lang];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: alternates(AGENDA_EASY_PATH, lang),
    openGraph: openGraph(lang, { title: c.metaTitle, description: c.metaDescription, images: [`${IMG}/hero.webp`] }),
  };
}

const ICONS = {
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0",
  layers: "M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  chart: "M5 20V12M10 20V6M15 20v-9M20 20V4",
} as const;

function Mark() {
  return (
    <svg className="ae-mark" viewBox="0 0 64 64" aria-hidden="true">
      <text x="27" y="50" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontWeight="700" fontSize="58" fill="currentColor" textAnchor="middle">a</text>
      <circle cx="52" cy="47" r="7.5" fill="var(--p-accent)" />
    </svg>
  );
}

export function AgendaEasyView({ lang }: { lang: Locale }) {
  const c = agendaCopy[lang];
  const projects = localize("/projects", lang);
  return (
    <>
      <SiteHeader />
      <main className="p-root ae-root" data-motion-root>
        <section className="ae-hero">
          <div className="ae-hero-media" aria-hidden="true">
            <Image src={`${IMG}/hero.webp`} alt="" fill priority sizes="(max-width: 900px) 100vw, 60vw" className="ae-hero-img" data-p-hero-img />
          </div>
          <div className="ae-hero-copy">
            <nav className="p-back p-mono ae-crumbs" aria-label="Breadcrumb" data-p-fade>
              <PArrow className="p-arrow p-arrow-back" />
              <Link href={projects}>{c.crumbs[0]}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{c.crumbs[1]}</span>
            </nav>
            <p className="p-tag p-mono" data-p-fade>{c.tag}</p>
            <h1 className="ae-title" data-p-fade>
              <Mark />
              <span>Agenda Easy</span>
            </h1>
            <p className="ae-status p-mono" data-p-fade><span className="ae-live" aria-hidden="true" />{c.status}</p>
            <p className="p-lead ae-lead" data-p-fade>{c.lead}</p>
            <div className="ae-actions" data-p-fade>
              <a className="p-btn p-btn-fill" href={AGENDA_EASY_LIVE} target="_blank" rel="noopener" data-magnetic>
                <span className="p-mono">{c.visit}</span>
                <PArrow />
                <span className="p-sr">{c.newTab}</span>
              </a>
              <a className="ae-watch p-mono" href="#video">
                {c.watch}
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
              </a>
            </div>
          </div>
        </section>

        <section className="ae-wrap ae-overview" aria-labelledby="ae-overview-title">
          <div data-p-fade-scroll>
            <p className="p-kicker p-mono">{c.overviewKicker}</p>
            <h2 className="ae-h2" id="ae-overview-title">{c.overviewTitle.map((l) => <span key={l}>{l}</span>)}</h2>
          </div>
          <p className="ae-overview-text" data-p-fade-scroll>{c.overviewText}</p>
        </section>

        <ul className="ae-wrap ae-features">
          {c.features.map((f) => (
            <li key={f.title} className="ae-feature" data-p-card>
              <span className="ae-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"><path d={ICONS[f.icon]} /></svg>
              </span>
              <h3 className="ae-feature-title">{f.title}</h3>
              <p className="ae-feature-text">{f.text}</p>
            </li>
          ))}
        </ul>

        <div className="ae-wrap ae-screens">
          <figure className="ae-screen ae-screen-desk" data-p-card>
            <Image src={`${IMG}/screen-desktop.webp`} alt={c.screensAlt[0]} width={1440} height={900} sizes="(max-width: 900px) 100vw, 65vw" />
          </figure>
          <figure className="ae-screen ae-screen-phone" data-p-card>
            <Image src={`${IMG}/screen-mobile.webp`} alt={c.screensAlt[1]} width={780} height={1500} sizes="(max-width: 900px) 60vw, 25vw" />
          </figure>
        </div>

        <section className="ae-wrap ae-video" id="video" aria-labelledby="ae-video-title">
          <div className="ae-video-head" data-p-fade-scroll>
            <p className="p-kicker p-mono">{c.videoKicker}</p>
            <h2 className="ae-h2" id="ae-video-title">{c.videoTitle}</h2>
          </div>
          <div data-p-fade-scroll>
            <YouTubeFacade id={AGENDA_EASY_VIDEO} title={c.videoLabel} play={c.play} poster={`${IMG}/video-poster.webp`} />
          </div>
        </section>

        <section className="ae-wrap ae-facts" aria-labelledby="ae-facts-title">
          <div data-p-fade-scroll>
            <p className="p-kicker p-mono">{c.factsKicker}</p>
            <h2 className="ae-h2 ae-h2-sm" id="ae-facts-title">{c.factsTitle.map((l) => <span key={l}>{l}</span>)}</h2>
          </div>
          <dl className="ae-facts-list">
            {c.facts.map((f) => (
              <div key={f.value} className="ae-fact" data-p-card>
                <dt>{f.value}</dt>
                <dd>{f.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="ae-wrap">
          <div className="ae-cta" data-p-fade-scroll>
            <div>
              <p className="p-kicker p-mono">{c.ctaKicker}</p>
              <h2 className="ae-cta-title">{c.ctaTitle}</h2>
              <p className="ae-cta-text">{c.ctaText}</p>
            </div>
            <Link href={localize("/contact", lang)} className="p-btn" data-magnetic>
              <span className="p-mono">{c.ctaButton}</span>
              <PArrow />
            </Link>
          </div>
        </section>
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
