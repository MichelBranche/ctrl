import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutContent } from "@/components/pages/checkout-content";

export const metadata: Metadata = {
  title: { absolute: "CTRL® shop checkout" },
  description: "Order summary in the CTRL® shop. Online payment is not switched on yet: the cart stays a draft in this browser.",
  robots: { index: false, follow: true },
};
export default function Page() { return <><SiteHeader /><CheckoutContent lang="en" /><SiteFooter /></>; }
