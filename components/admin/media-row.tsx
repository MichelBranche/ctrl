"use client";

import { useState, useTransition } from "react";
import { deleteMedia } from "@/app/admin/dashboard-actions";

export function MediaRow({ url, name, size, uploaded, usedBy }: { url: string; name: string; size: string; uploaded: string; usedBy: string[] }) {
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const remove = () => {
    const warn = usedBy.length ? `Questa immagine è la copertina di: ${usedBy.join(", ")}. L'articolo resterà senza immagine.\n\n` : "";
    if (!confirm(`${warn}Eliminare definitivamente ${name}?`)) return;
    const fd = new FormData();
    fd.set("url", url);
    start(async () => {
      const r = await deleteMedia(fd);
      setMsg(r.error ?? "");
    });
  };

  return (
    <tr aria-busy={pending}>
      <td>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, no optimisation needed */}
        <img src={url} alt="" className="adm-thumb" loading="lazy" />
      </td>
      <td>
        <a href={url} target="_blank" rel="noopener noreferrer" className="adm-link adm-mono">
          {name}
        </a>
        {msg ? <span className="adm-error adm-slug">{msg}</span> : null}
      </td>
      <td className="adm-num">{size}</td>
      <td>{uploaded}</td>
      <td>{usedBy.length ? usedBy.join(", ") : <span className="adm-muted">Nessun articolo</span>}</td>
      <td className="adm-row-actions">
        <button type="button" className="adm-btn adm-btn-sm" onClick={copy}>
          {copied ? "Copiato" : "Copia URL"}
        </button>
        <button type="button" className="adm-btn adm-btn-sm adm-btn-danger" onClick={remove} disabled={pending}>
          Elimina
        </button>
      </td>
    </tr>
  );
}
