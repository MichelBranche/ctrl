"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { addJob, createUser, deleteJob, reactivateUser, removeUser, resendUserInvite, resetUserPassword, resetUserTwoFactor, revokeUserInvite, setLeaderboardVisible, updateUser, type TeamState } from "@/app/admin/team-actions";
import type { InviteStatus } from "@/lib/team-invite-core";
import { OFFBOARDING_SUBJECT, offboardingText } from "@/lib/team-offboarding";
import { AREA_LABEL, AREAS, isFounder, permissionsFor, ROLE_COLOR, ROLE_LABEL, SECTION_LABEL, TEAM_ROLES, type Area, type TeamRole } from "@/lib/team-types";

function Status({ state }: { state: TeamState }) {
  return (
    <p role="status" className={state.error ? "adm-error" : "adm-ok"}>
      {state.error ?? state.ok ?? ""}
    </p>
  );
}

function useResetOnOk(state: TeamState) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return form;
}

function AreaSelect({ name = "area", value, optional }: { name?: string; value: Area | null; optional?: boolean }) {
  return (
    <select className="adm-input" name={name} defaultValue={value ?? ""} required={!optional}>
      {optional ? <option value="">Nessuna</option> : <option value="" disabled>Scegli…</option>}
      {AREAS.map((a) => (
        <option key={a} value={a}>{AREA_LABEL[a]}</option>
      ))}
    </select>
  );
}

/** Log a paid job. Founders pick whose job it is; members always log their own. */
export function JobForm({ area, today, people, me }: { area: Area | null; today: string; people: { id: string; name: string }[] | null; me: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(addJob, {});
  const form = useResetOnOk(state);
  return (
    <form ref={form} action={action} className="adm-form adm-job-form" id="nuovo">
      {people ? (
        <label className="adm-field">
          <span>Persona</span>
          <select className="adm-input" name="user" defaultValue={me}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="adm-field">
        <span>Cliente</span>
        <input className="adm-input" name="client" maxLength={120} required />
      </label>
      <label className="adm-field adm-span">
        <span>Descrizione</span>
        <input className="adm-input" name="description" maxLength={500} required />
      </label>
      <label className="adm-field">
        <span>Importo (€)</span>
        <input className="adm-input adm-num" name="amount" inputMode="decimal" placeholder="1.250,00" required />
      </label>
      <label className="adm-field">
        <span>Data</span>
        <input className="adm-input" name="date" type="date" defaultValue={today} max={today} required />
      </label>
      <label className="adm-field">
        <span>Area</span>
        <AreaSelect value={area} />
      </label>
      <div className="adm-row-actions adm-span">
        <button className="adm-btn adm-btn-primary" disabled={pending}>{pending ? "Salvataggio…" : "Registra lavoro"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function DeleteJob({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="adm-btn adm-btn-sm adm-btn-danger"
      disabled={pending}
      aria-label={`Elimina ${label}`}
      onClick={() => {
        if (!confirm(`Eliminare il lavoro "${label}"?`)) return;
        start(async () => {
          const r = await deleteJob(id).catch(() => ({ ok: false }));
          if (!r.ok) alert("Eliminazione non riuscita.");
        });
      }}
    >
      {pending ? "…" : "Elimina"}
    </button>
  );
}

/** Founder-only switch: "Leaderboard visibile al team". Optimistic, reverts on failure. */
export function LeaderboardSwitch({ visible }: { visible: boolean }) {
  const [on, setOn] = useOptimistic(visible);
  const [pending, start] = useTransition();
  return (
    <div className="adm-switch-cell adm-setting">
      <div>
        <strong id="lb-label">Leaderboard visibile al team</strong>
        <p className="adm-muted">Se attiva, i membri vedono la classifica con i totali di tutti. I dettagli dei singoli lavori restano visibili solo a chi li ha registrati e al founder.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="lb-label"
        className="adm-switch"
        data-on={on || undefined}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            setOn(!on);
            const r = await setLeaderboardVisible(!on).catch(() => ({ ok: false }));
            if (!r.ok) alert("Impostazione non salvata.");
          })
        }
      >
        <span className="adm-switch-knob" />
      </button>
    </div>
  );
}

/**
 * Multi-select role chips (checkboxes named "roles", so the form works without JS). Shows the resulting permissions
 * live: the union of the chosen roles. `locked` roles stay checked and can't be removed (a founder's own founder role).
 */
export function RoleChips({ value, locked = [], idPrefix }: { value: readonly TeamRole[]; locked?: readonly TeamRole[]; idPrefix: string }) {
  const [picked, setPicked] = useState<TeamRole[]>([...value]);
  const sections = [...permissionsFor(picked)];
  return (
    <fieldset className="adm-field adm-span adm-roles">
      <legend>Ruoli <span className="adm-muted">(anche più di uno)</span></legend>
      <div className="adm-chips" role="group" aria-label="Ruoli">
        {TEAM_ROLES.map((r) => {
          const on = picked.includes(r);
          const lock = locked.includes(r);
          return (
            <label key={r} className="adm-chip" data-on={on || undefined} style={{ "--chip": ROLE_COLOR[r] } as React.CSSProperties} title={lock ? "Non puoi togliere a te stesso il ruolo founder." : undefined}>
              <input
                type="checkbox"
                id={`${idPrefix}-${r}`}
                name="roles"
                value={r}
                checked={on}
                disabled={lock}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r] : p.filter((x) => x !== r)))}
              />
              {lock ? <input type="hidden" name="roles" value={r} /> : null}
              <span className="adm-chip-dot" aria-hidden />
              {ROLE_LABEL[r]}
            </label>
          );
        })}
      </div>
      <p className="adm-muted adm-roles-sum" aria-live="polite">
        {!picked.length
          ? "Scegli almeno un ruolo."
          : isFounder(picked)
            ? "Accesso completo, Team e Registro compresi. Verifica in due passaggi obbligatoria."
            : `Può aprire: ${sections.map((x) => SECTION_LABEL[x]).join(", ")}.`}
      </p>
    </fieldset>
  );
}

export function NewUserForm() {
  const [state, action, pending] = useActionState<TeamState, FormData>(createUser, {});
  const form = useResetOnOk(state);
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [key, setKey] = useState(0);
  return (
    // form.reset() after a success also resets the chips (they are controlled).
    <form ref={form} action={action} className="adm-form adm-job-form" onReset={() => setKey((k) => k + 1)}>
      <input type="hidden" name="mode" value={mode} />
      <label className="adm-field">
        <span>Nome</span>
        <input className="adm-input" name="name" maxLength={80} required />
      </label>
      <label className="adm-field">
        <span>Email</span>
        <input className="adm-input" name="email" type="email" autoComplete="off" required />
      </label>
      <RoleChips key={key} value={[]} idPrefix="new" />
      <label className="adm-field">
        <span>Area principale (introiti)</span>
        <AreaSelect value={null} optional />
      </label>
      <label className="adm-check">
        <input type="checkbox" name="email_access" /> Accesso alla casella email dell&apos;agenzia
      </label>
      <details className="adm-span adm-alt" onToggle={(e) => setMode((e.target as HTMLDetailsElement).open ? "password" : "invite")}>
        <summary className="adm-muted">Senza email: imposta tu una password da comunicare di persona</summary>
        {mode === "password" ? (
          <label className="adm-field">
            <span>Password iniziale (almeno 12 caratteri)</span>
            <input className="adm-input" name="password" type="password" autoComplete="new-password" minLength={12} required />
          </label>
        ) : null}
      </details>
      <div className="adm-row-actions adm-span">
        <button className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? (mode === "invite" ? "Invio…" : "Creazione…") : mode === "invite" ? "Invita nel team" : "Crea profilo con password"}
        </button>
        <Status state={state} />
      </div>
      {mode === "invite" ? (
        <p className="adm-muted adm-span">Riceverà un&apos;email dall&apos;agenzia con il pulsante &quot;Accetta l&apos;invito&quot;: sceglie lui la password. Il link vale 48 ore e si usa una volta sola.</p>
      ) : null}
    </form>
  );
}

/** Resend / revoke for people who have not accepted yet (or never signed in). */
export function InviteControls({ id, status, canInvite }: { id: string; status: InviteStatus; canInvite: boolean }) {
  const [state, setState] = useState<TeamState>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<TeamState>) => start(async () => setState(await fn().catch(() => ({ error: "Operazione non riuscita." }))));
  if (!canInvite) return null;
  const open = status === "invitato";
  return (
    <div className="adm-row-actions adm-invite-actions">
      <button type="button" className="adm-btn adm-btn-sm adm-btn-primary" disabled={pending} onClick={() => run(() => resendUserInvite(id))}>
        {pending ? "…" : status === "attivo" || status === "disattivato" ? "Invita nel team" : "Reinvia invito"}
      </button>
      {open ? (
        <button type="button" className="adm-btn adm-btn-sm adm-btn-danger" disabled={pending} onClick={() => { if (confirm("Revocare l'invito? Il link smetterà subito di funzionare.")) run(() => revokeUserInvite(id)); }}>
          Revoca invito
        </button>
      ) : null}
      <Status state={state} />
    </div>
  );
}

export function EditUserForm({ user, self }: { user: { id: string; name: string; roles: TeamRole[]; area: Area | null; active: boolean; emailAccess: boolean; status: InviteStatus; lastLoginAt: string | null }; self: boolean }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(updateUser, {});
  const [pwState, pwAction, pwPending] = useActionState<TeamState, FormData>(resetUserPassword, {});
  const pwForm = useResetOnOk(pwState);
  const [tfState, tfAction, tfPending] = useActionState<TeamState, FormData>(resetUserTwoFactor, {});
  const founder = isFounder(user.roles);
  const invitePending = user.status === "invitato" || user.status === "scaduto" || user.status === "revocato";
  const canInvite = !self && (invitePending || !user.active || user.lastLoginAt === null);
  return (
    <div className="adm-user-edit">
      <InviteControls id={user.id} status={user.status} canInvite={canInvite} />
      <form action={action} className="adm-form adm-job-form">
        <input type="hidden" name="id" value={user.id} />
        <label className="adm-field">
          <span>Nome</span>
          <input className="adm-input" name="name" defaultValue={user.name} maxLength={80} required />
        </label>
        <label className="adm-field">
          <span>Area principale (introiti)</span>
          <AreaSelect value={user.area} optional />
        </label>
        <RoleChips value={user.roles} locked={self ? ["founder"] : []} idPrefix={`u-${user.id}`} />
        <label className="adm-check" title={invitePending ? "Si attiva da solo quando accetta l'invito." : undefined}>
          <input type="checkbox" name="active" defaultChecked={user.active} disabled={self || invitePending} /> Attivo
          {self ? <input type="hidden" name="active" value="on" /> : null}
        </label>
        <label className="adm-check" title="Casella condivisa dell'agenzia, indipendente dai ruoli. Il founder la vede sempre.">
          <input type="checkbox" name="email_access" defaultChecked={user.emailAccess} disabled={founder} /> Email agenzia
          {founder ? <input type="hidden" name="email_access" value="on" /> : null}
        </label>
        <div className="adm-row-actions adm-span">
          <button className="adm-btn adm-btn-sm" disabled={pending}>{pending ? "Salvataggio…" : "Salva"}</button>
          <Status state={state} />
        </div>
      </form>
      {self ? (
        <p className="adm-muted">La tua password si cambia da Impostazioni.</p>
      ) : invitePending ? null : (
        <form ref={pwForm} action={pwAction} className="adm-form adm-job-form">
          <input type="hidden" name="id" value={user.id} />
          <label className="adm-field adm-span">
            <span>Nuova password per {user.name}</span>
            <input className="adm-input" name="password" type="password" autoComplete="new-password" minLength={12} required />
          </label>
          <div className="adm-row-actions adm-span">
            <button className="adm-btn adm-btn-sm" disabled={pwPending}>{pwPending ? "…" : "Reimposta password"}</button>
            <Status state={pwState} />
          </div>
        </form>
      )}
      {self || founder ? null : <RemoveUser id={user.id} name={user.name} />}
      {self || invitePending ? null : (
        <form action={tfAction} className="adm-row-actions">
          <input type="hidden" name="id" value={user.id} />
          <button className="adm-btn adm-btn-sm" disabled={tfPending} title="Se ha perso telefono e codici di recupero: potrà accedere con la sola password e riattivarla.">
            {tfPending ? "…" : "Azzera verifica in due passaggi"}
          </button>
          <Status state={tfState} />
        </form>
      )}
    </div>
  );
}

/** Offboarding, danger style: type the exact name to enable. Founders never get this (also refused server-side). */
function RemoveUser({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(removeUser, {});
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [notify, setNotify] = useState(true);
  const [text, setText] = useState("");
  return (
    <div className="adm-danger-zone">
      {!open ? (
        <button type="button" className="adm-btn adm-btn-sm adm-btn-danger" onClick={() => { setText(offboardingText(name)); setOpen(true); }}>Licenzia / Rimuovi dal team</button>
      ) : (
        <form action={action} className="adm-form" role="alertdialog" aria-labelledby={`del-${id}`}>
          <input type="hidden" name="id" value={id} />
          <p id={`del-${id}`} className="adm-danger-text">
            <strong>Rimuovere {name} dal team?</strong> Perde subito l&apos;accesso: sessioni aperte, invito e verifica in due passaggi vengono revocati. Nome e storico restano ovunque (registro, introiti, email, desk) e il profilo passa in Ex membri, da dove puoi riattivarlo.
          </p>
          <label className="adm-check">
            <input type="checkbox" name="notify" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Invia email di cessazione
          </label>
          {notify ? (
            <label className="adm-field">
              <span>Anteprima email · Oggetto: {OFFBOARDING_SUBJECT}</span>
              <textarea className="adm-input adm-offboard-text" name="notify_text" rows={10} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
              <span className="adm-muted">Parte dalla casella dell&apos;agenzia con intestazione e firma Ctrl Agency.</span>
            </label>
          ) : null}
          <label className="adm-field">
            <span>Scrivi <strong>{name}</strong> per confermare</span>
            <input className="adm-input" name="confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
          <div className="adm-row-actions">
            <button className="adm-btn adm-btn-sm adm-btn-danger" disabled={pending || typed !== name}>{pending ? "Rimozione…" : "Rimuovi dal team"}</button>
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => { setOpen(false); setTyped(""); }}>Annulla</button>
            <Status state={state} />
          </div>
        </form>
      )}
    </div>
  );
}

export function ReactivateUser({ id }: { id: string }) {
  const [state, setState] = useState<TeamState>({});
  const [pending, start] = useTransition();
  return (
    <div className="adm-row-actions">
      <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => start(async () => setState(await reactivateUser(id).catch(() => ({ error: "Operazione non riuscita." }))))}>
        {pending ? "…" : "Riattiva"}
      </button>
      <Status state={state} />
    </div>
  );
}
