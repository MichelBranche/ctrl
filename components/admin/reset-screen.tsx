"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { resetPasswordAction, type ResetState } from "@/app/admin/reset-actions";
import { AdminLangSwitch } from "@/components/admin/admin-lang-switch";
import { AuthBackdrop, AuthCursor, ChromeMark, MagneticButton } from "@/components/admin/auth-fx";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { Arrow, Eye, EyeOff, FloatField, item } from "@/components/admin/login-screen";
import { passwordScore } from "@/lib/password-strength";

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } };
export type ResetInfo = "valid" | "expired" | "invalid";

/** Landing card of the reset email: same glass card and Motion entrance as the sign-in. Success goes back to sign-in. */
export function ResetScreen({ token, view }: { token: string; view: ResetInfo }) {
  const { t } = useAdminLocale();
  const reduce = useReducedMotion();
  return (
    <main className="adm-auth">
      <AdminLangSwitch variant="auth" />
      <AuthBackdrop />
      <AuthCursor />
      <motion.div
        className="adm-auth-card"
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
          {view !== "valid" ? (
            <div>
              <motion.p variants={item} className="adm-auth-kicker">{t.reset.kickerInvalid}</motion.p>
              <motion.h1 variants={item} className="adm-auth-title">{view === "expired" ? t.reset.expiredTitle : t.reset.invalidTitle}</motion.h1>
              <motion.p variants={item} className="adm-auth-sub">{view === "expired" ? t.reset.expiredBody : t.reset.invalidBody}</motion.p>
              <motion.div variants={item}>
                <Link className="adm-auth-ghost" href="/admin/login/recupero">{t.reset.requestNew} <Arrow /></Link>
              </motion.div>
              <motion.div variants={item}><Link className="adm-otp-alt" href="/admin/login">{t.login.back}</Link></motion.div>
            </div>
          ) : (
            <div>
              <motion.p variants={item} className="adm-auth-kicker">{t.reset.resetKicker}</motion.p>
              <motion.h1 variants={item} className="adm-auth-title">{t.reset.resetTitle}</motion.h1>
              <motion.p variants={item} className="adm-auth-sub">{t.reset.resetSub}</motion.p>
              <NewPassword token={token} />
              <motion.div variants={item}><Link className="adm-otp-alt" href="/admin/login">{t.login.back}</Link></motion.div>
            </div>
          )}
        </motion.div>
      </motion.div>
      <p className="adm-auth-foot">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        {t.login.foot}
      </p>
    </main>
  );
}

function NewPassword({ token }: { token: string }) {
  const { t } = useAdminLocale();
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPasswordAction.bind(null, token), {});
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const shake = useAnimationControls();
  const reduce = useReducedMotion();
  const seen = useRef(state);
  const id = useId();
  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.error && !reduce) void shake.start({ x: [0, -10, 9, -6, 4, -2, 0], transition: { duration: 0.45 } });
  }, [state, reduce, shake]);
  const score = passwordScore(pw);
  const mismatch = again !== "" && again !== pw;
  const ready = pw.length >= 12 && again === pw;
  const eye = (
    <button type="button" className="adm-float-eye" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t.login.hidePassword : t.login.showPassword}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={show ? "off" : "on"} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.15 }} style={{ display: "grid" }}>
          {show ? <EyeOff /> : <Eye />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
  return (
    <motion.form action={action} animate={shake} className="adm-auth-form">
      <motion.div variants={item}>
        <FloatField id={`${id}-p`} name="password" type={show ? "text" : "password"} label={t.invite.newPassword} autoComplete="new-password" invalid={Boolean(state.error)} value={pw} onChange={setPw}>
          {eye}
        </FloatField>
        <div className="adm-meter" data-score={score} aria-live="polite">
          <span className="adm-meter-bar" aria-hidden><i /><i /><i /><i /></span>
          <span className="adm-meter-label">{pw ? t.invite.scores[score] : t.invite.scoreHint}</span>
        </div>
      </motion.div>
      <motion.div variants={item}>
        <FloatField id={`${id}-c`} name="confirm" type={show ? "text" : "password"} label={t.invite.confirmPassword} autoComplete="new-password" invalid={mismatch} value={again} onChange={setAgain} />
        {mismatch ? <p className="adm-meter-label adm-meter-bad">{t.invite.mismatch}</p> : null}
      </motion.div>
      <AnimatePresence>
        {state.error ? (
          <motion.p key={state.error} className="adm-auth-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            {state.error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <motion.div variants={item}>
        <MagneticButton className="adm-auth-btn" disabled={pending || !ready} aria-busy={pending}>
          {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> {t.reset.saving}</> : <>{t.reset.save} <Arrow /></>}
        </MagneticButton>
      </motion.div>
    </motion.form>
  );
}
