import type { Metadata } from "next";
import { ShopPage } from "@/components/pages/shop-page";
import { getShopProducts } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Shop · CTRL®",
  description: "CTRL® objects and tools. Discover the NFC and QR review card.",
  alternates: { canonical: "/en/shop", languages: { it: "/shop", en: "/en/shop" } },
  openGraph: { images: ["/images/shop/hero.webp"] },
};

export default async function Page() {
  return <ShopPage lang="en" products={await getShopProducts()} />;
}
