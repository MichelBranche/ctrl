import { ContactView, contactMetadata } from "@/components/pages/contact-page";

export const metadata = contactMetadata("fr");

export default function Page() {
  return <ContactView lang="fr" />;
}
