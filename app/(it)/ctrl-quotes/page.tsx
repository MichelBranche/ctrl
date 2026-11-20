import { QuotesPage, quotesMetadata } from "@/components/pages/quotes-page";

export const metadata = quotesMetadata("it");

export default function Page() {
  return <QuotesPage lang="it" />;
}
