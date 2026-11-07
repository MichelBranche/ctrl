"use client";

import { useState } from "react";
import { writeClipboard } from "@/lib/crm-prompt";

const LABEL = { idle: "Copia prompt", copied: "Copiato", error: "Copia non riuscita" } as const;

function selectCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  area.remove();
  return ok;
}

/** Copies the prepared prompt. The label itself is the feedback, so it stays visible on a phone. */
export function CopyPromptButton({ text }: { text: string }) {
  const [state, setState] = useState<keyof typeof LABEL>("idle");
  return (
    <button
      type="button"
      className={`adm-btn adm-btn-sm crm-copy-prompt${state === "idle" ? "" : ` crm-copy-prompt-${state}`}`}
      aria-live="polite"
      aria-label={state === "error" ? "Copia non riuscita. Il testo non è negli appunti." : LABEL[state]}
      onClick={() => {
        void writeClipboard(text, typeof navigator === "undefined" ? null : navigator.clipboard, () => selectCopy(text))
          .then((result) => setState(result === "copied" ? "copied" : "error"));
      }}
    >
      {LABEL[state]}
    </button>
  );
}
