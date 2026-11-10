import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutContent } from "@/components/pages/checkout-content";

export const metadata: Metadata = { title: "Checkout · CTRL® Shop", robots: { index: false, follow: true } };
export default function Page() { return <><SiteHeader /><CheckoutContent lang="it" /><SiteFooter /></>; }
