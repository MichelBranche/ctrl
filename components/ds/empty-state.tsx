import type { ReactNode } from "react";

/** Empty or waiting state on a design-system card. Copy is passed in, never hardcoded. */
export function DsEmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <section className="ds-empty">
      <h2 className="ds-empty-title">{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}
