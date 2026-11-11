"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { signIn, type FormState } from "@/app/admin/actions";
import { REMEMBER_HOURS, SESSION_HOURS } from "@/lib/session-lifetime";
import { AuthBackdrop, AuthCursor, ChromeMark, MagneticButton } from "@/components/admin/auth-fx";
import { RequiredSetup } from "@/components/admin/required-setup";
import { SecondStepForm } from "@/components/admin/two-factor";

type Step = "password" | "code" | "setup";

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } };
export const item: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Admin sign-in: password, 2FA code and the mandatory founder setup, all in one glass card switched with Motion.
 * Security stays server-side: the checkbox only requests a 72-hour cookie, and only after the password and 2FA.
 */
export function LoginScreen({ initialStep = "password", notice }: { initialStep?: Step; notice?: string }) {
  const [step, setStep] = useState<Step>(initialStep);
  const reduce = useReducedMotion();
  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, x: 32, filter: "blur(6px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, exit: { opacity: 0, x: -32, filter: "blur(6px)" } };
  const back = initialStep === "password"
    ? <button type="button" className="adm-otp-alt" onClick={() => setStep("password")}>Torna all’accesso</button>
    : <Link className="adm-otp-alt" href="/admin/login">Torna all’accesso</Link>;

  return (
    <main className="adm-auth">
      <AuthBackdrop />
      <AuthCursor />
      <motion.div
        className={`adm-auth-card${step === "setup" ? " is-wide" : ""}`}
        layout={!reduce}
        transition={{ layout: { type: "spring", stiffness: 240, damping: 30 } }}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }}
      >
        <motion.div variants={list} initial={reduce ? false : "hidden"} animate="show">
          <motion.div variants={item} className="adm-auth-brand">
            <ChromeMark />
            <span className="adm-auth-word">CTRL<sup>®</sup></span>
            <span className="adm-auth-tag">Admin</span>
          </motion.div>
          <AnimatePresence mode="wait" initial={false}>
            {step === "password" ? (
              <motion.div key="pw" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                <motion.p variants={item} className="adm-auth-kicker">Area riservata</motion.p>
                <motion.h1 variants={item} className="adm-auth-title">Bentornato.</motion.h1>
                <motion.p variants={item} className="adm-auth-sub">Accedi per gestire progetti, journal e team dello studio.</motion.p>
                {notice ? <motion.p variants={item} className="adm-auth-notice" role="status">{notice}</motion.p> : null}
                <PasswordStep onNext={setStep} />
              </motion.div>
            ) : step === "code" ? (
              <motion.div key="code" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                <p className="adm-auth-kicker">Passo 2 di 2</p>
                <h1 className="adm-auth-title">Verifica in due passaggi</h1>
                <p className="adm-auth-sub">Apri l’app di autenticazione e inserisci il codice a 6 cifre.</p>
                <p className="adm-auth-remember-note">Se hai scelto «Resta collegato», i {REMEMBER_HOURS / 24} giorni partono solo dopo questo codice.</p>
                <SecondStepForm />
                {back}
              </motion.div>
            ) : (
              <motion.div key="setup" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                <RequiredSetup />
                {back}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
      <p className="adm-auth-foot">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        Connessione cifrata · ogni accesso è registrato
      </p>
    </main>
  );
}

export function FloatField({ id, name, type, label, autoComplete, invalid, value, onChange, children }: {
  id: string; name: string; type: string; label: string; autoComplete: string; invalid: boolean;
  value?: string; onChange?: (v: string) => void; children?: React.ReactNode;
}) {
  const [filled, setFilled] = useState(false);
  return (
    <div className={`adm-float${children ? " has-eye" : ""}`}>
      <input
        id={id} name={name} type={type} autoComplete={autoComplete} required placeholder=" " value={value}
        data-filled={filled || undefined} aria-invalid={invalid || undefined}
        onChange={(e) => { onChange?.(e.target.value); setFilled(e.target.value !== ""); }}
        // Chrome fires this when it autofills (CSS animation on :-webkit-autofill), before the value is exposed to JS.
        onAnimationStart={(e) => { if (e.animationName === "adm-autofill") setFilled(true); }}
      />
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function PasswordStep({ onNext }: { onNext: (s: Step) => void }) {
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
    if (state.twoFactor) onNext("code");
    else if (state.setup) onNext("setup");
    else if (state.error && !reduce) void shake.start({ x: [0, -10, 9, -6, 4, -2, 0], transition: { duration: 0.45 } });
  }, [state, onNext, reduce, shake]);
  const bad = Boolean(state.error);
  return (
    <motion.form action={action} animate={shake} className="adm-auth-form">
      <motion.div variants={item}>
        <FloatField id={`${id}-e`} name="email" type="email" label="Email" autoComplete="username" invalid={bad} value={email} onChange={setEmail} />
      </motion.div>
      <motion.div variants={item}>
        <FloatField id={`${id}-p`} name="password" type={show ? "text" : "password"} label="Password" autoComplete="current-password" invalid={bad}>
          <button type="button" className="adm-float-eye" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Nascondi password" : "Mostra password"}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={show ? "off" : "on"} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.15 }} style={{ display: "grid" }}>
                {show ? <EyeOff /> : <Eye />}
              </motion.span>
            </AnimatePresence>
          </button>
        </FloatField>
      </motion.div>
      <motion.div variants={item}>
        <label className="adm-auth-remember">
          <input id={`${id}-remember`} name="remember" type="checkbox" value="1" aria-describedby={`${id}-remember-note`} />
          <span>Resta collegato per {REMEMBER_HOURS / 24} giorni su questo dispositivo</span>
        </label>
        <p className="adm-auth-remember-note" id={`${id}-remember-note`}>
          Se non la spunti, l’accesso dura {SESSION_HOURS} ore. Su un computer condiviso lasciala deselezionata.
        </p>
      </motion.div>
      <AnimatePresence>
        {state.error ? (
          <motion.p key={state.error} className="adm-auth-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            {state.error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <motion.div variants={item}>
        <MagneticButton className="adm-auth-btn" disabled={pending} aria-busy={pending}>
          {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> Accesso in corso…</> : <>Accedi <Arrow /></>}
        </MagneticButton>
      </motion.div>
    </motion.form>
  );
}

export const Arrow = () => (
  <svg className="arrow" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const Eye = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const EyeOff = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);
