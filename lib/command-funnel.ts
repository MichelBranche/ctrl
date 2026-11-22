import type { CommandFunnel } from "@/lib/command-types";
import type { AdminDict } from "@/lib/admin-i18n";

const FUNNEL_STAGES = ["nuovo", "contattato", "call", "preventivo", "vinto"] as const;
const FUNNEL_LABEL = { nuovo: "stageNuovo", contattato: "stageContattato", call: "stageCall", preventivo: "stagePreventivo", vinto: "stageVinto" } as const;

/** Panoramica funnel steps from contact counts by stage (crmOverview). Pure, shared with the dev fixture. */
export function funnelFrom(byStage: Record<(typeof FUNNEL_STAGES)[number] | "perso", number>, t: AdminDict, error = false): CommandFunnel {
  const steps = FUNNEL_STAGES.map((id) => ({ id, label: t.command[FUNNEL_LABEL[id]], count: byStage[id] ?? 0, href: `/admin/crm/rubrica?fase=${id}` }));
  const lost = byStage.perso ?? 0;
  return { steps, lost, total: steps.reduce((n, step) => n + step.count, 0) + lost, href: "/admin/crm/pipeline", error };
}
