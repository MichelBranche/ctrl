import { ContactView, contactMetadata } from "@/components/pages/contact-page";

export const metadata = contactMetadata("en");

export default function Page() {
  return <ContactView lang="en" />;
}
