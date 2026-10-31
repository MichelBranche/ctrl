"use client";

import { useState, useTransition } from "react";
import { unsubscribe } from "@/app/actions/public";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, start] = useTransition();
  if (!token) return <p className="j-a-lead">Link non valido. Scrivici a ctrlragency@gmail.com per essere rimosso. / Invalid link: email us to be removed.</p>;
  if (state === "done") return <p className="j-a-lead" role="status">Fatto: non riceverai più la newsletter. / Done: you will not receive the newsletter any more.</p>;
  return (
    <form
      className="j-news-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("token", token);
        start(async () => setState((await unsubscribe(fd).catch(() => ({ ok: false }))).ok ? "done" : "error"));
      }}
    >
      <p className="j-a-lead">Vuoi disiscriverti dalla newsletter del Journal? / Unsubscribe from the Journal newsletter?</p>
      <button type="submit" className="j-pill" disabled={pending}>
        Disiscrivimi / Unsubscribe
      </button>
      {state === "error" ? <p className="j-news-msg" data-state="error" role="alert">Link non valido o già usato. / Invalid or already used link.</p> : null}
    </form>
  );
}
