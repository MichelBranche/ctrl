import { LoginScreen } from "@/components/admin/login-screen";

/** After a password reset: sign in again with the new password (no session is created by the reset). */
export default function PasswordUpdatedPage() {
  return <LoginScreen noticeKey="resetDone" />;
}
