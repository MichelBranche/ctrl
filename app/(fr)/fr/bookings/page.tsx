import { BookingView, bookingMetadata } from "@/components/pages/booking-page";

export const metadata = bookingMetadata("fr");

export default function Page() {
  return <BookingView lang="fr" />;
}
