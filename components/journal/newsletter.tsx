"use client";

import { useState, type FormEvent } from "react";
import { JArrow } from "@/components/journal/arrow";
import type { JournalCopy } from "@/components/journal/journal-copy";
import { CONTACT_EMAIL } from "@/lib/content";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * TODO(newsletter): no provider is connected yet. This only validates the
 * address in the browser and stores nothing. Wire a provider (e.g. Resend
 * audiences or Buttondown) behind a server action before promising signups.
 */
export function Newsletter({ copy }: { copy: JournalCopy }) {
  const [state, setState] = useState<"idle" | "invalid" | "done">("idle");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setState(EMAIL.test(value) ? "done" : "invalid");
  };

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
        <button type="submit" className="j-pill" data-magnetic>
          <span>{copy.newsCta}</span>
          <JArrow />
        </button>
        <p id="j-news-msg" className="j-news-msg" role="status" data-state={state}>
          {state === "invalid" ? copy.newsInvalid : state === "done" ? copy.newsSoon.replace("{email}", CONTACT_EMAIL) : ""}
        </p>
      </form>
    </section>
  );
}
