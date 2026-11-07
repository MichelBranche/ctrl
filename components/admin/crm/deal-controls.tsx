"use client";
import { useActionState, useState } from "react";
import { panelDealOwnerAction, panelDealPriorityAction, panelDealStageAction, panelDealValueAction } from "@/app/admin/crm-opportunity-actions";
import type { CrmState } from "@/app/admin/crm-actions";
import { DEAL_PRIORITIES, DEAL_PRIORITY_LABEL, STAGES, STAGE_LABEL, type DealPriority, type Stage } from "@/lib/crm-core";

type Deal = {
  id: string; version: number; stage: Stage; title: string; valueEur: number | null;
  ownerUserId: string | null; priority: DealPriority | null;
};

function useDealForm(fn: (s: CrmState, f: FormData) => Promise<CrmState>) {
  const [state, action, pending] = useActionState(fn, {});
  return { state, action, pending };
}

/** Phase, value, priority and owner of the deal. None of these forms write the contact. */
export function DealControls({ deal, owners, former }: {
  deal: Deal; owners: { id: string; name: string }[]; former: string | null;
}) {
  const stage = useDealForm(panelDealStageAction);
  const owner = useDealForm(panelDealOwnerAction);
  const priority = useDealForm(panelDealPriorityAction);
  const value = useDealForm(panelDealValueAction);
  const [title, setTitle] = useState(deal.title);
  const [euros, setEuros] = useState(deal.valueEur === null ? "" : String(deal.valueEur));
  const flash = stage.state.error || owner.state.error || priority.state.error || value.state.error;
  const ok = stage.state.ok || owner.state.ok || priority.state.ok || value.state.ok;
  return (
    <div className="crm-deal-controls">
      <form action={stage.action} className="crm-quick-field">
        <input type="hidden" name="id" value={deal.id} /><input type="hidden" name="version" value={deal.version} />
        <label htmlFor="crm-deal-stage">Fase commerciale</label>
        <span className="crm-select-dot" data-stage={deal.stage}>
          <select id="crm-deal-stage" className="adm-input" name="stage" defaultValue={deal.stage} disabled={stage.pending} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </span>
      </form>
      <form action={value.action} className="crm-deal-value">
        <input type="hidden" name="id" value={deal.id} /><input type="hidden" name="version" value={deal.version} />
        <label htmlFor="crm-deal-title">Trattativa</label>
        <input id="crm-deal-title" className="adm-input" name="title" value={title} maxLength={200} required onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="crm-deal-value">Valore stimato</label>
        <input id="crm-deal-value" className="adm-input" name="value_eur" inputMode="decimal" value={euros} placeholder="Euro, se lo conosci" onChange={(e) => setEuros(e.target.value)} />
        <button className="adm-btn adm-btn-sm" disabled={value.pending}>{value.pending ? "Salvo…" : "Salva trattativa"}</button>
      </form>
      <form action={priority.action} className="crm-quick-field">
        <input type="hidden" name="id" value={deal.id} /><input type="hidden" name="version" value={deal.version} />
        <label htmlFor="crm-deal-prio">Priorità</label>
        <select id="crm-deal-prio" className="adm-input" name="priority" defaultValue={deal.priority ?? ""} disabled={priority.pending} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
          <option value="">Nessuna</option>
          {DEAL_PRIORITIES.map((p) => <option key={p} value={p}>{DEAL_PRIORITY_LABEL[p]}</option>)}
        </select>
      </form>
      <form action={owner.action} className="crm-quick-field">
        <input type="hidden" name="id" value={deal.id} /><input type="hidden" name="version" value={deal.version} />
        <label htmlFor="crm-deal-owner">Responsabile della trattativa</label>
        <select id="crm-deal-owner" className="adm-input" name="owner_user_id" defaultValue={deal.ownerUserId ?? ""} disabled={owner.pending} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
          <option value="">Non assegnato</option>
          {former && deal.ownerUserId ? <option value={deal.ownerUserId}>{former}</option> : null}
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </form>
      {flash ? <p className="adm-error" role="alert">{flash}</p> : ok ? <p className="adm-ok" role="status">{ok}</p> : null}
    </div>
  );
}
