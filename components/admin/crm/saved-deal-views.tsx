"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Route } from "next";
import { PIPELINE, pipelineSearch, type PipelineQuery } from "@/lib/crm-nav";

const KEY = "ctrl-crm-pipeline-views";
type View = { name: string; resp: string; fonte: string; prio: string };
const listeners = new Set<() => void>();

function isView(v: unknown): v is View {
  if (!v || typeof v !== "object") return false;
  const row = v as View;
  return typeof row.name === "string" && typeof row.resp === "string" && typeof row.fonte === "string" && typeof row.prio === "string";
}

let cachedRaw = "";
let cachedViews: View[] = [];
function readViews(): View[] {
  const raw = localStorage.getItem(KEY) || "[]";
  if (raw === cachedRaw) return cachedViews;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    cachedViews = Array.isArray(parsed) ? parsed.filter(isView).slice(0, 8) : [];
  } catch { cachedViews = []; }
  return cachedViews;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

/** Filter presets only (owner, source, priority). No company names and no search text. */
export function SavedDealViews({ query }: { query: PipelineQuery }) {
  const views = useSyncExternalStore(subscribe, readViews, () => []);
  const [name, setName] = useState("");
  const write = (next: View[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next.slice(-8))); } catch { /* private mode: nothing is stored */ }
    for (const cb of listeners) cb();
  };
  return (
    <details className="crm-menu">
      <summary className="adm-btn adm-btn-sm">Viste salvate</summary>
      <div className="crm-menu-list crm-menu-form">
        {views.map((v) => (
          <Link key={v.name} href={`${PIPELINE}${pipelineSearch(query, { resp: v.resp, fonte: v.fonte, prio: v.prio, nuova: false })}` as Route}>{v.name}</Link>
        ))}
        {!views.length ? <p className="adm-muted">Nessuna vista su questo browser.</p> : null}
        <form onSubmit={(e) => {
          e.preventDefault();
          const label = name.trim().slice(0, 40);
          if (!label) return;
          write([...views.filter((v) => v.name !== label), { name: label, resp: query.resp, fonte: query.fonte, prio: query.prio }].slice(-8));
          setName("");
        }}>
          <label className="adm-sr" htmlFor="crm-view-name">Nome della vista</label>
          <input id="crm-view-name" className="adm-input" value={name} maxLength={40} placeholder="Nome (solo filtri)" onChange={(e) => setName(e.target.value)} />
          <button className="adm-btn adm-btn-sm" type="submit">Salva filtri</button>
        </form>
      </div>
    </details>
  );
}
