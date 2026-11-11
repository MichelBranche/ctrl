"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { acceptInviteAction, type InviteState } from "@/app/admin/invite-actions";
import { AuthBackdrop, AuthCursor, ChromeMark, MagneticButton } from "@/components/admin/auth-fx";
import { Arrow, Eye, EyeOff, FloatField, item } from "@/components/admin/login-screen";
import { RequiredSetup } from "@/components/admin/required-setup";
import { TwoFactorPanel } from "@/components/admin/two-factor";
import { passwordScore } from "@/lib/password-strength";

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } };
const SCORE_LABEL = ["Troppo corta", "Debole", "Discreta", "Buona", "Ottima"] as const;

type Step = "password" | "setup" | "twofactor";
export type InviteInfo = { state: "valid"; name: string; email: string; roles: string[]; founder: boolean } | { state: "expired" | "invalid" };

/** Invite acceptance card, same glass look as the sign-in: password (+ strength meter), then 2FA. */
export function InviteScreen({ token, invite: live }: { token: string; invite: InviteInfo }) {
  // Accepting sets the session cookie, which re-renders the page with the now-consumed token ("invalid").
  // Keep the invite this card opened with, so the flow continues to the 2FA step instead of flipping to the error card.
  const [opened] = useState(live);
  const invite = opened.state === "valid" ? opened : live;
  const [step, setStep] = useState<Step>("password");
  const reduce = useReducedMotion();
  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, x: 32, filter: "blur(6px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, exit: { opacity: 0, x: -32, filter: "blur(6px)" } };
  const first = invite.state === "valid" ? invite.name.split(/\s+/)[0] : "";
  return (
    <main className="adm-auth">
      <AuthBackdrop />
      <AuthCursor />
      <motion.div
        className={`adm-auth-card${step !== "password" ? " is-wide" : ""}`}
        layout={!reduce}
        transition={{ layout: { type: "spring", stiffness: 240, damping: 30 } }}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }}
      >
        <motion.div variants={list} initial={reduce ? false : "hidden"} animate="show">
          <motion.div variants={item} className="adm-auth-brand">
            <ChromeMark />
            <span className="adm-auth-word">CTRL<sup>®</sup></span>
            <span className="adm-auth-tag">Team</span>
          </motion.div>
          {invite.state !== "valid" ? (
            <div>
              <motion.p variants={item} className="adm-auth-kicker">Invito</motion.p>
              <motion.h1 variants={item} className="adm-auth-title">{invite.state === "expired" ? "Invito scaduto." : "Invito non valido."}</motion.h1>
              <motion.p variants={item} className="adm-auth-sub">
                {invite.state === "expired"
                  ? "Il link valeva 48 ore. Chiedi al founder di inviartene uno nuovo dalla pagina Team."
                  : "Il link è già stato usato, è stato revocato o non è corretto. Se hai già scelto la password, accedi normalmente."}
              </motion.p>
              <motion.div variants={item}><Link className="adm-otp-alt" href="/admin/login">Vai all’accesso</Link></motion.div>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {step === "password" ? (
                <motion.div key="pw" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <motion.p variants={item} className="adm-auth-kicker">Passo 1 di 2 · Invito nel team</motion.p>
                  <motion.h1 variants={item} className="adm-auth-title">Benvenuto, {first}.</motion.h1>
                  <motion.p variants={item} className="adm-auth-sub">
                    Entri come <strong>{invite.roles.join(", ")}</strong> con {invite.email}. Scegli la tua password personale: la conosci solo tu.
                  </motion.p>
                  <PasswordStep token={token} onNext={setStep} />
                </motion.div>
              ) : step === "setup" ? (
                <motion.div key="setup" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <RequiredSetup />
                </motion.div>
              ) : (
                <motion.div key="tfa" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <p className="adm-auth-kicker">Passo 2 di 2 · Facoltativo</p>
                  <h1 className="adm-auth-title">Proteggi l’account</h1>
                  <p className="adm-auth-sub">Password salvata, sei dentro. Ti consigliamo la verifica in due passaggi: dopo la password l’accesso chiederà anche un codice dal telefono.</p>
                  <div className="adm-invite-tfa"><TwoFactorPanel enabled={false} recoveryLeft={0} /></div>
                  <Link className="adm-auth-ghost adm-invite-later" href="/admin">Più tardi, vai alla dashboard <Arrow /></Link>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </motion.div>
      <p className="adm-auth-foot">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        Connessione cifrata · il link si usa una sola volta
      </p>
    </main>
  );
}

function PasswordStep({ token, onNext }: { token: string; onNext: (s: Step) => void }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(acceptInviteAction.bind(null, token), {});
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
    if (state.next) onNext(state.next);
    else if (state.error && !reduce) void shake.start({ x: [0, -10, 9, -6, 4, -2, 0], transition: { duration: 0.45 } });
  }, [state, onNext, reduce, shake]);
  const score = passwordScore(pw);
  const mismatch = again !== "" && again !== pw;
  const ready = pw.length >= 12 && again === pw;
  return (
    <motion.form action={action} animate={shake} className="adm-auth-form">
      <motion.div variants={item}>
        <FloatField id={`${id}-p`} name="password" type={show ? "text" : "password"} label="Nuova password" autoComplete="new-password" invalid={Boolean(state.error)} value={pw} onChange={setPw}>
          <button type="button" className="adm-float-eye" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Nascondi password" : "Mostra password"}>
            {show ? <EyeOff /> : <Eye />}
          </button>
        </FloatField>
        <div className="adm-meter" data-score={score} aria-live="polite">
          <span className="adm-meter-bar" aria-hidden><i /><i /><i /><i /></span>
          <span className="adm-meter-label">{pw ? SCORE_LABEL[score] : "Almeno 12 caratteri. Meglio una frase lunga con numeri e simboli."}</span>
        </div>
      </motion.div>
      <motion.div variants={item}>
        <FloatField id={`${id}-c`} name="confirm" type={show ? "text" : "password"} label="Conferma password" autoComplete="new-password" invalid={mismatch} value={again} onChange={setAgain} />
        {mismatch ? <p className="adm-meter-label adm-meter-bad">Le due password non coincidono.</p> : null}
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
          {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> Salvataggio…</> : <>Accetta l’invito <Arrow /></>}
        </MagneticButton>
      </motion.div>
    </motion.form>
  );
}
