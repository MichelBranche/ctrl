import { ContactView, contactMetadata } from "@/components/pages/contact-page";

export const metadata = contactMetadata("de");

export default function Page() {
  return <ContactView lang="de" />;
}
