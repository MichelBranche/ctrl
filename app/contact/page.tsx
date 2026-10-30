import { ContactView, contactMetadata } from "@/components/pages/contact-page";

export const metadata = contactMetadata("it");

export default function Page() {
  return <ContactView lang="it" />;
}
