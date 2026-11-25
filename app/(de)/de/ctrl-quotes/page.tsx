import { QuotesPage, quotesMetadata } from "@/components/pages/quotes-page";

export const metadata = quotesMetadata("de");

export default function Page() {
  return <QuotesPage lang="de" />;
}
