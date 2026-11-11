import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopPage } from "@/components/pages/shop-page";
import { publicMeta } from "@/lib/seo";
import { getShopProducts } from "@/lib/shop";

export const metadata: Metadata = publicMeta("en", {
  title: "Shop in Aosta: NFC cards for Google reviews | CTRL®",
  description: "NFC and QR cards that invite customers to leave a Google review. The shop of CTRL®, the web agency in Aosta, Valle d'Aosta. Made to order. For the counter.",
  itPath: "/shop",
  images: ["/images/shop/hero.webp"],
});

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
