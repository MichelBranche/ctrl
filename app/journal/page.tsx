import { JournalView, journalMetadata } from "@/components/pages/journal-page";

export const metadata = journalMetadata("it");

export default function Page() {
  return <JournalView lang="it" />;
}
