import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutContent } from "@/components/pages/checkout-content";

export const metadata: Metadata = {
  title: { absolute: "Checkout dello shop CTRL®" },
  description: "Riepilogo dell'ordine nello shop CTRL®. Il pagamento online non è ancora attivo: il carrello resta una bozza in questo browser.",
  robots: { index: false, follow: true },
};
export default function Page() { return <><SiteHeader /><CheckoutContent lang="it" /><SiteFooter /></>; }
