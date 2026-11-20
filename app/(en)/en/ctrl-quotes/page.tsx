import { QuotesPage, quotesMetadata } from "@/components/pages/quotes-page";

export const metadata = quotesMetadata("en");

export default function Page() {
  return <QuotesPage lang="en" />;
}
