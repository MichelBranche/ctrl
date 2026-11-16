import { LoginScreen } from "@/components/admin/login-screen";

/** "Richiedi un nuovo link" from an expired or used reset link opens the sign-in card on the request step. */
export default function RecoveryPage() {
  return <LoginScreen initialStep="forgot" />;
}
