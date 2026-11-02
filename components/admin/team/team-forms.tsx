"use client";

import { useActionState, useEffect, useOptimistic, useRef, useTransition } from "react";
import { addJob, createUser, deleteJob, resetUserPassword, setLeaderboardVisible, updateUser, type TeamState } from "@/app/admin/team-actions";
import { AREA_LABEL, AREAS, ROLE_LABEL, ROLES, type Area, type Role } from "@/lib/team-types";

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
      {optional ? <option value="">Nessuna (founder)</option> : <option value="" disabled>Scegli…</option>}
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

export function NewUserForm() {
  const [state, action, pending] = useActionState<TeamState, FormData>(createUser, {});
  const form = useResetOnOk(state);
  return (
    <form ref={form} action={action} className="adm-form adm-job-form">
      <label className="adm-field">
        <span>Nome</span>
        <input className="adm-input" name="name" maxLength={80} required />
      </label>
      <label className="adm-field">
        <span>Email</span>
        <input className="adm-input" name="email" type="email" autoComplete="off" required />
      </label>
      <label className="adm-field">
        <span>Ruolo</span>
        <select className="adm-input" name="role" defaultValue="member">
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </label>
      <label className="adm-field">
        <span>Area</span>
        <AreaSelect value={null} optional />
      </label>
      <label className="adm-field adm-span">
        <span>Password iniziale (almeno 12 caratteri)</span>
        <input className="adm-input" name="password" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <div className="adm-row-actions adm-span">
        <button className="adm-btn adm-btn-primary" disabled={pending}>{pending ? "Creazione…" : "Crea profilo"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function EditUserForm({ user, self }: { user: { id: string; name: string; role: Role; area: Area | null; active: boolean }; self: boolean }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(updateUser, {});
  const [pwState, pwAction, pwPending] = useActionState<TeamState, FormData>(resetUserPassword, {});
  const pwForm = useResetOnOk(pwState);
  return (
    <div className="adm-user-edit">
      <form action={action} className="adm-form adm-job-form">
        <input type="hidden" name="id" value={user.id} />
        <label className="adm-field">
          <span>Nome</span>
          <input className="adm-input" name="name" defaultValue={user.name} maxLength={80} required />
        </label>
        <label className="adm-field">
          <span>Ruolo</span>
          <select className="adm-input" name="role" defaultValue={user.role} disabled={self}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          {self ? <input type="hidden" name="role" value={user.role} /> : null}
        </label>
        <label className="adm-field">
          <span>Area</span>
          <AreaSelect value={user.area} optional />
        </label>
        <label className="adm-check">
          <input type="checkbox" name="active" defaultChecked={user.active} disabled={self} /> Attivo
          {self ? <input type="hidden" name="active" value="on" /> : null}
        </label>
        <div className="adm-row-actions adm-span">
          <button className="adm-btn adm-btn-sm" disabled={pending}>{pending ? "Salvataggio…" : "Salva"}</button>
          <Status state={state} />
        </div>
      </form>
      {self ? (
        <p className="adm-muted">La tua password si cambia da Impostazioni.</p>
      ) : (
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
    </div>
  );
}
