import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopPage } from "@/components/pages/shop-page";
import { publicMeta } from "@/lib/seo";
import { getShopProducts } from "@/lib/shop";

export const metadata: Metadata = publicMeta("it", {
  title: "Shop di Aosta: le card NFC per le recensioni | CTRL®",
  description: "Card NFC e QR per invitare i clienti a una recensione Google. Lo shop di CTRL®, agenzia web ad Aosta, in Valle d'Aosta. Realizzata su ordinazione.",
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
  return <ShopPage lang="it" products={await getShopProducts()} />;
}
