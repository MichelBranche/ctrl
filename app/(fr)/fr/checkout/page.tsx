import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutContent } from "@/components/pages/checkout-content";

export const metadata: Metadata = {
  title: { absolute: "CTRL® shop checkout" },
  description: "Récapitulatif de votre commande dans la boutique CTRL®. Le paiement en ligne n’est pas encore activé : votre panier reste enregistré dans ce navigateur.",
  robots: { index: false, follow: true },
};
export default function Page() { return <><SiteHeader /><CheckoutContent lang="fr" /><SiteFooter /></>; }
