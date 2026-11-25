import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopPage } from "@/components/pages/shop-page";
import { SHOP_ROBOTS } from "@/lib/features";
import { publicMeta } from "@/lib/seo";
import { getShopProducts } from "@/lib/shop";

export const metadata: Metadata = {
  ...publicMeta("fr", {
    title: "Cartes NFC et QR pour les avis Google | CTRL®",
    description: "Des cartes NFC et QR qui invitent vos clients à laisser un avis Google. La boutique CTRL®, studio web à Aoste, en Vallée d’Aoste. Fabriqué sur commande pour votre comptoir.",
    itPath: "/shop",
    images: ["/images/shop/hero.webp"],
  }),
  ...SHOP_ROBOTS,
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
  return <ShopPage lang="fr" products={await getShopProducts()} />;
}
