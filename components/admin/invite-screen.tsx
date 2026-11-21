"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { acceptInviteAction, checkInviteProfileAction, type InviteProfileState, type InviteState } from "@/app/admin/invite-actions";
import { photoFileOk, squarePhoto } from "@/components/admin/profile-photo";
import { AuthBackdrop, AuthCursor, ChromeMark, MagneticButton } from "@/components/admin/auth-fx";
import { Arrow, Eye, EyeOff, FloatField, item } from "@/components/admin/login-screen";
import { RequiredSetup } from "@/components/admin/required-setup";
import { TwoFactorPanel } from "@/components/admin/two-factor";
import { passwordScore } from "@/lib/password-strength";
import { AdminLangSwitch } from "@/components/admin/admin-lang-switch";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { interpolate } from "@/lib/admin-i18n";

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } };
type Step = "profile" | "password" | "setup" | "twofactor";
/** Onboarding profile kept in the browser until the password step submits it with the token. */
type Profile = { name: string; lastName: string; phone: string; photo: string | null };
export type InviteInfo = { state: "valid"; name: string; lastName: string; phone: string; hasPhoto: boolean; email: string; roles: string[]; founder: boolean } | { state: "expired" | "invalid" };

/** Invite acceptance card, same glass look as the sign-in: profile, password (+ strength meter), then 2FA. */
export function InviteScreen({ token, invite: live }: { token: string; invite: InviteInfo }) {
  const { t } = useAdminLocale();
  // Accepting sets the session cookie, which re-renders the page with the now-consumed token ("invalid").
  // Keep the invite this card opened with, so the flow continues to the 2FA step instead of flipping to the error card.
  const [opened] = useState(live);
  const invite = opened.state === "valid" ? opened : live;
  const [step, setStep] = useState<Step>("profile");
  const [profile, setProfile] = useState<Profile>(() => opened.state === "valid" ? { name: opened.name, lastName: opened.lastName, phone: opened.phone, photo: null } : { name: "", lastName: "", phone: "", photo: null });
  const reduce = useReducedMotion();
  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, x: 32, filter: "blur(6px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, exit: { opacity: 0, x: -32, filter: "blur(6px)" } };
  const first = (profile.name || (invite.state === "valid" ? invite.name : "")).split(/\s+/)[0];
  return (
    <main className="adm-auth">
      <AdminLangSwitch variant="auth" />
      <AuthBackdrop />
      <AuthCursor />
      <motion.div
        className={`adm-auth-card${step !== "password" && step !== "profile" ? " is-wide" : ""}`}
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
              <motion.p variants={item} className="adm-auth-kicker">{t.invite.kickerInvalid}</motion.p>
              <motion.h1 variants={item} className="adm-auth-title">{invite.state === "expired" ? t.invite.expiredTitle : t.invite.invalidTitle}</motion.h1>
              <motion.p variants={item} className="adm-auth-sub">
                {invite.state === "expired" ? t.invite.expiredBody : t.invite.invalidBody}
              </motion.p>
              <motion.div variants={item}><Link className="adm-otp-alt" href="/admin/login">{t.invite.goLogin}</Link></motion.div>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {step === "profile" ? (
                <motion.div key="profile" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <motion.p variants={item} className="adm-auth-kicker">{t.invite.profileKicker}</motion.p>
                  <motion.h1 variants={item} className="adm-auth-title">{interpolate(t.invite.welcome, { name: first })}</motion.h1>
                  <motion.p variants={item} className="adm-auth-sub">
                    {t.invite.profileSub.split("{roles}").flatMap((part, i, arr) => {
                      const text = interpolate(part, { email: invite.email, name: first });
                      return i < arr.length - 1 ? [text, <strong key="roles">{invite.roles.join(", ")}</strong>] : [text];
                    })}
                  </motion.p>
                  <ProfileStep token={token} profile={profile} hasPhoto={invite.hasPhoto} onChange={setProfile} onNext={() => setStep("password")} />
                </motion.div>
              ) : step === "password" ? (
                <motion.div key="pw" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <motion.p variants={item} className="adm-auth-kicker">{t.invite.step1kicker}</motion.p>
                  <motion.h1 variants={item} className="adm-auth-title">{t.invite.passwordTitle}</motion.h1>
                  <motion.p variants={item} className="adm-auth-sub">
                    {t.invite.sub.split("{roles}").flatMap((part, i, arr) => {
                      const text = interpolate(part, { email: invite.email, name: first });
                      return i < arr.length - 1 ? [text, <strong key="roles">{invite.roles.join(", ")}</strong>] : [text];
                    })}
                  </motion.p>
                  <PasswordStep token={token} profile={profile} onNext={setStep} onBack={() => setStep("profile")} />
                </motion.div>
              ) : step === "setup" ? (
                <motion.div key="setup" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <RequiredSetup />
                </motion.div>
              ) : (
                <motion.div key="tfa" {...slide} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <p className="adm-auth-kicker">{t.invite.step2kicker}</p>
                  <h1 className="adm-auth-title">{t.invite.protectTitle}</h1>
                  <p className="adm-auth-sub">{t.invite.protectSub}</p>
                  <div className="adm-invite-tfa"><TwoFactorPanel enabled={false} recoveryLeft={0} /></div>
                  <Link className="adm-auth-ghost adm-invite-later" href="/admin">{t.invite.later} <Arrow /></Link>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </motion.div>
      <p className="adm-auth-foot">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        {t.invite.foot}
      </p>
    </main>
  );
}

function PasswordStep({ token, profile, onNext, onBack }: { token: string; profile: Profile; onNext: (s: Step) => void; onBack: () => void }) {
  const { t } = useAdminLocale();
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
      <input type="hidden" name="profile" value="1" />
      <input type="hidden" name="name" value={profile.name} />
      <input type="hidden" name="lastName" value={profile.lastName} />
      <input type="hidden" name="phone" value={profile.phone} />
      <input type="hidden" name="photo" value={profile.photo ?? ""} />
      <motion.div variants={item}>
        <FloatField id={`${id}-p`} name="password" type={show ? "text" : "password"} label={t.invite.newPassword} autoComplete="new-password" invalid={Boolean(state.error)} value={pw} onChange={setPw}>
          <button type="button" className="adm-float-eye" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t.login.hidePassword : t.login.showPassword}>
            {show ? <EyeOff /> : <Eye />}
          </button>
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
          {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> {t.invite.saving}</> : <>{t.invite.accept} <Arrow /></>}
        </MagneticButton>
      </motion.div>
      <motion.div variants={item}><button type="button" className="adm-otp-alt" onClick={onBack} disabled={pending}>{t.invite.back}</button></motion.div>
    </motion.form>
  );
}

/** Step "Il tuo profilo": name and surname prefilled from the invite, optional phone and photo. Validated on the server. */
function ProfileStep({ token, profile, hasPhoto, onChange, onNext }: { token: string; profile: Profile; hasPhoto: boolean; onChange: Dispatch<SetStateAction<Profile>>; onNext: () => void }) {
  const { t } = useAdminLocale();
  const [state, action, pending] = useActionState<InviteProfileState, FormData>(checkInviteProfileAction.bind(null, token), {});
  const [photoMsg, setPhotoMsg] = useState("");
  const shake = useAnimationControls();
  const reduce = useReducedMotion();
  const seen = useRef(state);
  const id = useId();
  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.ok) onNext();
    else if (state.error && !reduce) void shake.start({ x: [0, -10, 9, -6, 4, -2, 0], transition: { duration: 0.45 } });
  }, [state, onNext, reduce, shake]);
  const set = (patch: Partial<Profile>) => onChange((p) => ({ ...p, ...patch }));
  return (
    <motion.form action={action} animate={shake} className="adm-auth-form">
      <input type="hidden" name="photo" value={profile.photo ?? ""} />
      <motion.div variants={item}>
        <FloatField id={`${id}-n`} name="name" type="text" label={t.invite.firstName} autoComplete="given-name" invalid={Boolean(state.error)} value={profile.name} onChange={(v) => set({ name: v })} maxLength={100} />
      </motion.div>
      <motion.div variants={item}>
        <FloatField id={`${id}-l`} name="lastName" type="text" label={t.invite.lastName} autoComplete="family-name" invalid={false} value={profile.lastName} onChange={(v) => set({ lastName: v })} required={false} maxLength={100} />
      </motion.div>
      <motion.div variants={item}>
        <FloatField id={`${id}-t`} name="phone" type="tel" label={t.invite.phone} autoComplete="tel" invalid={false} value={profile.phone} onChange={(v) => set({ phone: v })} required={false} maxLength={40} />
        <p className="adm-meter-label">{t.invite.phoneHelp}</p>
      </motion.div>
      <motion.div variants={item} className="adm-invite-photo">
        <span className="adm-invite-photo-preview" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
          {profile.photo ? <img src={profile.photo} alt="" width={48} height={48} /> : <span>{(profile.name || "?").slice(0, 2).toUpperCase()}</span>}
        </span>
        <span className="adm-invite-photo-body">
          <span className="adm-meter-label">{t.invite.photo}</span>
          <span className="adm-invite-photo-actions">
            <label className="adm-otp-alt adm-invite-photo-pick">
              {t.invite.photoChoose}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="adm-sr-only" disabled={pending} onChange={async (event) => {
                const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
                setPhotoMsg("");
                if (!photoFileOk(file)) { setPhotoMsg(t.profile.photoInvalid); return; }
                try { set({ photo: await squarePhoto(file) }); } catch { setPhotoMsg(t.profile.photoUnreadable); }
              }} />
            </label>
            {profile.photo ? <button type="button" className="adm-otp-alt" onClick={() => set({ photo: null })} disabled={pending}>{t.invite.photoRemove}</button> : null}
          </span>
          {photoMsg ? <span className="adm-meter-label adm-meter-bad" role="alert">{photoMsg}</span> : !profile.photo && hasPhoto ? <span className="adm-meter-label">{t.invite.photoKept}</span> : null}
        </span>
      </motion.div>
      <AnimatePresence>
        {state.error ? (
          <motion.p key={state.error} className="adm-auth-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            {state.error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <motion.div variants={item}>
        <MagneticButton className="adm-auth-btn" disabled={pending || !profile.name.trim()} aria-busy={pending}>
          {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> {t.invite.checking}</> : <>{t.invite.profileNext} <Arrow /></>}
        </MagneticButton>
      </motion.div>
    </motion.form>
  );
}
