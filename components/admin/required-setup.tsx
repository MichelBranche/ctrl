"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { beginRequiredSetup, confirmRequiredSetup, finishRequiredSetup, type RequiredSetupState } from "@/app/admin/actions";
import { MagneticButton } from "@/components/admin/auth-fx";
import { CodeField } from "@/components/admin/two-factor";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { formatAdminDateTime, interpolate } from "@/lib/admin-i18n";

type Phase = "intro" | "scan" | "codes";
const ORDER: Phase[] = ["intro", "scan", "codes"];

/**
 * Mandatory 2FA for founders, inside the login card. The server holds only a 15-minute setup ticket (no session):
 * intro, QR + manual key, confirm with a code, recovery codes, and only after "Ho salvato i codici" the session.
 */
export function RequiredSetup() {
  const { t } = useAdminLocale();
  const [phase, setPhase] = useState<Phase>("intro");
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [startError, setStartError] = useState<string>();
  const [starting, start] = useTransition();
  const [state, action, pending] = useActionState<RequiredSetupState, FormData>(confirmRequiredSetup, {});
  const form = useRef<HTMLFormElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!state.codes) return;
    const t = setTimeout(() => setPhase("codes"), 700); // let the green stagger land first
    return () => clearTimeout(t);
  }, [state]);

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };
  const at = ORDER.indexOf(phase);

  return (
    <div>
      <ol className="adm-setup-steps" aria-label={interpolate(t.setup.stepsAria, { n: at + 1 })}>
        {ORDER.map((p, i) => (
          <li key={p}><motion.span initial={false} animate={{ scaleX: i <= at ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }} /></li>
        ))}
      </ol>
      <AnimatePresence mode="wait" initial={false}>
        {phase === "intro" ? (
          <motion.div key="intro" {...fade} transition={{ duration: 0.28 }}>
            <p className="adm-auth-kicker">{t.setup.introKicker}</p>
            <h1 className="adm-auth-title">{t.setup.introTitle}</h1>
            <p className="adm-auth-sub">{t.setup.introSub}</p>
            <ul className="adm-setup-points">
              <li><b>1</b><span>{t.setup.point1}</span></li>
              <li><b>2</b><span>{t.setup.point2}</span></li>
              <li><b>3</b><span>{t.setup.point3}</span></li>
            </ul>
            {startError ? <p className="adm-auth-error" role="alert">{startError}</p> : null}
            <MagneticButton type="button" className="adm-auth-btn" disabled={starting} aria-busy={starting}
              onClick={() => start(async () => {
                const r = await beginRequiredSetup();
                if (r.setup) { setSetup(r.setup); setPhase("scan"); } else setStartError(r.error);
              })}>
              {starting ? <><span className="adm-auth-spin" aria-hidden="true" /> {t.setup.preparing}</> : t.setup.start}
            </MagneticButton>
          </motion.div>
        ) : phase === "scan" && setup ? (
          <motion.div key="scan" {...fade} transition={{ duration: 0.28 }}>
            <p className="adm-auth-kicker">{t.setup.scanKicker}</p>
            <h1 className="adm-auth-title">{t.setup.scanTitle}</h1>
            <p className="adm-auth-sub">{t.setup.scanSub}</p>
            <div className="adm-setup-qr">
              {/* QR drawn on our server as SVG from the otpauth link: nothing leaves the site. */}
              <div className="adm-2fa-qr" role="img" aria-label={t.twoFactor.qrAria} dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
              <div className="adm-setup-key">
                <small>{t.setup.manualKey}</small>
                <code>{setup.secret}</code>
                <CopyButton text={setup.secret.replace(/\s/g, "")} label={t.setup.copyKey} />
              </div>
            </div>
            <form ref={form} action={action} className="adm-form">
              <CodeField state={state} pending={pending} form={form} allowRecovery={false} autoFocus />
              <p role="status" aria-live="polite" className={state.error ? "adm-auth-error" : "adm-ok"}>{state.error ?? state.ok ?? ""}</p>
              <MagneticButton className="adm-auth-btn" disabled={pending || Boolean(state.codes)} aria-busy={pending}>
                {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> {t.setup.verifying}</> : t.setup.confirmCode}
              </MagneticButton>
            </form>
          </motion.div>
        ) : state.codes ? (
          <motion.div key="codes" {...fade} transition={{ duration: 0.28 }}>
            <SavedCodes codes={state.codes} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SavedCodes({ codes }: { codes: string[] }) {
  const { lang, t } = useAdminLocale();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const [going, go] = useTransition();
  const router = useRouter();
  const reduce = useReducedMotion();
  const download = () => {
    const body = interpolate(t.setup.downloadBody, { date: formatAdminDateTime(new Date(), lang), codes: codes.join("\n") });
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: t.setup.downloadFile });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <p className="adm-auth-kicker">{t.setup.codesKicker}</p>
      <h1 className="adm-auth-title">{t.setup.codesTitle}</h1>
      <p className="adm-auth-sub">{t.setup.codesSub}</p>
      <ol className="adm-setup-codes">
        {codes.map((c, i) => (
          <motion.li key={c} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.3 }}>{c}</motion.li>
        ))}
      </ol>
      <div className="adm-setup-row">
        <CopyButton text={codes.join("\n")} label={t.twoFactor.copyCodes} />
        <button type="button" className="adm-auth-ghost" onClick={download}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
          {t.setup.download}
        </button>
      </div>
      <div className="adm-form">
        <label className="adm-setup-check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          {t.setup.savedCheck}
        </label>
        {error ? <p className="adm-auth-error" role="alert">{error}</p> : null}
        <MagneticButton type="button" className="adm-auth-btn" disabled={!saved || going} aria-busy={going}
          onClick={() => go(async () => {
            const r = await finishRequiredSetup();
            if (r.ok) router.replace("/admin"); else setError(r.error);
          })}>
          {going ? <><span className="adm-auth-spin" aria-hidden="true" /> {t.setup.entering}</> : t.setup.enter}
        </MagneticButton>
      </div>
    </>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useAdminLocale();
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="adm-auth-ghost" onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1600); }, () => {})}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{done ? <path d="M5 12l5 5 9-10" /> : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h9" /></>}</svg>
      {done ? t.setup.copied : label}
    </button>
  );
}
