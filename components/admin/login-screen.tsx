"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { signIn, type FormState } from "@/app/admin/actions";
import { requestResetAction, type ForgotState } from "@/app/admin/reset-actions";
import { REMEMBER_HOURS, SESSION_HOURS } from "@/lib/session-lifetime";
import { AuthBackdrop, AuthCursor, ChromeMark, MagneticButton } from "@/components/admin/auth-fx";
import { AdminLangSwitch } from "@/components/admin/admin-lang-switch";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { interpolate } from "@/lib/admin-i18n";
import { RequiredSetup } from "@/components/admin/required-setup";
import { SecondStepForm } from "@/components/admin/two-factor";

type Step = "password" | "code" | "setup" | "forgot" | "sent";

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } };
export const item: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Admin sign-in: password, 2FA code and the mandatory founder setup, all in one glass card switched with Motion.
 * Security stays server-side: the checkbox only requests a 72-hour cookie, and only after the password and 2FA.
 */
export function LoginScreen({ initialStep = "password", notice, noticeKey }: { initialStep?: Step; notice?: string; noticeKey?: "founderNotice" | "resetDone" }) {
  const { t } = useAdminLocale();
  const banner = noticeKey ? t.login[noticeKey] : notice;
  const [step, setStep] = useState<Step>(initialStep);
  // Typed once, reused: the forgot step starts with the address already entered on the sign-in form.
  const [email, setEmail] = useState("");
  const reduce = useReducedMotion();
  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, x: 32, filter: "blur(6px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, exit: { opacity: 0, x: -32, filter: "blur(6px)" } };
  const back = initialStep === "password"
    ? <button type="button" className="adm-otp-alt" onClick={() => setStep("password")}>{t.login.back}</button>
    : <Link className="adm-otp-alt" href="/admin/login">{t.login.back}</Link>;

  return (
    <main className="adm-auth">
      <AdminLangSwitch variant="auth" />
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
                <motion.p variants={item} className="adm-auth-kicker">{t.login.kicker}</motion.p>
                <motion.h1 variants={item} className="adm-auth-title">{t.login.title}</motion.h1>
                <motion.p variants={item} className="adm-auth-sub">{t.login.sub}</motion.p>
                {banner ? <motion.p variants={item} className="adm-auth-notice" role="status">{banner}</motion.p> : null}
                <PasswordStep onNext={setStep} email={email} setEmail={setEmail} />
              </motion.div>
            ) : step === "forgot" ? (
              <motion.div key="forgot" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                <p className="adm-auth-kicker">{t.reset.forgotKicker}</p>
                <h1 className="adm-auth-title">{t.reset.forgotTitle}</h1>
                <p className="adm-auth-sub">{t.reset.forgotSub}</p>
                <ForgotStep onSent={() => setStep("sent")} email={email} setEmail={setEmail} />
                <button type="button" className="adm-otp-alt" onClick={() => setStep("password")}>{t.login.back}</button>
              </motion.div>
            ) : step === "sent" ? (
              <motion.div key="sent" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                <SentMark />
                <p className="adm-auth-kicker">{t.reset.sentKicker}</p>
                <h1 className="adm-auth-title">{t.reset.sentTitle}</h1>
                <p className="adm-auth-sub">{t.reset.sentBody}</p>
                <p className="adm-auth-remember-note">{t.reset.sentHint}</p>
                <button type="button" className="adm-auth-ghost adm-auth-sent-back" onClick={() => setStep("password")}>{t.login.back} <Arrow /></button>
              </motion.div>
            ) : step === "code" ? (
              <motion.div key="code" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                <p className="adm-auth-kicker">{t.login.step2kicker}</p>
                <h1 className="adm-auth-title">{t.login.step2title}</h1>
                <p className="adm-auth-sub">{t.login.step2sub}</p>
                <p className="adm-auth-remember-note">{interpolate(t.login.rememberAfterCode, { n: REMEMBER_HOURS / 24 })}</p>
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
        {t.login.foot}
      </p>
    </main>
  );
}

export function FloatField({ id, name, type, label, autoComplete, invalid, value, onChange, children, required = true, maxLength }: {
  id: string; name: string; type: string; label: string; autoComplete: string; invalid: boolean;
  value?: string; onChange?: (v: string) => void; children?: React.ReactNode; required?: boolean; maxLength?: number;
}) {
  const [filled, setFilled] = useState(false);
  return (
    <div className={`adm-float${children ? " has-eye" : ""}`}>
      <input
        id={id} name={name} type={type} autoComplete={autoComplete} required={required} maxLength={maxLength} placeholder=" " value={value}
        data-filled={filled || Boolean(value) || undefined} aria-invalid={invalid || undefined}
        onChange={(e) => { onChange?.(e.target.value); setFilled(e.target.value !== ""); }}
        // Chrome fires this when it autofills (CSS animation on :-webkit-autofill), before the value is exposed to JS.
        onAnimationStart={(e) => { if (e.animationName === "adm-autofill") setFilled(true); }}
      />
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function PasswordStep({ onNext, email, setEmail }: { onNext: (s: Step) => void; email: string; setEmail: (v: string) => void }) {
  const { t } = useAdminLocale();
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
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
        <FloatField id={`${id}-e`} name="email" type="email" label={t.login.email} autoComplete="username" invalid={bad} value={email} onChange={setEmail} />
      </motion.div>
      <motion.div variants={item}>
        <FloatField id={`${id}-p`} name="password" type={show ? "text" : "password"} label={t.login.password} autoComplete="current-password" invalid={bad}>
          <button type="button" className="adm-float-eye" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t.login.hidePassword : t.login.showPassword}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={show ? "off" : "on"} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.15 }} style={{ display: "grid" }}>
                {show ? <EyeOff /> : <Eye />}
              </motion.span>
            </AnimatePresence>
          </button>
        </FloatField>
        <button type="button" className="adm-auth-forgot" onClick={() => onNext("forgot")}>{t.login.forgot}</button>
      </motion.div>
      <motion.div variants={item}>
        <label className="adm-auth-remember">
          <input id={`${id}-remember`} name="remember" type="checkbox" value="1" aria-describedby={`${id}-remember-note`} />
          <span>{interpolate(t.login.remember, { n: REMEMBER_HOURS / 24 })}</span>
        </label>
        <p className="adm-auth-remember-note" id={`${id}-remember-note`}>
          {interpolate(t.login.rememberNote, { n: SESSION_HOURS })}
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
          {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> {t.login.pending}</> : <>{t.login.submit} <Arrow /></>}
        </MagneticButton>
      </motion.div>
    </motion.form>
  );
}

/** Request step: always the same neutral answer (the server never says whether the address exists). */
function ForgotStep({ onSent, email, setEmail }: { onSent: () => void; email: string; setEmail: (v: string) => void }) {
  const { t } = useAdminLocale();
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestResetAction, {});
  const shake = useAnimationControls();
  const reduce = useReducedMotion();
  const seen = useRef(state);
  const id = useId();
  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.sent) onSent();
    else if (state.error && !reduce) void shake.start({ x: [0, -10, 9, -6, 4, -2, 0], transition: { duration: 0.45 } });
  }, [state, onSent, reduce, shake]);
  return (
    <motion.form action={action} animate={shake} className="adm-auth-form">
      <FloatField id={`${id}-e`} name="email" type="email" label={t.login.email} autoComplete="username" invalid={Boolean(state.error)} value={email} onChange={setEmail} />
      <AnimatePresence>
        {state.error ? (
          <motion.p key={state.error} className="adm-auth-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            {state.error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <MagneticButton className="adm-auth-btn" disabled={pending} aria-busy={pending}>
        {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> {t.reset.sending}</> : <>{t.reset.send} <Arrow /></>}
      </MagneticButton>
    </motion.form>
  );
}

const SentMark = () => (
  <motion.span className="adm-auth-sent-mark" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.08 }} aria-hidden="true">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
  </motion.span>
);

export const Arrow = () => (
  <svg className="arrow" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const Eye = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const EyeOff = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);
