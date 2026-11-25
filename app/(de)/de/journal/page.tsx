import { JournalView, journalMetadata } from "@/components/journal/journal-page";

export const metadata = journalMetadata("de");

export default function Page() {
  return <JournalView lang="de" />;
}
