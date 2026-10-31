"use client";

import type { ReactNode } from "react";

/** Small form that posts `id` to a server action after a confirm dialog. */
export function ConfirmButton({ action, id, message, children }: { action: (form: FormData) => Promise<void>; id: string; message: string; children: ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="adm-btn adm-btn-sm adm-btn-danger">{children}</button>
    </form>
  );
}
