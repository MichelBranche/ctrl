import { ServicesView, servicesMetadata } from "@/components/pages/services-page";

export const metadata = servicesMetadata("it");

export default function Page() {
  return <ServicesView lang="it" />;
}
