import Link from "next/link";
import { EcoWordmark } from "@/components/home/eco-wordmarks";
import { ECOSYSTEM, ecosystemIcon } from "@/lib/ecosystem";
import { localize, type Locale } from "@/lib/i18n";

const SOON = {
  it: { title: "Prossimamente", sub: "Nuovi strumenti CTRL® in arrivo." },
  en: { title: "Coming soon", sub: "More CTRL® tools on the way." },
};

type Copy = { kicker: string; title: string; lead: string; subs: Record<string, string>; open: string };

export function HomeEcosystem({ lang, copy }: { lang: Locale; copy: Copy }) {
  return (
    <section className="hv-block hv-eco" aria-labelledby="hv-eco-title">
      <div className="hv-card hv-eco-card">
        <div className="hv-eco-head">
          <div className="hv-eco-head-left">
            <p className="hv-eco-kicker">{copy.kicker}</p>
            <h2 className="hv-eco-title" id="hv-eco-title" data-hv-title>
              {copy.title}
            </h2>
          </div>
          <p className="hv-eco-lead" data-hv-rise>
            {copy.lead}
          </p>
        </div>
        <ul className="hv-eco-grid" data-hv-stagger>
          {ECOSYSTEM.map((item) => {
            const sub = copy.subs[item.id];
            return (
              <li key={item.id}>
                <EcoLink
                  href={item.href}
                  lang={lang}
                  label={item.href.startsWith("http") ? `${item.name}: ${sub} (${copy.open})` : `${item.name}: ${sub}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 128px icon, already optimized webp */}
                  <img className="hv-eco-icon" src={ecosystemIcon(item.id)} alt="" width={128} height={128} loading="lazy" decoding="async" />
                  <span className="hv-eco-text">
                    <EcoWordmark id={item.id} />
                    <span className="hv-eco-sub">{sub}</span>
                  </span>
                  <svg className="hv-eco-arrow" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </EcoLink>
              </li>
            );
          })}
          {/* Free slot for the next product: a quiet dashed row, not a link. */}
          <li className="hv-eco-soon" aria-hidden="true">
            <span className="hv-eco-soon-icon">+</span>
            <span className="hv-eco-text">
              <span className="hv-eco-soon-title">{SOON[lang].title}</span>
              <span className="hv-eco-sub">{SOON[lang].sub}</span>
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}

function EcoLink({ href, lang, label, children }: { href: string; lang: Locale; label: string; children: React.ReactNode }) {
  if (href.startsWith("http")) {
    return (
      <a className="hv-eco-item" href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <Link className="hv-eco-item" href={localize(href, lang)} aria-label={label}>
      {children}
    </Link>
  );
}
