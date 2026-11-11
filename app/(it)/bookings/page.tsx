import { BookingView, bookingMetadata } from "@/components/pages/booking-page";

export const metadata = bookingMetadata("it");

export default function Page() {
  return <BookingView lang="it" />;
}
