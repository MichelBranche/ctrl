import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopPage } from "@/components/pages/shop-page";
import { alternates, openGraph } from "@/lib/seo";
import { getShopProducts } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Shop · CTRL®",
  description: "Oggetti e strumenti CTRL®. Scopri le card per raccogliere recensioni con NFC e QR code.",
  alternates: alternates("/shop", "it"),
  openGraph: openGraph("it", { images: ["/images/shop/hero.webp"] }),
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
  return <ShopPage lang="it" products={await getShopProducts()} />;
}
