import type { ReactNode } from "react";

export type DsTableColumn = { key: string; label: string; numeric?: boolean };

/** Simple data table on a design-system card. Only render aggregated or non-personal values. */
export function DsTable({
  title,
  caption,
  columns,
  rows,
}: {
  title?: string;
  caption?: string;
  columns: DsTableColumn[];
  rows: Record<string, ReactNode>[];
}) {
  return (
    <section className="ds-table-wrap">
      {title ? <h2>{title}</h2> : null}
      {caption ? <p>{caption}</p> : null}
      <table className="ds-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.numeric ? "ds-num" : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col.key} className={col.numeric ? "ds-num" : undefined}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
