import { LoginForm } from "@/components/admin/login-form";
import { supabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  return (
    <main className="adm-login">
      <div className="adm-login-box">
        <p className="adm-kicker">CTRL® Journal</p>
        <h1 className="adm-h1">Accesso admin</h1>
        {supabaseConfigured ? <LoginForm /> : <p className="adm-note">Backend non configurato: mancano NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>}
      </div>
    </main>
  );
}
