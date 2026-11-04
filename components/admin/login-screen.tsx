"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { signIn, type FormState } from "@/app/admin/actions";
import { SecondStepForm } from "@/components/admin/two-factor";

type Step = "password" | "code";

/**
 * Admin sign-in: password step and 2FA code step in one glass card, switched with a Motion slide.
 * Background: a still grid plus a soft orange glow that follows the pointer through two CSS variables
 * (one rAF per frame, compositor-only). Reduced motion: no glow tracking, fades instead of slides.
 * Security is unchanged: server actions (Next CSRF origin check), lockout, signed cookies all live server-side.
 */
export function LoginScreen({ initialStep = "password" }: { initialStep?: Step }) {
  const [step, setStep] = useState<Step>(initialStep);
  const reduce = useReducedMotion();
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || reduce || !matchMedia("(pointer: fine)").matches) return;
    let raf = 0, x = 0, y = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty("--gx", `${x}px`); el.style.setProperty("--gy", `${y}px`); });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, [reduce]);

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, x: 28, filter: "blur(4px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, exit: { opacity: 0, x: -28, filter: "blur(4px)" } };

  return (
    <main ref={root} className="adm-auth">
      <div className="adm-auth-bg" aria-hidden="true"><div className="adm-auth-grid" /><div className="adm-auth-glow" /></div>
      <motion.div className="adm-auth-card" layout={!reduce} transition={{ type: "spring", stiffness: 260, damping: 30 }}
        initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <div className="adm-auth-brand">
          <span className="adm-auth-mark" aria-hidden="true">C</span>
          <span className="adm-auth-word">CTRL<sup>®</sup></span>
          <span className="adm-auth-tag">Admin</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {step === "password" ? (
            <motion.div key="pw" {...slide} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <h1 className="adm-auth-title">Bentornato</h1>
              <p className="adm-auth-sub">Accedi all’area riservata dello studio.</p>
              <PasswordStep onTwoFactor={() => setStep("code")} />
            </motion.div>
          ) : (
            <motion.div key="code" {...slide} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <h1 className="adm-auth-title">Verifica in due passaggi</h1>
              <p className="adm-auth-sub">Inserisci il codice a 6 cifre dell’app di autenticazione.</p>
              <SecondStepForm />
              {initialStep === "code"
                ? <Link className="adm-otp-alt" href="/admin/login">Torna all’accesso</Link>
                : <button type="button" className="adm-otp-alt" onClick={() => setStep("password")}>Torna all’accesso</button>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <p className="adm-auth-foot">Connessione protetta · accesso registrato</p>
    </main>
  );
}

function PasswordStep({ onTwoFactor }: { onTwoFactor: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  const [email, setEmail] = useState("");
  const [show, setShow] = useState(false);
  const shake = useAnimationControls();
  const reduce = useReducedMotion();
  const seen = useRef(state);
  const id = useId();
  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.twoFactor) onTwoFactor();
    else if (state.error && !reduce) void shake.start({ x: [0, -10, 9, -6, 4, -2, 0], transition: { duration: 0.45 } });
  }, [state, onTwoFactor, reduce, shake]);
  return (
    <motion.form action={action} animate={shake} className="adm-auth-form" noValidate={false}>
      <div className="adm-float">
        <input id={`${id}-e`} name="email" type="email" autoComplete="username" required placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(state.error) || undefined} />
        <label htmlFor={`${id}-e`}>Email</label>
      </div>
      <div className="adm-float">
        <input id={`${id}-p`} name="password" type={show ? "text" : "password"} autoComplete="current-password" required placeholder=" " aria-invalid={Boolean(state.error) || undefined} />
        <label htmlFor={`${id}-p`}>Password</label>
        <button type="button" className="adm-float-eye" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Nascondi password" : "Mostra password"}>
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
      <AnimatePresence>
        {state.error ? (
          <motion.p key={state.error} className="adm-auth-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {state.error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <button className="adm-auth-btn" disabled={pending} aria-busy={pending}>
        {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> Accesso in corso…</> : "Accedi"}
      </button>
    </motion.form>
  );
}

const Eye = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
const EyeOff = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);
