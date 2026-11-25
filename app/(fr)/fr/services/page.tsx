import { ServicesView, servicesMetadata } from "@/components/pages/services-page";

export const metadata = servicesMetadata("fr");

export default function Page() {
  return <ServicesView lang="fr" />;
}
