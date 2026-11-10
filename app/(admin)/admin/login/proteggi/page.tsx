import { LoginScreen } from "@/components/admin/login-screen";

/** Where a founder session without 2FA lands (requireAdmin): sign in again and the card runs the guided setup. */
export default function ProtectPage() {
  return (
    <LoginScreen notice="Per i founder la verifica in due passaggi è obbligatoria. Accedi di nuovo: ti guidiamo nella configurazione, ci vuole un minuto." />
  );
}
