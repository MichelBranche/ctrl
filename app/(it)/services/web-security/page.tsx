import type { Metadata } from "next";
import { SecurityView, securityMetadata } from "@/components/security/security-page";

export const metadata: Metadata = securityMetadata("it");

export default function Page() {
  return <SecurityView lang="it" />;
}
