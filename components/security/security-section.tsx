import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { PArrow } from "@/components/projects/arrow";
import { SecurityMotion } from "@/components/security/security-motion";
import { SECURITY_IMAGE, SECURITY_PATH, securityCopy, type SecurityIcon } from "@/components/security/security-copy";
import { localize, type Locale } from "@/lib/i18n";
import "./security.css";

const ICONS: Record<SecurityIcon, string> = {
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2.5",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.4 2.5 3.7 5.5 3.7 9s-1.3 6.5-3.7 9M12 3c-2.4 2.5-3.7 5.5-3.7 9s1.3 6.5 3.7 9",
  shield: "M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3zM8.8 12l2.2 2.2 4.2-4.4",
  mail: "M3.5 6h17v12h-17zM3.5 6.5l8.5 6.5 8.5-6.5",
};

function Icon({ name }: { name: SecurityIcon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Check({ className = "sec-check" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 12.5l4.5 4.5L19.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="sec-cross" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function Plus() {
  return (
    <svg className="sec-check sec-plus" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const euro = (lang: Locale, value: number) => (lang === "it" ? `${value} €` : `€${value}`);

/**
 * Managed security and SSL/TLS service. Rendered on /projects (with the shield visual and a link to the
 * service page) and on /services/web-security (the hero already shows the visual there).
 */
export function SecuritySection({ lang, variant }: { lang: Locale; variant: "projects" | "page" }) {
  const c = securityCopy[lang];
  const contact = localize("/contact", lang) as Route;
  const onProjects = variant === "projects";

  return (
    <section className={`sec${onProjects ? " sec-on-projects" : ""}`} id={onProjects ? "sicurezza" : undefined} aria-labelledby="sec-title" data-sec>
      <div className={`sec-head${onProjects ? "" : " sec-head-solo"}`}>
        <div className="sec-head-copy" data-p-fade-scroll>
          <p className="p-kicker p-mono">{c.kicker}</p>
          <h2 className="sec-h2" id="sec-title">
            {c.title.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p className="sec-lead">{c.lead}</p>
          {onProjects ? (
            <Link href={localize(SECURITY_PATH, lang) as Route} className="sec-more p-mono">
              {c.more}
              <PArrow className="p-arrow" />
            </Link>
          ) : null}
        </div>
        {onProjects ? (
          <figure className="sec-visual" data-sec-visual>
            <span className="sec-visual-in" data-p-parallax>
              <Image src={SECURITY_IMAGE} alt={c.imageAlt} fill sizes="(max-width: 960px) 100vw, 50vw" className="sec-visual-img" />
            </span>
            <figcaption className="sec-chip p-mono" aria-hidden="true">
              <i />
              HTTPS · TLS
            </figcaption>
          </figure>
        ) : null}
      </div>

      <ul className="sec-pillars" aria-label={c.pillarsLabel}>
        {c.pillars.map((pillar, index) => (
          <li key={pillar.title} className="sec-pillar" data-p-card>
            <div className="sec-pillar-top">
              <span className="sec-icon">
                <Icon name={pillar.icon} />
              </span>
              <span className="p-mono sec-n">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <h3 className="sec-pillar-title">{pillar.title}</h3>
            <p className="sec-pillar-text">{pillar.text}</p>
          </li>
        ))}
      </ul>

      <div className="sec-plans-wrap">
        <div className="sec-plans-intro" data-p-fade-scroll>
          <p className="p-kicker p-mono">{c.plansKicker}</p>
          <h3 className="sec-h3">{c.plansTitle}</h3>
          <p className="sec-text">{c.plansText}</p>
        </div>
        <ul className="sec-plans">
          {c.plans.map((plan) => (
            <li key={plan.name} className={`sec-plan${plan.featured ? " is-featured" : ""}`} data-p-card data-sec-plan>
              <div className="sec-plan-head">
                <h4 className="sec-plan-name">{plan.name}</h4>
                {plan.featured ? <span className="sec-badge p-mono">{c.recommended}</span> : null}
              </div>
              <p className="sec-plan-fit">{plan.fit}</p>
              <p className="sec-price">
                <strong>{euro(lang, plan.price)}</strong>
                <span className="p-mono">
                  {c.perYear} {c.vat}
                </span>
              </p>
              <ul className="sec-checks">
                {plan.checks.map((item) => (
                  <li key={item} data-sec-check>
                    <Check />
                    <span>{item}</span>
                  </li>
                ))}
                {plan.onRequest ? (
                  <li className="sec-on-request" data-sec-check>
                    <Plus />
                    <span>{plan.onRequest}</span>
                  </li>
                ) : null}
              </ul>
              <Link href={contact} className={`p-btn${plan.featured ? " p-btn-fill" : ""} sec-plan-cta`} data-magnetic>
                <span className="p-mono">{plan.cta}</span>
                <PArrow />
              </Link>
            </li>
          ))}
        </ul>
        <p className="sec-footnote" data-p-fade-scroll>{c.footnote}</p>
      </div>

      <div className="sec-compare-wrap">
        <div className="sec-compare-intro" data-p-fade-scroll>
          <p className="p-kicker p-mono">{c.compareKicker}</p>
          <h3 className="sec-h3">{c.compareTitle}</h3>
        </div>
        <table className="sec-compare" data-sec-compare>
          <thead>
            <tr>
              <th scope="col" className="p-mono">{c.compareTopic}</th>
              <th scope="col" className="p-mono">{c.compareDiy}</th>
              <th scope="col" className="p-mono sec-col-managed">{c.compareManaged}</th>
            </tr>
          </thead>
          <tbody>
            {c.compare.map((row) => (
              <tr key={row.topic} data-sec-row>
                <th scope="row">{row.topic}</th>
                <td data-label={c.compareDiy}>
                  <Cross />
                  <span>{row.diy}</span>
                </td>
                <td data-label={c.compareManaged} className="sec-col-managed">
                  <Check />
                  <span>{row.managed}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sec-cta" data-p-fade-scroll>
        <svg className="sec-cta-mark" viewBox="0 0 240 280" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round">
            <path data-sec-draw d="M120 12 L222 50 V128 C222 196 180 244 120 268 C60 244 18 196 18 128 V50 Z" />
            <path data-sec-draw d="M120 40 L196 68 V130 C196 182 164 220 120 240 C76 220 44 182 44 130 V68 Z" />
          </g>
          <path className="sec-cta-tick" data-sec-draw d="M84 140 L110 166 L160 112" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="sec-cta-copy">
          <p className="p-kicker p-mono">{c.ctaKicker}</p>
          <h3 className="sec-cta-title">{c.ctaTitle}</h3>
          <p className="sec-cta-text">{c.ctaText}</p>
          <div className="sec-cta-actions">
            <Link href={contact} className="p-btn p-btn-fill" data-magnetic>
              <span className="p-mono">{c.ctaButton}</span>
              <PArrow />
            </Link>
          </div>
        </div>
      </div>
      <SecurityMotion />
    </section>
  );
}
