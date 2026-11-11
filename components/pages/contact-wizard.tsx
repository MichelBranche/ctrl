"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { flushSync } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { submitContact } from "@/app/actions/public";
import { Glyph, type GlyphName } from "@/components/pages/contact-glyphs";
import { contactCopy } from "@/components/pages/contact-copy";
import {
  BUDGET_IDS, GOAL_IDS, SERVICE_IDS, TIMING_IDS,
  inquiryCopy, normalizePhone, parseInquiry, readDraft, stepIssue, summaryText, thanksLine,
  type BudgetId, type Draft, type GoalId, type InquiryIssue, type ServiceId, type TimingId,
} from "@/lib/contact-inquiry";
import { CONTACT_EMAIL } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";

gsap.registerPlugin(useGSAP);

const STORAGE_KEY = "ctrl-contact-wizard-v1";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function readStorage(): string | null {
  try { return sessionStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}

const EMPTY: Draft = {
  services: [], goal: null, budget: null, timing: null,
  name: "", email: "", phone: "", note: "", step: 0,
};

const BUDGET_ICON: Record<BudgetId, GlyphName> = {
  under_1500: "under", to_3000: "mid", to_6000: "high", over_6000: "top", unsure: "unsure",
};
const GOAL_ICON: Record<GoalId, GlyphName> = {
  leads: "leads", bookings: "bookings", rebuild: "rebuild", scratch: "scratch", other: "other",
};
const TIMING_ICON: Record<TimingId, GlyphName> = {
  asap: "asap", quarter: "quarter", exploring: "exploring",
};

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function issueText(lang: Locale, issue: InquiryIssue): string {
  const c = inquiryCopy[lang];
  switch (issue) {
    case "services": return c.needOne;
    case "goal":
    case "budget":
    case "timing": return c.needChoice;
    case "name": return c.needName;
    case "email": return c.badEmail;
    case "phone": return c.badPhone;
    default: {
      const exhaustive: never = issue;
      return exhaustive;
    }
  }
}

const stepLabel = (n: number) => String(n).padStart(2, "0");

function RollNum({ value }: { value: number }) {
  const scope = useRef<HTMLSpanElement>(null);
  const [anim, setAnim] = useState({ prev: value, next: value, dir: 1, id: 0 });
  if (value !== anim.next) {
    setAnim({ prev: anim.next, next: value, dir: value >= anim.next ? 1 : -1, id: anim.id + 1 });
  }
  useGSAP(() => {
    const spans = scope.current?.querySelectorAll("span");
    if (!spans || spans.length < 2) return;
    const [out, inn] = spans;
    if (!out || !inn || anim.prev === anim.next || reducedMotion()) {
      gsap.set(out ?? inn, { autoAlpha: anim.prev === anim.next ? 0 : 1 });
      gsap.set(inn, { yPercent: 0, autoAlpha: 1 });
      return;
    }
    gsap.fromTo(out, { yPercent: 0, autoAlpha: 1 }, { yPercent: -100 * anim.dir, autoAlpha: 0, duration: 0.42, ease: "power3.inOut" });
    gsap.fromTo(inn, { yPercent: 100 * anim.dir, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out" });
  }, { dependencies: [anim.id], scope, revertOnUpdate: true });
  return (
    <span className="cw-roll" ref={scope} aria-hidden="true">
      <span>{stepLabel(anim.prev)}</span>
      <span>{stepLabel(anim.next)}</span>
    </span>
  );
}

export function ContactForm({ lang }: { lang: Locale }) {
  const c = inquiryCopy[lang];
  const legal = contactCopy[lang];
  const root = useRef<HTMLFormElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const moving = useRef(false);
  const arm = useRef<number | null>(null);
  const draftRef = useRef<Draft>(EMPTY);
  const storedRaw = useSyncExternalStore(subscribeStorage, readStorage, () => null);
  const [bootKey, setBootKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  // Read the saved draft once. Later writes must not flow back into state: that replay
  // was dropping whichever chip the visitor had just toggled.
  if (storedRaw !== null && bootKey === null) {
    setBootKey(storedRaw);
    const saved = readDraft(storedRaw);
    if (saved) {
      setDraft(() => {
        draftRef.current = saved;
        return saved;
      });
    }
  }
  const ready = bootKey !== null;
  const [hint, setHint] = useState<InquiryIssue | null>(null);
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; phone?: boolean }>({});
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<"" | "rate" | "unavailable">("");
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState("");

  const { contextSafe } = useGSAP(() => {}, { scope: root });

  const playTo = contextSafe((el: HTMLElement, vars: gsap.TweenVars) => new Promise<void>((resolve) => {
    gsap.to(el, { ...vars, overwrite: "auto", onComplete: resolve, onInterrupt: resolve });
  }));
  const playFromTo = contextSafe((el: HTMLElement, from: gsap.TweenVars, to: gsap.TweenVars) => new Promise<void>((resolve) => {
    gsap.fromTo(el, from, { ...to, overwrite: "auto", onComplete: resolve, onInterrupt: resolve });
  }));
  const shake = contextSafe((el: HTMLElement | null) => {
    if (!el || reducedMotion()) return;
    gsap.fromTo(el, { x: 0 }, {
      keyframes: [
        { x: -7, duration: 0.07 },
        { x: 6, duration: 0.07 },
        { x: -3, duration: 0.06 },
        { x: 0, duration: 0.08 },
      ],
      overwrite: "auto",
    });
  });
  const popCheck = contextSafe((input: HTMLInputElement) => {
    if (!input.checked || reducedMotion()) return;
    const badge = input.closest(".cw-chip")?.querySelector<HTMLElement>(".cw-check");
    if (!badge) return;
    gsap.fromTo(badge, { scale: 0.4, autoAlpha: 0 }, {
      scale: 1, autoAlpha: 1, duration: 0.38, ease: "back.out(2.4)", overwrite: "auto",
      onComplete: () => gsap.set(badge, { clearProps: "opacity,visibility,transform" }),
    });
  });

  useLayoutEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...draft })); } catch { /* private mode */ }
  }, [ready, draft]);

  useLayoutEffect(() => {
    const box = shell.current;
    const body = panel.current;
    if (!box || !body) return;
    const fit = (immediate: boolean) => {
      const next = body.scrollHeight;
      if (Math.abs(box.getBoundingClientRect().height - next) < 1) return;
      if (immediate || reducedMotion()) gsap.set(box, { height: next });
      else gsap.to(box, { height: next, duration: 0.55, ease: "power3.inOut", overwrite: "auto" });
    };
    fit(true);
    const observer = new ResizeObserver(() => fit(false));
    observer.observe(body);
    return () => {
      observer.disconnect();
      gsap.killTweensOf(box);
    };
  }, []);

  useGSAP(() => {
    const el = bar.current;
    if (!el) return;
    const scale = (Math.min(draft.step, 4) + 1) / 5;
    if (reducedMotion()) gsap.set(el, { scaleX: scale });
    else gsap.to(el, { scaleX: scale, duration: 0.5, ease: "power3.inOut", overwrite: "auto" });
  }, { dependencies: [draft.step], scope: root, revertOnUpdate: true });

  useGSAP(() => {
    if (draft.step !== 5 || reducedMotion()) return;
    const bits = root.current?.querySelectorAll<HTMLElement>("[data-cw-in]");
    if (!bits?.length) return;
    gsap.fromTo(bits, { y: 14, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.07, ease: "power3.out", delay: 0.05,
      clearProps: "transform,opacity,visibility",
    });
  }, { dependencies: [draft.step], scope: root, revertOnUpdate: true });

  const clearArm = () => {
    if (arm.current !== null) window.clearTimeout(arm.current);
    arm.current = null;
  };

  const focusStep = () => {
    panel.current?.querySelector<HTMLElement>("[data-cw-focus]")?.focus({ preventScroll: true });
  };

  const go = async (next: number, dir: 1 | -1, patch?: Partial<Draft>) => {
    if (moving.current) return;
    moving.current = true;
    const body = panel.current;
    try {
      if (body && !reducedMotion()) {
        await playTo(body, { x: -40 * dir, autoAlpha: 0, filter: "blur(8px)", duration: 0.26, ease: "power2.in" });
      }
      const resolved = { ...draftRef.current, ...patch, step: next };
      draftRef.current = resolved;
      flushSync(() => setDraft(resolved));
      if (body && !reducedMotion()) {
        await playFromTo(
          body,
          { x: 48 * dir, autoAlpha: 0, filter: "blur(8px)" },
          { x: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.48, ease: "power3.out", clearProps: "filter,transform,opacity,visibility" },
        );
      } else if (body) {
        gsap.set(body, { clearProps: "filter,transform,opacity,visibility" });
      }
      focusStep();
    } finally {
      moving.current = false;
    }
  };

  const commit = (update: (current: Draft) => Draft) => {
    const resolved = update(draftRef.current);
    draftRef.current = resolved;
    setDraft(resolved);
  };

  const forward = async () => {
    clearArm();
    if (moving.current || pending) return;
    const current = draftRef.current;
    if (current.step >= 5) return;
    const issue = stepIssue(current.step, current);
    if (issue) {
      setHint(issue);
      if (current.step === 4) setTouched({ name: true, email: true, phone: true });
      const target = current.step === 4
        ? root.current?.querySelector<HTMLElement>(issue === "name" ? "[name=name]" : issue === "phone" ? "[name=phone]" : "[name=email]")
        : root.current?.querySelector<HTMLElement>("[data-cw-shake]");
      shake(target ?? null);
      (target ?? root.current?.querySelector<HTMLElement>("[data-cw-focus]"))?.focus({ preventScroll: true });
      return;
    }
    setHint(null);
    setFailure("");
    if (current.step < 4) {
      await go(current.step + 1, 1);
      return;
    }
    const parsed = parseInquiry({ ...current, lang });
    if (!parsed.ok) {
      setHint(parsed.issues[0] ?? "name");
      return;
    }
    const data = new FormData();
    parsed.inquiry.services.forEach((id) => data.append("services", id));
    data.set("goal", parsed.inquiry.goal);
    data.set("budget", parsed.inquiry.budget);
    data.set("timing", parsed.inquiry.timing);
    data.set("name", parsed.inquiry.name);
    data.set("email", parsed.inquiry.email);
    data.set("phone", current.phone);
    data.set("note", parsed.inquiry.note);
    data.set("lang", lang);
    const trap = root.current?.querySelector<HTMLInputElement>("[name=company_site]");
    if (trap?.value) data.set("company_site", trap.value);
    setPending(true);
    const res = await submitContact(data).catch(() => ({ ok: false as const, error: "unavailable" as const }));
    setPending(false);
    if (!res.ok) {
      setFailure(res.error === "rate" ? "rate" : "unavailable");
      return;
    }
    setCopied(false);
    setCopyFallback("");
    await go(5, 1, {
      name: parsed.inquiry.name,
      email: parsed.inquiry.email,
      phone: parsed.inquiry.phone ?? "",
      note: parsed.inquiry.note,
    });
  };

  const scheduleAdvance = () => {
    clearArm();
    const run = () => {
      if (moving.current) {
        arm.current = window.setTimeout(run, 80);
        return;
      }
      void forward();
    };
    arm.current = window.setTimeout(run, reducedMotion() ? 160 : 420);
  };

  useEffect(() => () => clearArm(), []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void forward();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const target = event.target;
    if (event.key === "Enter" && target instanceof HTMLElement && target.hasAttribute("data-cw-focus")) {
      event.preventDefault();
      void forward();
      return;
    }
    if (!(target instanceof HTMLElement) || target instanceof HTMLTextAreaElement) return;
    if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "email" || target.type === "tel")) return;
    if (draft.step >= 4) return;
    const index = Number(event.key);
    if (Number.isInteger(index) && index >= 1 && index <= 9) {
      const input = panel.current?.querySelectorAll<HTMLInputElement>(".cw-chip input")[index - 1];
      if (!input) return;
      event.preventDefault();
      input.click();
      return;
    }
    if (draft.step !== 0) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    if (!(target instanceof HTMLInputElement) || !target.closest(".cw-multi")) return;
    const inputs = [...(panel.current?.querySelectorAll<HTMLInputElement>(".cw-multi input") ?? [])];
    const at = inputs.indexOf(target);
    if (at < 0) return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    inputs[(at + delta + inputs.length) % inputs.length]?.focus();
  };

  const toggleService = (id: ServiceId, input: HTMLInputElement) => {
    popCheck(input);
    setHint((h) => (h === "services" ? null : h));
    commit((d) => {
      const picked = new Set(d.services);
      if (picked.has(id)) picked.delete(id);
      else picked.add(id);
      return { ...d, services: SERVICE_IDS.filter((item) => picked.has(item)) };
    });
  };

  const pickSingle = <T extends string>(key: "goal" | "budget" | "timing", id: T, input: HTMLInputElement) => {
    popCheck(input);
    setHint(null);
    commit((d) => ({ ...d, [key]: id }));
  };

  const show = (field: "name" | "email" | "phone", invalid: boolean) => (touched[field] || hint === field) && invalid;
  const nameInvalid = show("name", !draft.name.trim());
  const emailInvalid = show("email", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim()));
  const phoneInvalid = show("phone", !normalizePhone(draft.phone).ok);
  const intlPhone = /^\s*(\+|00)/.test(draft.phone);
  const question = c.questions[Math.min(draft.step, 4)] ?? c.questions[0];
  const live = !ready ? "" : draft.step >= 5
    ? `${thanksLine(lang, draft.name)} ${c.promise}`
    : `${c.step} ${draft.step + 1} ${c.of} 5. ${question.title}`;

  const copySummary = async () => {
    const parsed = parseInquiry({ ...draft, lang });
    if (!parsed.ok) return;
    const text = summaryText(lang, parsed.inquiry);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFallback("");
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyFallback(text);
    }
  };

  const restart = () => {
    clearArm();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setHint(null);
    setFailure("");
    setCopied(false);
    setCopyFallback("");
    setTouched({});
    void go(0, -1, { ...EMPTY, services: [] });
  };

  return (
    <form className="cw" ref={root} onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate data-step={draft.step} data-no-reveal="">
      <div className="cw-top">
        <p className="c-mono cw-kicker">{draft.step >= 5 ? c.sent : c.kicker}</p>
        <p className="c-mono cw-count">
          <RollNum value={draft.step >= 5 ? 5 : draft.step + 1} />
          <span className="cw-count-rest" aria-hidden="true"> / 05</span>
        </p>
      </div>
      <div className="cw-track" aria-hidden="true"><span ref={bar} /></div>
      <p className="cw-sr" aria-live="polite" aria-atomic="true">{live}</p>
      <div className="cw-shell" ref={shell}>
        <div className="cw-panel" ref={panel}>
          {draft.step >= 5 ? (
            <div className="cw-success">
              <h2 className="cw-thanks" data-cw-in data-cw-focus tabIndex={-1}>{thanksLine(lang, draft.name)}</h2>
              <p className="cw-promise" data-cw-in>{c.promise}</p>
              <button type="button" className="cw-copy" data-cw-in onClick={() => { void copySummary(); }}>
                <Glyph name="copy" />
                {copied ? c.copied : c.copy}
              </button>
              <p className="cw-sr" aria-live="polite">{copied ? c.copied : ""}</p>
              {copyFallback ? (
                <textarea className="cw-fallback" readOnly value={copyFallback} aria-label={c.copy} onFocus={(e) => e.currentTarget.select()} />
              ) : null}
              <div className="cw-actions" data-cw-in>
                <a className="cw-home" href={localize("/", lang)}>{c.home}</a>
                <button type="button" className="cw-again" onClick={restart}>{c.again}</button>
              </div>
            </div>
          ) : draft.step === 4 ? (
            <div className="cw-ask" data-cw-shake>
              <p className="cw-q" id="cw-q" data-cw-focus tabIndex={-1}>{question.title}</p>
              <p className="cw-sub" id="cw-sub">{question.hint}</p>
              <div className="cw-fields">
                <label className="cw-float">
                  <input
                    name="name" type="text" autoComplete="name" placeholder=" " required enterKeyHint="next"
                    value={draft.name} aria-invalid={nameInvalid} aria-describedby={nameInvalid ? "cw-name-err" : "cw-sub"}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    onChange={(e) => {
                      const name = e.target.value;
                      commit((d) => ({ ...d, name }));
                      if (name.trim()) setHint((h) => (h === "name" ? null : h));
                    }}
                  />
                  <span className="cw-lab">{c.name}</span>
                  {nameInvalid ? <span className="cw-hint" id="cw-name-err" role="alert">{c.needName}</span> : null}
                </label>
                <label className="cw-float">
                  <input
                    name="email" type="email" autoComplete="email" inputMode="email" placeholder=" " required enterKeyHint="next"
                    spellCheck={false} value={draft.email} aria-invalid={emailInvalid} aria-describedby={emailInvalid ? "cw-email-err" : undefined}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    onChange={(e) => {
                      const email = e.target.value;
                      commit((d) => ({ ...d, email }));
                      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) setHint((h) => (h === "email" ? null : h));
                    }}
                  />
                  <span className="cw-lab">{c.email}</span>
                  {emailInvalid ? <span className="cw-hint" id="cw-email-err" role="alert">{c.badEmail}</span> : null}
                </label>
                <label className={`cw-float${intlPhone ? "" : " has-prefix"}`}>
                  {intlPhone ? null : <span className="cw-prefix" aria-hidden="true">+39</span>}
                  <input
                    name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder=" " enterKeyHint="next"
                    value={draft.phone} aria-invalid={phoneInvalid} aria-describedby={phoneInvalid ? "cw-phone-err" : undefined}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    onChange={(e) => {
                      const phone = e.target.value;
                      commit((d) => ({ ...d, phone }));
                      if (normalizePhone(phone).ok) setHint((h) => (h === "phone" ? null : h));
                    }}
                  />
                  <span className="cw-lab">{c.phone}{intlPhone ? null : <span className="cw-sr">, +39</span>}</span>
                  {phoneInvalid ? <span className="cw-hint" id="cw-phone-err" role="alert">{c.badPhone}</span> : null}
                </label>
                <label className="cw-float">
                  <textarea
                    name="note" rows={3} placeholder=" " enterKeyHint="send" value={draft.note}
                    onChange={(e) => commit((d) => ({ ...d, note: e.target.value }))}
                  />
                  <span className="cw-lab">{c.note}</span>
                </label>
                <p className="cw-note-hint">{c.noteHint}</p>
              </div>
              <p className="cw-consent">
                {legal.consent} <a href={localize("/privacy", lang)}>{legal.privacyLink}</a>.
              </p>
            </div>
          ) : (
            <fieldset className={`cw-set${draft.step === 0 ? " cw-multi" : ""}`} data-cw-shake aria-describedby={hint ? "cw-hint" : undefined} aria-invalid={hint ? true : undefined}>
              <legend data-cw-focus tabIndex={-1}>
                <span className="cw-q">{question.title}</span>
                <span className="cw-sub">{question.hint}</span>
              </legend>
              <div className="cw-options">
                {draft.step === 0 ? SERVICE_IDS.map((id) => (
                  <label className="cw-chip" key={id}>
                    <input
                      type="checkbox" name="services" value={id} checked={draft.services.includes(id)}
                      onChange={(e) => toggleService(id, e.currentTarget)}
                    />
                    <Glyph name={id} />
                    <span className="cw-chip-label">{c.services[id]}</span>
                    <span className="cw-check" aria-hidden="true"><Glyph name="check" /></span>
                  </label>
                )) : null}
                {draft.step === 1 ? GOAL_IDS.map((id) => (
                  <label className="cw-chip" key={id}>
                    <input
                      type="radio" name="goal" value={id} checked={draft.goal === id}
                      onChange={(e) => pickSingle("goal", id, e.currentTarget)}
                      onClick={() => scheduleAdvance()}
                    />
                    <Glyph name={GOAL_ICON[id]} />
                    <span className="cw-chip-label">{c.goals[id]}</span>
                    <span className="cw-check" aria-hidden="true"><Glyph name="check" /></span>
                  </label>
                )) : null}
                {draft.step === 2 ? BUDGET_IDS.map((id) => (
                  <label className="cw-chip" key={id}>
                    <input
                      type="radio" name="budget" value={id} checked={draft.budget === id}
                      onChange={(e) => pickSingle("budget", id, e.currentTarget)}
                      onClick={() => scheduleAdvance()}
                    />
                    <Glyph name={BUDGET_ICON[id]} />
                    <span className="cw-chip-label">{c.budgets[id]}</span>
                    <span className="cw-check" aria-hidden="true"><Glyph name="check" /></span>
                  </label>
                )) : null}
                {draft.step === 3 ? TIMING_IDS.map((id) => (
                  <label className="cw-chip" key={id}>
                    <input
                      type="radio" name="timing" value={id} checked={draft.timing === id}
                      onChange={(e) => pickSingle("timing", id, e.currentTarget)}
                      onClick={() => scheduleAdvance()}
                    />
                    <Glyph name={TIMING_ICON[id]} />
                    <span className="cw-chip-label">{c.timings[id]}</span>
                    <span className="cw-check" aria-hidden="true"><Glyph name="check" /></span>
                  </label>
                )) : null}
              </div>
              {hint ? <p className="cw-hint" id="cw-hint" role="alert">{issueText(lang, hint)}</p> : null}
            </fieldset>
          )}
          {draft.step < 5 ? (
            <>
              {failure ? (
                <p className="cw-fail" role="alert">
                  {failure === "rate" ? legal.rateError : legal.sendError}{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </p>
              ) : null}
              <button type="submit" className="cw-go" disabled={pending} aria-busy={pending}>
                <span>{pending ? c.sending : draft.step === 4 ? c.send : c.continue}</span>
                <svg className="cw-arrow" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              {draft.step > 0 ? (
                <button type="button" className="cw-back" onClick={() => { clearArm(); setHint(null); void go(draft.step - 1, -1); }}>{c.back}</button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <input className="c-hp" name="company_site" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    </form>
  );
}
