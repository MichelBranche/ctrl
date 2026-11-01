import type { Metadata } from "next";
import { ShopPage } from "@/components/pages/shop-page";
import { getShopProduct } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Shop · CTRL®",
  description: "Oggetti e strumenti CTRL®. Scopri le card per raccogliere recensioni con NFC e QR code.",
  alternates: { canonical: "/shop", languages: { it: "/shop", en: "/en/shop" } },
  openGraph: { images: ["/images/shop/hero.webp"] },
};

export default async function Page() {
  return <ShopPage lang="it" product={await getShopProduct()} />;
}
