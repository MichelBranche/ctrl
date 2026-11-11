"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { OtpInput, type OtpStatus } from "@/components/admin/otp-input";
import { signInSecondStep, type FormState } from "@/app/admin/actions";
import { confirmTwoFactor, disableTwoFactor, startTwoFactor, type TwoFactorState } from "@/app/admin/two-factor-actions";

/** Animated 6-digit field that submits its form when complete, plus a link to type a recovery code instead. */
export function CodeField({ state, pending, form, allowRecovery, autoFocus }: {
  state: { error?: string; ok?: string }; pending: boolean; form: React.RefObject<HTMLFormElement | null>; allowRecovery: boolean; autoFocus?: boolean;
}) {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [errorKey, setErrorKey] = useState(0);
  // React to a new action result during render (no effect round-trip).
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.error) { setStatus("error"); setErrorKey((k) => k + 1); setCode(""); }
    else if (state.ok) setStatus("success");
  }
  // After a wrong code the input was disabled while pending and lost focus: give it back so retyping just works.
  useEffect(() => {
    if (errorKey) form.current?.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.focus();
  }, [errorKey, form]);
  if (recovery) {
    return (
      <>
        <label className="adm-field">
          <span>Codice di recupero</span>
          <input className="adm-input adm-2fa-code" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} required autoFocus placeholder="XXXX-XXXX-XXXX" />
        </label>
        <button type="button" className="adm-otp-alt" onClick={() => setRecovery(false)}>Usa il codice dell’app</button>
      </>
    );
  }
  return (
    <>
      <div className="adm-field">
        <span id="otp-label">Codice a 6 cifre</span>
        <OtpInput
          name="code" label="Codice a 6 cifre" value={code} status={status} errorKey={errorKey} disabled={pending || status === "success"} autoFocus={autoFocus}
          onChange={(v) => { setCode(v); if (status === "error") setStatus("idle"); }}
          onComplete={() => requestAnimationFrame(() => form.current?.requestSubmit())}
        />
      </div>
      {allowRecovery ? <button type="button" className="adm-otp-alt" onClick={() => setRecovery(true)}>Non hai il telefono? Usa un codice di recupero</button> : null}
    </>
  );
}

/** Login step 2: 6-digit code (auto-submit) or recovery code. */
export function SecondStepForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signInSecondStep, {});
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(() => router.replace("/admin"), 650);
    return () => clearTimeout(t);
  }, [state, router]);
  return (
    <form ref={form} action={action} className="adm-form">
      <CodeField state={state} pending={pending} form={form} allowRecovery autoFocus />
      <p role="status" aria-live="polite" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? state.ok ?? (pending ? "Verifica…" : "")}</p>
      <button className="adm-btn adm-btn-primary" disabled={pending || Boolean(state.ok)}>{pending ? "Verifica…" : "Verifica"}</button>
    </form>
  );
}

/** Settings panel: enable (QR + manual key + confirm) or disable (password + code). */
export function TwoFactorPanel({ enabled, recoveryLeft, canDisable = true }: { enabled: boolean; recoveryLeft: number; canDisable?: boolean }) {
  if (enabled && !canDisable) {
    return (
      <p className="adm-muted">
        Stato: <strong>attiva</strong>. Codici di recupero rimasti: {recoveryLeft} su 10. Come founder non puoi disattivarla: se perdi telefono e codici, un altro founder può azzerarla dal Team e al prossimo accesso la configuri di nuovo.
      </p>
    );
  }
  if (enabled) return <DisableForm recoveryLeft={recoveryLeft} />;
  return <EnableFlow />;
}

function EnableFlow() {
  const [setup, setSetup] = useState<TwoFactorState | null>(null);
  const [starting, start] = useTransition();
  const [state, action, pending] = useActionState<TwoFactorState, FormData>(confirmTwoFactor, {});
  const form = useRef<HTMLFormElement>(null);
  const [showCodes, setShowCodes] = useState(false);
  useEffect(() => {
    if (!state.codes) return;
    const t = setTimeout(() => setShowCodes(true), 700); // let the green success stagger play first
    return () => clearTimeout(t);
  }, [state]);
  if (state.codes && showCodes) return <RecoveryCodes codes={state.codes} />;
  if (!setup?.setup) {
    return (
      <div className="adm-form">
        <p className="adm-muted">Stato: <strong>non attiva</strong>. Serve un’app gratuita come Google Authenticator, Aegis, 2FAS o l’app Password di iPhone.</p>
        {setup?.error ? <p className="adm-error" role="alert">{setup.error}</p> : null}
        <div className="adm-row-actions">
          <button type="button" className="adm-btn adm-btn-primary" disabled={starting} onClick={() => start(async () => setSetup(await startTwoFactor()))}>
            {starting ? "Preparazione…" : "Attiva verifica in due passaggi"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <form ref={form} action={action} className="adm-form">
      <p className="adm-muted">1. Inquadra il codice QR con l’app di autenticazione.</p>
      {/* QR generated on our server as SVG from the otpauth link; nothing leaves the site. */}
      <div className="adm-2fa-qr" role="img" aria-label="Codice QR per l’app di autenticazione" dangerouslySetInnerHTML={{ __html: setup.setup.qrSvg }} />
      <p className="adm-muted">Non riesci a inquadrarlo? Inserisci a mano questa chiave (tipo: basata sul tempo):</p>
      <code className="adm-2fa-secret">{setup.setup.secret}</code>
      <p className="adm-muted">2. Inserisci il codice a 6 cifre mostrato dall’app.</p>
      <CodeField state={state} pending={pending} form={form} allowRecovery={false} />
      <p role="status" aria-live="polite" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? state.ok ?? ""}</p>
      <div className="adm-row-actions">
        <button className="adm-btn adm-btn-primary" disabled={pending}>{pending ? "Verifica…" : "Conferma e attiva"}</button>
        <button type="button" className="adm-btn" onClick={() => setSetup(null)}>Annulla</button>
      </div>
    </form>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="adm-form">
      <p className="adm-ok" role="status">Verifica in due passaggi attiva.</p>
      <p><strong>Salva ora questi 10 codici di recupero.</strong> Ognuno funziona una sola volta, se perdi il telefono. Non li mostreremo più.</p>
      <ol className="adm-2fa-codes">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ol>
      <div className="adm-row-actions">
        <button type="button" className="adm-btn" onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => setCopied(true))}>{copied ? "Copiati" : "Copia codici"}</button>
      </div>
    </div>
  );
}

function DisableForm({ recoveryLeft }: { recoveryLeft: number }) {
  const [state, action, pending] = useActionState<TwoFactorState, FormData>(disableTwoFactor, {});
  const form = useRef<HTMLFormElement>(null);
  if (state.ok) return <p className="adm-ok" role="status">{state.ok}</p>;
  return (
    <form ref={form} action={action} className="adm-form">
      <p className="adm-muted">Stato: <strong>attiva</strong>. Codici di recupero rimasti: {recoveryLeft} su 10.</p>
      <p className="adm-muted">Per disattivarla servono la password e un codice dell’app (o un codice di recupero).</p>
      <label className="adm-field">
        <span>Password attuale</span>
        <input className="adm-input" name="password" type="password" autoComplete="current-password" required />
      </label>
      <DisableCode state={state} pending={pending} form={form} />
      {state.error ? <p className="adm-error" role="alert">{state.error}</p> : null}
      <div className="adm-row-actions">
        <button className="adm-btn" disabled={pending}>{pending ? "Disattivazione…" : "Disattiva"}</button>
      </div>
    </form>
  );
}

/** Disable needs the password too, so no auto-submit: the code field only fills, the button sends. */
function DisableCode(props: { state: TwoFactorState; pending: boolean; form: React.RefObject<HTMLFormElement | null> }) {
  const noSubmit = useRef<HTMLFormElement | null>(null);
  return <CodeField {...props} form={noSubmit} allowRecovery />;
}
