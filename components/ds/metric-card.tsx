import type { ReactNode } from "react";

/** Metric tile for product dashboards and the admin conversion. Labels come from the caller. */
export function DsMetricCard({
  label,
  value,
  hint,
  pending,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  pending?: boolean;
}) {
  return (
    <article className="ds-metric" data-pending={pending ? "" : undefined}>
      <p className="ds-metric-label">{label}</p>
      <p className="ds-metric-value">{value}</p>
      {hint ? <p className="ds-metric-hint">{hint}</p> : null}
    </article>
  );
}
