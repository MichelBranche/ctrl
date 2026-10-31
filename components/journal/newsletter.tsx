"use client";

import { useState, type FormEvent } from "react";
import { JArrow } from "@/components/journal/arrow";
import type { JournalCopy } from "@/components/journal/journal-copy";
import { subscribe } from "@/app/actions/public";
import { CONTACT_EMAIL } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type State = "idle" | "invalid" | "busy" | "done" | "rate" | "error";

/** Journal newsletter signup, stored in Turso by the subscribe server action (email, language, date). */
export function Newsletter({ copy, lang }: { copy: JournalCopy; lang: Locale }) {
  const [state, setState] = useState<State>("idle");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = String(data.get("email") ?? "").trim();
    if (!EMAIL.test(value)) return setState("invalid");
    data.set("lang", lang);
    setState("busy");
    const res = await subscribe(data).catch(() => ({ ok: false as const, error: "unavailable" as const }));
    setState(res.ok ? "done" : res.error === "rate" ? "rate" : res.error === "invalid" ? "invalid" : "error");
  };

  const msg = {
    idle: "",
    busy: "",
    invalid: copy.newsInvalid,
    done: copy.newsDone,
    rate: copy.newsRate,
    error: copy.newsError.replace("{email}", CONTACT_EMAIL),
  }[state];

  return (
    <section className="j-news" data-j-fade-scroll>
      <div className="j-news-copy">
        <h2 className="j-news-title">{copy.newsTitle}</h2>
        <p className="j-news-text">{copy.newsText}</p>
      </div>
      <form className="j-news-form" onSubmit={submit} noValidate>
        <label className="j-sr" htmlFor="j-news-email">
          {copy.newsLabel}
        </label>
        <input
          id="j-news-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={copy.newsPlaceholder}
          className="j-news-input"
          aria-invalid={state === "invalid"}
          aria-describedby="j-news-msg"
          onChange={() => state !== "idle" && setState("idle")}
        />
        <input className="j-hp" name="company_site" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button type="submit" className="j-pill" data-magnetic disabled={state === "busy"} aria-busy={state === "busy"}>
          <span>{copy.newsCta}</span>
          <JArrow />
        </button>
        <p id="j-news-msg" className="j-news-msg" role="status" data-state={state}>
          {msg}
        </p>
        <p className="j-news-consent">
          {copy.newsConsent} <a href={lang === "en" ? "/en/privacy" : "/privacy"}>{copy.newsPrivacy}</a>.
        </p>
      </form>
    </section>
  );
}
