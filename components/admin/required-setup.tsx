"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { beginRequiredSetup, confirmRequiredSetup, finishRequiredSetup, type RequiredSetupState } from "@/app/admin/actions";
import { MagneticButton } from "@/components/admin/auth-fx";
import { CodeField } from "@/components/admin/two-factor";

type Phase = "intro" | "scan" | "codes";
const ORDER: Phase[] = ["intro", "scan", "codes"];

/**
 * Mandatory 2FA for founders, inside the login card. The server holds only a 15-minute setup ticket (no session):
 * intro, QR + manual key, confirm with a code, recovery codes, and only after "Ho salvato i codici" the session.
 */
export function RequiredSetup() {
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
      <ol className="adm-setup-steps" aria-label={`Passo ${at + 1} di 3`}>
        {ORDER.map((p, i) => (
          <li key={p}><motion.span initial={false} animate={{ scaleX: i <= at ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }} /></li>
        ))}
      </ol>
      <AnimatePresence mode="wait" initial={false}>
        {phase === "intro" ? (
          <motion.div key="intro" {...fade} transition={{ duration: 0.28 }}>
            <p className="adm-auth-kicker">Obbligatorio per i founder</p>
            <h1 className="adm-auth-title">Proteggi il tuo account</h1>
            <p className="adm-auth-sub">Il tuo ruolo dà accesso a tutto lo studio, quindi serve un secondo controllo oltre alla password. Ci vuole un minuto.</p>
            <ul className="adm-setup-points">
              <li><b>1</b><span>Installa un’app gratuita: Google Authenticator, Aegis, 2FAS o l’app Password di iPhone.</span></li>
              <li><b>2</b><span>Inquadra il codice QR e conferma con le 6 cifre che vedi nell’app.</span></li>
              <li><b>3</b><span>Salva i 10 codici di recupero: servono se perdi il telefono.</span></li>
            </ul>
            {startError ? <p className="adm-auth-error" role="alert">{startError}</p> : null}
            <MagneticButton type="button" className="adm-auth-btn" disabled={starting} aria-busy={starting}
              onClick={() => start(async () => {
                const r = await beginRequiredSetup();
                if (r.setup) { setSetup(r.setup); setPhase("scan"); } else setStartError(r.error);
              })}>
              {starting ? <><span className="adm-auth-spin" aria-hidden="true" /> Preparazione…</> : "Inizia la configurazione"}
            </MagneticButton>
          </motion.div>
        ) : phase === "scan" && setup ? (
          <motion.div key="scan" {...fade} transition={{ duration: 0.28 }}>
            <p className="adm-auth-kicker">Passo 2 di 3</p>
            <h1 className="adm-auth-title">Collega l’app</h1>
            <p className="adm-auth-sub">Inquadra il QR con l’app, poi inserisci il codice a 6 cifre che compare.</p>
            <div className="adm-setup-qr">
              {/* QR drawn on our server as SVG from the otpauth link: nothing leaves the site. */}
              <div className="adm-2fa-qr" role="img" aria-label="Codice QR per l’app di autenticazione" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
              <div className="adm-setup-key">
                <small>Non riesci a inquadrarlo? Inserisci a mano questa chiave, tipo “basata sul tempo”.</small>
                <code>{setup.secret}</code>
                <CopyButton text={setup.secret.replace(/\s/g, "")} label="Copia chiave" />
              </div>
            </div>
            <form ref={form} action={action} className="adm-form">
              <CodeField state={state} pending={pending} form={form} allowRecovery={false} autoFocus />
              <p role="status" aria-live="polite" className={state.error ? "adm-auth-error" : "adm-ok"}>{state.error ?? state.ok ?? ""}</p>
              <MagneticButton className="adm-auth-btn" disabled={pending || Boolean(state.codes)} aria-busy={pending}>
                {pending ? <><span className="adm-auth-spin" aria-hidden="true" /> Verifica…</> : "Conferma codice"}
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const [going, go] = useTransition();
  const router = useRouter();
  const reduce = useReducedMotion();
  const download = () => {
    const body = `CTRL Admin, codici di recupero\nCreati il ${new Date().toLocaleString("it-IT")}\nOgni codice funziona una sola volta.\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "ctrl-admin-codici-recupero.txt" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <p className="adm-auth-kicker">Passo 3 di 3</p>
      <h1 className="adm-auth-title">Salva i codici di recupero</h1>
      <p className="adm-auth-sub">Ognuno funziona una sola volta, se non hai il telefono. Non li mostreremo più: tienili in un posto sicuro, per esempio il gestore di password.</p>
      <ol className="adm-setup-codes">
        {codes.map((c, i) => (
          <motion.li key={c} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.3 }}>{c}</motion.li>
        ))}
      </ol>
      <div className="adm-setup-row">
        <CopyButton text={codes.join("\n")} label="Copia codici" />
        <button type="button" className="adm-auth-ghost" onClick={download}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
          Scarica .txt
        </button>
      </div>
      <div className="adm-form">
        <label className="adm-setup-check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          Ho salvato i codici in un posto sicuro
        </label>
        {error ? <p className="adm-auth-error" role="alert">{error}</p> : null}
        <MagneticButton type="button" className="adm-auth-btn" disabled={!saved || going} aria-busy={going}
          onClick={() => go(async () => {
            const r = await finishRequiredSetup();
            if (r.ok) router.replace("/admin"); else setError(r.error);
          })}>
          {going ? <><span className="adm-auth-spin" aria-hidden="true" /> Accesso…</> : "Entra nell’admin"}
        </MagneticButton>
      </div>
    </>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="adm-auth-ghost" onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1600); }, () => {})}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{done ? <path d="M5 12l5 5 9-10" /> : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h9" /></>}</svg>
      {done ? "Copiato" : label}
    </button>
  );
}
