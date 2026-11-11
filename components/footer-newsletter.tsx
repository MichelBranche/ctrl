"use client";

import { useId, useState, type FormEvent } from "react";
import { subscribe } from "@/app/actions/public";
import { CONTACT_EMAIL } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type State = "idle" | "invalid" | "consent" | "busy" | "done" | "rate" | "error";

const COPY = {
  it: {
    title: "Newsletter",
    lead: "Ogni tanto, una nota dallo studio.",
    label: "La tua email",
    cta: "Iscriviti",
    consent: "Acconsento a ricevere la newsletter di CTRL® secondo la",
    privacy: "privacy policy",
    invalid: "Inserisci un indirizzo email valido.",
    needConsent: "Spunta il consenso per iscriverti.",
    done: "Grazie, sei iscritto. Puoi disiscriverti quando vuoi.",
    rate: "Troppi tentativi. Riprova tra un'ora.",
    error: `Iscrizione non riuscita. Scrivici a ${CONTACT_EMAIL}.`,
  },
  en: {
    title: "Newsletter",
    lead: "A note from the studio, now and then.",
    label: "Your email",
    cta: "Subscribe",
    consent: "I agree to receive the CTRL® newsletter under the",
    privacy: "privacy policy",
    invalid: "Enter a valid email address.",
    needConsent: "Tick the consent box to subscribe.",
    done: "Thanks, you are subscribed. You can unsubscribe any time.",
    rate: "Too many attempts. Try again in an hour.",
    error: `Signup failed. Email us at ${CONTACT_EMAIL}.`,
  },
};

/** Compact newsletter signup in the site footer (every page). Same server action as the Journal form. */
export function FooterNewsletter({ lang }: { lang: Locale }) {
  const c = COPY[lang];
  const id = useId();
  const [state, setState] = useState<State>("idle");
  const reset = () => state !== "idle" && state !== "busy" && setState("idle");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (!EMAIL.test(String(data.get("email") ?? "").trim())) return setState("invalid");
    if (data.get("consent") !== "on") return setState("consent");
    data.set("lang", lang);
    setState("busy");
    const res = await subscribe(data).catch(() => ({ ok: false as const, error: "unavailable" as const }));
    if (res.ok) form.reset();
    setState(res.ok ? "done" : res.error === "rate" ? "rate" : res.error === "invalid" ? "invalid" : "error");
  };

  const msg = { idle: "", busy: "", invalid: c.invalid, consent: c.needConsent, done: c.done, rate: c.rate, error: c.error }[state];

  return (
    <form className="f-news" onSubmit={submit} noValidate>
      <p className="h-small f-news-title">{c.title}</p>
      <p className="f-news-lead">{c.lead}</p>
      <div className="f-news-row">
        <label className="f-sr" htmlFor={`${id}-email`}>{c.label}</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" placeholder={c.label}
          className="f-news-input" aria-invalid={state === "invalid"} aria-describedby={`${id}-msg`} onChange={reset} />
        <input className="f-hp" name="company_site" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button type="submit" className="f-news-btn" disabled={state === "busy"} aria-busy={state === "busy"}>{c.cta}</button>
      </div>
      <label className="f-news-consent" data-error={state === "consent" || undefined}>
        <input type="checkbox" name="consent" onChange={reset} />
        <span>
          {c.consent} <a href={lang === "en" ? "/en/privacy" : "/privacy"}>{c.privacy}</a>.
        </span>
      </label>
      <p id={`${id}-msg`} className="f-news-msg" role="status" data-state={state}>{msg}</p>
    </form>
  );
}
