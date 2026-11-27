"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { parseAiLeads } from "@/lib/crm-ai-import-core";

const COPY = "M9 9h10v12H9zM5 15V3h10";
const CHECK = "M5 12l5 5 9-11";
const PASTE = "M9 4h6v3H9zM7 5H5v16h14V5h-2M9 13h6M9 17h4";
const ENDPOINT = "/api/admin/crm/ai-import";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/**
 * Clic 1: copies a ready-to-use brief for Claude Code or any AI. `brief` is fixed text (an existing request);
 * `getBrief` reads the open form and returns an error sentence when something is missing.
 */
export function CopyBriefButton({ brief, getBrief, small = false, label = "Copia brief per AI" }: {
  brief?: string; getBrief?: () => { brief: string } | { error: string }; small?: boolean; label?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const [hint, setHint] = useState("");
  const timer = useRef<number | null>(null);

  const copy = async () => {
    const built = getBrief ? getBrief() : { brief: brief ?? "" };
    if ("error" in built) { setHint(built.error); setState("fail"); return; }
    const ok = await writeClipboard(built.brief);
    setHint(ok ? "Copiato. Incollalo nell'AI, poi torna qui con «Incolla risultato»." : "Non riesco a copiare: il browser ha bloccato gli appunti.");
    setState(ok ? "done" : "fail");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 6000);
  };

  return (
    <span className="rd-copy" data-state={state}>
      <button type="button" className={small ? "adm-btn adm-btn-sm rd-ai-btn" : "adm-btn rd-ai-btn"} onClick={() => void copy()}>
        <CrmIcon d={state === "done" ? CHECK : COPY} />{state === "done" ? "Copiato" : label}
      </button>
      {state !== "idle" && hint ? <span className="rd-copy-hint" role="status">{hint}</span> : null}
    </span>
  );
}

type Outcome = { inserted: number; duplicates: number };

/**
 * Clic 2: a box where the founder pastes the AI's answer. The preview is immediate and the server reads the
 * same text again before importing (founders only, duplicates skipped, nothing overwritten, no email sent).
 */
export function PasteResultDialog({ irisRequestId, context, small = false }: { irisRequestId?: string; context?: string; small?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const preview = useMemo(() => (text.trim() ? parseAiLeads(text) : null), [text]);
  const ready = preview && !("error" in preview) ? preview.contacts.length : 0;

  const reset = () => { setText(""); setPending(false); setError(""); setOutcome(null); };
  const open = () => { reset(); dialog.current?.showModal(); };
  const close = () => dialog.current?.close();

  const submit = async () => {
    if (!ready || pending) return;
    setPending(true); setError("");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, irisRequestId: irisRequestId ?? null }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<Outcome> & { error?: string };
      if (!res.ok) { setError(body.error ?? "Import non riuscito. Riprova."); return; }
      setOutcome({ inserted: body.inserted ?? 0, duplicates: body.duplicates ?? 0 });
    } catch {
      setError("Connessione interrotta. Riprova: i lead già importati non vengono duplicati.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" className={small ? "adm-btn adm-btn-sm rd-ai-btn" : "adm-btn rd-ai-btn"} onClick={open}>
        <CrmIcon d={PASTE} />Incolla risultato
      </button>
      <dialog ref={dialog} className="rd-paste" aria-labelledby={`rd-paste-${irisRequestId ?? "new"}`} onClose={() => { if (outcome?.inserted) router.refresh(); reset(); }}>
        <h2 id={`rd-paste-${irisRequestId ?? "new"}`} className="adm-h2">Incolla il risultato dell&apos;AI</h2>
        {outcome ? (
          <div className="rd-paste-done" role="status">
            <p className="rd-paste-big"><CrmIcon d={CHECK} />{outcome.inserted === 1 ? "1 nuovo lead nel Radar" : `${outcome.inserted} nuovi lead nel Radar`}</p>
            <p className="adm-muted">{outcome.duplicates ? `${outcome.duplicates} già presenti, saltati senza modificarli.` : "Nessun doppione."} Nessuna email è stata inviata.</p>
            <div className="adm-row-actions"><button type="button" className="adm-btn adm-btn-primary" onClick={close}>Fatto</button></div>
          </div>
        ) : (
          <>
            <p className="crm-hint adm-muted">
              Copia tutta la risposta dell&apos;AI e incollala qui sotto, anche con il testo che la accompagna.
              {context ? <> I lead verranno collegati a {context}.</> : null}
            </p>
            <textarea className="adm-input rd-paste-area" value={text} rows={10} spellCheck={false} autoFocus
              aria-label="Risposta dell'AI" placeholder="Incolla qui la risposta…" onChange={(e) => { setText(e.target.value); setError(""); }} />
            {preview ? (
              "error" in preview ? <p className="rd-paste-note" data-tone="warn" role="status">{preview.error}</p> : (
                <div className="rd-paste-preview" role="status">
                  <p className="rd-paste-count">
                    <strong data-tone={preview.contacts.length ? "ok" : "warn"}>{preview.contacts.length === 1 ? "1 lead pronto" : `${preview.contacts.length} lead pronti`}</strong>
                    {preview.rejected.length ? <span data-tone="warn">{preview.rejected.length === 1 ? "1 scartato" : `${preview.rejected.length} scartati`}</span> : null}
                  </p>
                  {preview.contacts.length ? (
                    <ul className="rd-paste-list">
                      {preview.contacts.slice(0, 6).map((c, i) => <li key={i}><strong>{c.business_name}</strong><span className="adm-muted">{[c.city, c.email || c.phone || c.website].filter(Boolean).join(" · ")}</span></li>)}
                      {preview.contacts.length > 6 ? <li className="adm-muted">e altri {preview.contacts.length - 6}</li> : null}
                    </ul>
                  ) : null}
                  {preview.rejected.length ? (
                    <details className="rd-paste-rejected">
                      <summary>Perché alcuni sono scartati</summary>
                      <ul>{preview.rejected.map((r) => <li key={r.n}><strong>{r.name}</strong>: {r.reason}</li>)}</ul>
                    </details>
                  ) : null}
                </div>
              )
            ) : null}
            {error ? <p className="adm-error" role="alert">{error}</p> : null}
            <div className="adm-row-actions">
              <button type="button" className="adm-btn" onClick={close}>Annulla</button>
              <button type="button" className="adm-btn adm-btn-primary" disabled={!ready || pending} onClick={() => void submit()}>
                {pending ? "Importo…" : ready ? `Importa nel Radar (${ready})` : "Importa nel Radar"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
