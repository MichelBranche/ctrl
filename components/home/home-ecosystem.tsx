import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ECOSYSTEM, ecosystemImage } from "@/lib/ecosystem";
import { localize, type Locale } from "@/lib/i18n";

type Copy = { kicker: string; title: string; lead: string; subs: Record<string, string>; open: string };

/** Checked at build/render time, so a newly copied image shows up without code changes. */
function hasImage(src: string) {
  return existsSync(path.join(process.cwd(), "public", src));
}

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
            const src = ecosystemImage(item.id, lang);
            const ready = hasImage(src);
            const sub = copy.subs[item.id];
            return (
              <li key={item.id}>
                <EcoLink
                  href={item.href}
                  lang={lang}
                  label={item.href.startsWith("http") ? `${item.name}: ${sub} (${copy.open})` : `${item.name}: ${sub}`}
                >
                  <span className="hv-eco-media" style={{ background: item.tint, color: item.ink }}>
                    {ready ? (
                      <Image src={src} alt="" fill sizes="(max-width: 809px) 100vw, 50vw" quality={80} />
                    ) : (
                      <span className="hv-eco-placeholder">{item.name}</span>
                    )}
                  </span>
                  <span className="hv-eco-meta">
                    <span>
                      <span className="hv-eco-name">{item.name}</span>
                      <span className="hv-eco-sub">{sub}</span>
                    </span>
                    <svg className="hv-eco-arrow" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </span>
                </EcoLink>
              </li>
            );
          })}
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
