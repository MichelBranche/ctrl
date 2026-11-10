import { LegalView, legalMetadata } from "@/components/legal/legal-page";

export const metadata = legalMetadata("privacy", "en");

export default function Page() {
  return <LegalView doc="privacy" lang="en" />;
}
