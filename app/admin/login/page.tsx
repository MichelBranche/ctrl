import { LoginForm } from "@/components/admin/login-form";

export default function LoginPage() {
  return (
    <main className="adm-login">
      <div className="adm-login-box">
        <p className="adm-kicker">CTRL® Journal</p>
        <h1 className="adm-h1">Accesso admin</h1>
        <LoginForm />
      </div>
    </main>
  );
}
