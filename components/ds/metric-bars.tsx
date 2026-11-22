/** Vertical bar chart for a short monthly series. Values are numbers only. */
export function DsMetricBars({
  title,
  caption,
  data,
  empty,
}: {
  title: string;
  caption?: string;
  data: { label: string; value: number }[];
  empty: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!data.length || max === 0) {
    return (
      <section className="ds-bars">
        <h2>{title}</h2>
        {caption ? <p>{caption}</p> : null}
        <p>{empty}</p>
      </section>
    );
  }
  return (
    <section className="ds-bars" aria-label={title}>
      <h2>{title}</h2>
      {caption ? <p>{caption}</p> : null}
      <div className="ds-bars-plot">
        {data.map((item) => {
          const height = item.value <= 0 ? 0 : Math.max(6, Math.round((item.value / max) * 100));
          return (
            <div key={item.label} className="ds-bars-col">
              <span
                className="ds-bars-bar"
                data-empty={item.value <= 0 ? "" : undefined}
                style={{ height: item.value <= 0 ? undefined : `${height}%` }}
                title={`${item.label}: ${item.value}`}
              />
              <span className="ds-bars-label">{item.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
