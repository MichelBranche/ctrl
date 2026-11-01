"use client";

import { useState } from "react";

const manualUrl = "/docs/ctrl-google-review-card-manual-bilingual.pdf";
const pageCount = 5;

export function ProductManual({ lang }: { lang: "it" | "en" }) {
  const [page, setPage] = useState(1);
  const [turn, setTurn] = useState<"next" | "previous">("next");
  const changePage = (next: number) => {
    setTurn(next > page ? "next" : "previous");
    setPage(next);
  };

  const it = lang === "it";
  return (
    <section className="sp-manual" aria-labelledby="sp-manual-title">
      <div className="sp-manual-heading">
        <div>
          <p className="sp-category">{it ? "GUIDA PRODOTTO" : "PRODUCT GUIDE"}<i /></p>
          <h2 id="sp-manual-title">{it ? "Il manuale, sfogliabile." : "The manual, page by page."}</h2>
          <p>{it ? "Consulta le informazioni e le istruzioni della Google Review Card." : "Explore the Google Review Card information and setup instructions."}</p>
        </div>
        <a className="sp-manual-open" href={manualUrl} target="_blank" rel="noreferrer">
          {it ? "Apri il PDF" : "Open PDF"}<span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className={`sp-book sp-book-${turn}`}>
        <iframe
          key={page}
          src={`${manualUrl}#page=${page}&zoom=page-fit&toolbar=0&navpanes=0`}
          title={`${it ? "Manuale Google Review Card, pagina" : "Google Review Card manual, page"} ${page}`}
          loading="lazy"
        />
      </div>
      <div className="sp-book-controls">
        <button type="button" onClick={() => changePage(Math.max(1, page - 1))} disabled={page === 1} aria-label={it ? "Pagina precedente" : "Previous page"}>←</button>
        <span>{it ? "Pagina" : "Page"} <strong>{page}</strong> / {pageCount}</span>
        <button type="button" onClick={() => changePage(Math.min(pageCount, page + 1))} disabled={page === pageCount} aria-label={it ? "Pagina successiva" : "Next page"}>→</button>
      </div>
      <p className="sp-manual-delivery">
        {it
          ? "Dopo l’acquisto riceverai via email la conferma e il manuale completo in PDF con tutte le informazioni e le istruzioni."
          : "After purchase, you’ll receive an email confirmation together with the complete PDF manual and instructions."}
      </p>
    </section>
  );
}
