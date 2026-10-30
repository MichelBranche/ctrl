import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ArrowIcon } from "@/components/icons";
import { CONTACT_EMAIL, team, type TeamMember } from "@/lib/content";
import { dict, type Locale } from "@/lib/i18n";

export function teamMetadata(lang: Locale): Metadata {
  return { title: dict[lang].nav.team, description: dict[lang].team.description };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Portrait({ member }: { member: TeamMember }) {
  // Real photos live at /public/images/team/<slug>.jpg (set `photo` in lib/content.ts).
  if (member.photo) {
    return (
      <div className="team-photo">
        <Image src={member.photo} alt={member.name} fill sizes="(max-width: 860px) 100vw, 40vw" />
      </div>
    );
  }
  return (
    <div className="team-photo team-initials" aria-hidden="true">
      <span>{initials(member.name)}</span>
    </div>
  );
}

export function TeamView({ lang }: { lang: Locale }) {
  const t = dict[lang];
  return (
    <>
      <SiteHeader />
      <main className="subpage">
        <p className="kicker">{t.nav.team}</p>
        <h1>
          {t.team.title.map((line) => (
            <span className="h-line" key={line}>
              {line}
            </span>
          ))}
        </h1>
        <aside className="sub-aside" aria-hidden="true">
          <span className="sub-aside-index">{String(team.length).padStart(2, "0")}</span>
          <span className="kicker">{t.nav.team}</span>
        </aside>
        <div className="sub-main">
          <div className="subpage-copy subpage-copy-single">
            <p>{t.team.lead}</p>
          </div>
        </div>
        <ol className="team">
          {team.map((member, i) => (
            <li key={member.slug} className="team-member">
              <Portrait member={member} />
              <div className="team-body">
                <span className="team-index">{String(i + 1).padStart(2, "0")}</span>
                <h2>{member.name}</h2>
                <p className="kicker">{member.role[lang]}</p>
                <p className="team-bio">{member.bio[lang]}</p>
                <ul className="team-skills">
                  {member.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
                {member.links.length ? (
                  <div className="team-links">
                    {member.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="text-link"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.label}
                        <ArrowIcon />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <a className="cta-button" href={`mailto:${CONTACT_EMAIL}`}>
          <span>{t.cta}</span>
          <ArrowIcon />
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
