import { LegalView, legalMetadata } from "@/components/legal/legal-page";

export const metadata = legalMetadata("privacy", "de");

export default function Page() {
  return <LegalView doc="privacy" lang="de" />;
}
