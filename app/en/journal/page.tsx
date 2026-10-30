import { JournalView, journalMetadata } from "@/components/pages/journal-page";

export const metadata = journalMetadata("en");

export default function Page() {
  return <JournalView lang="en" />;
}
