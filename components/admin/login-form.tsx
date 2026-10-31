"use client";

import { useActionState, useState } from "react";
import { signIn, type FormState } from "@/app/admin/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="adm-form">
      <label className="adm-field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="adm-field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <p className="adm-error" role="alert">{state.error}</p> : null}
      <button className="adm-btn adm-btn-primary" disabled={pending}>
        {pending ? "Accesso…" : "Accedi"}
      </button>
    </form>
  );
}
