import { BookingView, bookingMetadata } from "@/components/pages/booking-page";

export const metadata = bookingMetadata("de");

export default function Page() {
  return <BookingView lang="de" />;
}
