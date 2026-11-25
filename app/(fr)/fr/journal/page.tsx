import { JournalView, journalMetadata } from "@/components/journal/journal-page";

export const metadata = journalMetadata("fr");

export default function Page() {
  return <JournalView lang="fr" />;
}
