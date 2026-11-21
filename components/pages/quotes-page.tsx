import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { QuotesMotion } from "@/components/quotes/quotes-motion";
import { QuotesVideo } from "@/components/quotes/quotes-video";
import { QUOTES_COPY, QUOTES_TEMPLATES, QUOTES_URL, QUOTES_VIDEO } from "@/components/quotes/quotes-copy";
import type { Locale } from "@/lib/i18n";
import { publicMeta } from "@/lib/seo";
import "./quotes-page.css";

/**
 * Indexing switch. Kept out of search until the owner confirms (the product is still "in arrivo").
 * Set to true to drop noindex and add the page to the sitemap.
 */
export const QUOTES_INDEXABLE = false;

export function quotesMetadata(lang: Locale): Metadata {
  const c = QUOTES_COPY[lang];
  return publicMeta(lang, {
    title: c.metaTitle,
    description: c.metaDesc,
    itPath: "/ctrl-quotes",
    images: [{ url: "/images/quotes/og.jpg", width: 1200, height: 630, alt: "CTRL® Quotes" }],
    ...(QUOTES_INDEXABLE ? {} : { robots: { index: false, follow: true } }),
  });
}

function ArrowUpRight() {
  return (
    <svg className="qx-arrow" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="qx-check">
      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OfficialLink({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <a href={QUOTES_URL} target="_blank" rel="noopener" className={className}>
      {children}
      <ArrowUpRight />
    </a>
  );
}

export function QuotesPage({ lang }: { lang: Locale }) {
  const c = QUOTES_COPY[lang];
  const f = c.feats;
  const ui = c.stepUi;

  return (
    <>
      <SiteHeader />
      <QuotesMotion>
        <main className="qx">
          {/* 1. HERO */}
          <section className="qx-hero" data-qx-hero>
            <div className="qx-card qx-hero-card">
              <div className="qx-hero-copy">
                <p className="qx-brand" data-qx-fade>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 128px icon, already optimized webp */}
                  <img src="/images/ecosystem/quotes-icon.webp" alt="" width={128} height={128} />
                  <span>CTRL® Quotes</span>
                  <span className="qx-pill qx-pill-lime">
                    <i aria-hidden="true" />
                    {c.status}
                  </span>
                </p>
                <h1 className="qx-hero-title">
                  <span data-qx-words>{c.title[0]}</span> <span data-qx-words>{c.title[1]}</span>
                </h1>
                <p className="qx-hero-lead" data-qx-fade>
                  {c.lead}
                </p>
                <div className="qx-actions" data-qx-fade>
                  <OfficialLink className="qx-cta">{c.cta}</OfficialLink>
                  <a href="#video" className="qx-ghost">
                    {c.watch}
                  </a>
                </div>
              </div>

              <div className="qx-stack" data-qx-stack role="img" aria-label={c.coversAlt}>
                <div className="qx-tilt" data-qx-tilt>
                  <div className="qx-spin" data-qx-spin>
                    <i className="qx-stack-shadow" aria-hidden="true" />
                    {QUOTES_TEMPLATES.map((t, i) => (
                      <div className="qx-sheet" key={t.id} data-qx-sheet style={{ "--i": i } as React.CSSProperties}>
                        <Image src={`/images/quotes/tpl-${t.id}.webp`} alt="" width={640} height={904} sizes="(max-width: 809px) 50vw, 20vw" priority={i === QUOTES_TEMPLATES.length - 1} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. VIDEO */}
          <section className="qx-block" id="video" aria-labelledby="qx-video-title">
            <div className="qx-card qx-video-card">
              <div className="qx-video-head">
                <p className="qx-kicker qx-kicker-light">{c.videoKicker}</p>
                <a href={`https://www.youtube.com/watch?v=${QUOTES_VIDEO.id}`} target="_blank" rel="noopener noreferrer" className="qx-link">
                  {c.onYoutube}
                  <ArrowUpRight />
                </a>
              </div>
              <div className="qx-video-frame" data-qx-rise>
                <QuotesVideo playLabel={c.play} />
              </div>
              <h2 className="qx-slogan" id="qx-video-title">
                <span data-qx-title>{c.slogan[0]}</span> <span className="qx-slogan-pill">{c.slogan[1]}</span>
              </h2>
            </div>
          </section>

          {/* 3. COME FUNZIONA */}
          <section className="qx-block" aria-labelledby="qx-steps-title">
            <div className="qx-card qx-steps-card">
              <div className="qx-head">
                <p className="qx-kicker">{c.stepsKicker}</p>
                <h2 className="qx-h2" id="qx-steps-title" data-qx-title>
                  {c.stepsTitle}
                </h2>
              </div>
              <ol className="qx-steps" data-qx-stagger>
                <li className="qx-step" data-qx-loop>
                  <div className="qx-step-ui qx-ui-blocks" aria-hidden="true">
                    {ui.blocks.map((b, i) => (
                      <span key={b} className="qx-block-row" style={{ "--k": i } as React.CSSProperties}>
                        <i />
                        {b}
                      </span>
                    ))}
                  </div>
                  <StepText step={c.steps[0]} />
                </li>
                <li className="qx-step" data-qx-loop>
                  <div className="qx-step-ui qx-ui-send" aria-hidden="true">
                    <span className="qx-send-link">
                      <svg viewBox="0 0 16 16"><path d="M6.5 9.5 9.5 6.5M7 4.5l1.3-1.3a2.6 2.6 0 0 1 3.7 3.7L10.7 8.2M9 11.5l-1.3 1.3a2.6 2.6 0 0 1-3.7-3.7L5.3 7.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                      {ui.link}
                    </span>
                    <span className="qx-send-plane">
                      <svg viewBox="0 0 24 24"><path d="M3 11.5 21 3l-6.5 18-3-7.5z" fill="currentColor" /></svg>
                    </span>
                    <span className="qx-send-done">
                      <Check />
                      {ui.sent}
                    </span>
                  </div>
                  <StepText step={c.steps[1]} />
                </li>
                <li className="qx-step" data-qx-loop>
                  <div className="qx-step-ui qx-ui-paid" aria-hidden="true">
                    <span className="qx-toast">
                      <Check />
                      {ui.accepted}
                    </span>
                    <span className="qx-toast qx-toast-ink">
                      <Check />
                      {ui.deposit}
                    </span>
                  </div>
                  <StepText step={c.steps[2]} />
                </li>
              </ol>
            </div>
          </section>

          {/* 4. FUNZIONI (bento) */}
          <section className="qx-block" aria-labelledby="qx-feat-title">
            <div className="qx-card qx-feat-card">
              <div className="qx-head">
                <p className="qx-kicker qx-kicker-light">{c.featKicker}</p>
                <h2 className="qx-h2" id="qx-feat-title" data-qx-title>
                  {c.featTitle}
                </h2>
              </div>
              <ul className="qx-bento" data-qx-stagger>
                <li className="qx-tile qx-tile-templates">
                  <div>
                    <h3>{f.templates.title}</h3>
                    <p>{f.templates.text}</p>
                  </div>
                  <ul className="qx-tpl-row">
                    {QUOTES_TEMPLATES.map((t) => (
                      <li key={t.id}>
                        <Image src={`/images/quotes/tpl-${t.id}.webp`} alt="" width={640} height={904} sizes="(max-width: 809px) 30vw, 10vw" />
                        <span>{t.name}</span>
                      </li>
                    ))}
                  </ul>
                </li>
                <li className="qx-tile qx-tile-tax">
                  <h3>{f.tax.title}</h3>
                  <p>{f.tax.text}</p>
                  <ul className="qx-chips">
                    {f.tax.chips.map((chip) => (
                      <li key={chip}>{chip}</li>
                    ))}
                  </ul>
                </li>
                <li className="qx-tile qx-tile-accept">
                  <h3>{f.accept.title}</h3>
                  <p>{f.accept.text}</p>
                  <span className="qx-fake-btn" aria-hidden="true">
                    <Check />
                    {f.accept.button}
                  </span>
                </li>
                <li className="qx-tile qx-tile-pay">
                  <h3>{f.pay.title}</h3>
                  <p>{f.pay.text}</p>
                  <ul className="qx-chips">
                    {f.pay.methods.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </li>
                <li className="qx-tile qx-tile-notify">
                  <h3>{f.notify.title}</h3>
                  <ul className="qx-notes">
                    {f.notify.items.map((n) => (
                      <li key={n}>
                        <i aria-hidden="true" />
                        {n}
                      </li>
                    ))}
                  </ul>
                </li>
                <li className="qx-tile qx-tile-analytics">
                  <div>
                    <h3>{f.analytics.title}</h3>
                    <p>{f.analytics.text}</p>
                  </div>
                  <span className="qx-bars" aria-hidden="true">
                    {[38, 54, 46, 70, 62, 84, 76, 92].map((h, i) => (
                      <i key={i} style={{ "--h": `${h}%`, "--k": i } as React.CSSProperties} />
                    ))}
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* 5. CHIUSURA */}
          <section className="qx-block" aria-labelledby="qx-close-title">
            <div className="qx-card qx-close-card">
              <h2 className="qx-close-title" id="qx-close-title" data-qx-title>
                {c.closeTitle.join(" ")}
              </h2>
              <p className="qx-close-lead">{c.closeLead}</p>
              <div className="qx-actions qx-actions-center">
                <OfficialLink className="qx-cta qx-cta-lime">quotes.ctrlagency.dev</OfficialLink>
                <a href="#video" className="qx-ghost qx-ghost-light">
                  {c.watch}
                </a>
              </div>
              <p className="qx-by">{c.by}</p>
            </div>
          </section>
        </main>
      </QuotesMotion>
      <SiteFooter />
    </>
  );
}

function StepText({ step }: { step: { n: string; title: string; text: string } }) {
  return (
    <div className="qx-step-text">
      <span className="qx-step-n">{step.n}</span>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
    </div>
  );
}
