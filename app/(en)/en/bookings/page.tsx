import { BookingView, bookingMetadata } from "@/components/pages/booking-page";

export const metadata = bookingMetadata("en");

export default function Page() {
  return <BookingView lang="en" />;
}
