import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopPage } from "@/components/pages/shop-page";
import { getShopProducts } from "@/lib/shop";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Shop · CTRL®",
  description: "CTRL® objects and tools. Discover the NFC and QR review card.",
  alternates: { canonical: "/en/shop", languages: { it: "/shop", en: "/en/shop" } },
  openGraph: { images: ["/images/shop/hero.webp"] },
};

export default function Page() {
  return <Suspense fallback={<main className="shop-page" aria-busy="true" />}><ShopContent lang="en" /></Suspense>;
}

async function ShopContent({ lang }: { lang: Locale }) {
  const products = await getShopProducts();
  return <ShopPage lang={lang} products={products} />;
}
