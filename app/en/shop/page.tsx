import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopPage } from "@/components/pages/shop-page";
import { getShopProducts } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Shop · CTRL®",
  description: "CTRL® objects and tools. Discover the NFC and QR review card.",
  alternates: { canonical: "/en/shop", languages: { it: "/shop", en: "/en/shop" } },
  openGraph: { images: ["/images/shop/hero.webp"] },
};

export default function Page() {
  // Products are cached ("use cache" in lib/shop), so this is prerendered into the static shell; the boundary only matters on a cold cache miss.
  return (
    <Suspense fallback={<main className="shop-page" aria-busy="true" />}>
      <Products />
    </Suspense>
  );
}

async function Products() {
  return <ShopPage lang="en" products={await getShopProducts()} />;
}
