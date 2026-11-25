import { LegalView, legalMetadata } from "@/components/legal/legal-page";

export const metadata = legalMetadata("cookies", "de");

export default function Page() {
  return <LegalView doc="cookies" lang="de" />;
}
