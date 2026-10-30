"use client";

import { useState, type FormEvent } from "react";
import { contactCopy } from "@/components/pages/contact-copy";
import { CONTACT_EMAIL } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

type Field = "name" | "email" | "subject" | "message";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm({ lang }: { lang: Locale }) {
  const c = contactCopy[lang];
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [sent, setSent] = useState(false);

  // No email service is configured, so submit opens a prefilled mailto: link.
  // TODO(Michel): post to an API route (e.g. Resend) and keep this as fallback.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const v = (k: Field) => String(data.get(k) ?? "").trim();
    const next: Partial<Record<Field, string>> = {};
    (["name", "email", "subject", "message"] as Field[]).forEach((k) => {
      if (!v(k)) next[k] = c.required;
    });
    if (v("email") && !EMAIL_RE.test(v("email"))) next.email = c.badEmail;
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const subject = `${v("subject")}: ${v("name")}`;
    const body = `${v("message")}\n\n${c.mailFrom}: ${v("name")} <${v("email")}>`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  if (sent) {
    return (
      <div className="c-success" role="status">
        <p className="c-success-title">{c.successTitle}</p>
        <p className="c-form-text">
          {c.successText} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <button type="button" className="c-link-btn c-mono" onClick={() => setSent(false)}>
          {c.again}
        </button>
      </div>
    );
  }

  const err = (k: Field) =>
    errors[k] ? (
      <span className="c-error" id={`c-${k}-err`}>
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: Field) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `c-${k}-err` : undefined,
  });

  return (
    <form className="c-form" onSubmit={onSubmit} noValidate>
      <label className="c-field">
        <span className="c-mono c-flabel">{c.name} *</span>
        <input name="name" type="text" autoComplete="name" placeholder={c.namePh} required {...aria("name")} />
        {err("name")}
      </label>
      <label className="c-field">
        <span className="c-mono c-flabel">{c.email} *</span>
        <input name="email" type="email" autoComplete="email" placeholder={c.emailPh} required {...aria("email")} />
        {err("email")}
      </label>
      <label className="c-field c-full">
        <span className="c-mono c-flabel">{c.subject} *</span>
        <span className="c-select">
          <select name="subject" required defaultValue="" {...aria("subject")}>
            <option value="" disabled>
              {c.subjectPh}
            </option>
            {c.subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </span>
        {err("subject")}
      </label>
      <label className="c-field c-full">
        <span className="c-mono c-flabel">{c.message} *</span>
        <textarea name="message" rows={5} placeholder={c.messagePh} required {...aria("message")} />
        {err("message")}
      </label>
      <div className="c-full">
        <button type="submit" className="c-send c-mono">
          {c.send}
          <svg className="c-arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>
    </form>
  );
}
