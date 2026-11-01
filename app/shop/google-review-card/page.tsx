import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopProductPage } from "@/components/pages/shop-product-page";
import { getShopProduct } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Card recensioni Google · Shop CTRL®",
  description: "Raccogli recensioni Google con la card CTRL® NFC e QR. Semplice da usare al banco.",
  alternates: { canonical: "/shop/google-review-card", languages: { it: "/shop/google-review-card", en: "/en/shop/google-review-card" } },
  openGraph: { images: ["/images/shop/review-card-hero.webp"] },
};

export default async function Page() {
  const product = await getShopProduct("google-review-card");
  if (!product?.published) notFound();
  return <ShopProductPage lang="it" product={product} />;
}
