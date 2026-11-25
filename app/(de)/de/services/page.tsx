import { ServicesView, servicesMetadata } from "@/components/pages/services-page";

export const metadata = servicesMetadata("de");

export default function Page() {
  return <ServicesView lang="de" />;
}
