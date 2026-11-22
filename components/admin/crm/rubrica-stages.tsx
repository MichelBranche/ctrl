import Link from "next/link";
import type { Route } from "next";
import { STAGES, STAGE_HINT, STAGE_LABEL, type Stage } from "@/lib/crm-core";

/**
 * Where the contacts in this view stand: one proportional bar and one tile per stage. A tile filters the list by that
 * stage (click again to clear). Counts follow the current segment, search and filters, never the stage filter itself.
 */
export function RubricaStages({ counts, total, active, hrefs }: {
  counts: Record<Stage, number>; total: number; active: Stage | null; hrefs: Record<Stage, string>;
}) {
  return (
    <section className="rb-stages" aria-label="Contatti per fase" data-active={active ?? undefined}>
      <div className="rb-stages-bar" aria-hidden="true">
        {STAGES.map((st, i) => counts[st] ? <span key={st} data-stage={st} style={{ flexGrow: counts[st], ["--i" as string]: i }} /> : null)}
      </div>
      <nav className="rb-stages-tiles" aria-label="Filtra per fase">
        {STAGES.map((st, i) => {
          const share = total ? Math.round((counts[st] / total) * 100) : 0;
          return (
            <Link key={st} href={hrefs[st] as Route} scroll={false} data-stage={st} aria-current={active === st ? "true" : undefined}
              title={active === st ? "Togli il filtro" : `${STAGE_HINT[st]}: mostra solo questi`} style={{ ["--i" as string]: i }}>
              <span className="rb-stage-label"><i aria-hidden="true" />{STAGE_LABEL[st]}</span>
              <span className="rb-stage-n">{counts[st].toLocaleString("it-IT")}</span>
              <span className="rb-stage-share">{share}%</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
