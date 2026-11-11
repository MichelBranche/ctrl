export function FaqList({ id, title, items }: { id: string; title: string; items: { q: string; a: string }[] }) {
  return (
    <section className="sd-faq" aria-labelledby={id}>
      <h2 className="wa-h2" id={id}>{title}</h2>
      <div className="sd-faq-list">
        {items.map((item) => (
          <details key={item.q} className="sd-details">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
