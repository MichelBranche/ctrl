import { LoginScreen } from "@/components/admin/login-screen";

/** Reload during the 5-minute code step lands here; without a valid ticket the form says it expired. */
export default function SecondStepPage() {
  return <LoginScreen initialStep="code" />;
}
