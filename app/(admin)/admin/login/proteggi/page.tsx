import { LoginScreen } from "@/components/admin/login-screen";

/** Where a founder session without 2FA lands (requireAdmin): sign in again and the card runs the guided setup. */
export default function ProtectPage() {
  return <LoginScreen noticeKey="founderNotice" />;
}
