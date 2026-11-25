import { QuotesPage, quotesMetadata } from "@/components/pages/quotes-page";

export const metadata = quotesMetadata("fr");

export default function Page() {
  return <QuotesPage lang="fr" />;
}
