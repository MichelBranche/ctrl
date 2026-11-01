import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopProductPage } from "@/components/pages/shop-product-page";
import { getShopProduct } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Google Review Card · CTRL® Shop",
  description: "Collect Google reviews with the CTRL® NFC and QR card. Easy to use at your counter.",
  alternates: { canonical: "/en/shop/google-review-card", languages: { it: "/shop/google-review-card", en: "/en/shop/google-review-card" } },
  openGraph: { images: ["/images/shop/review-card-hero.webp"] },
};

export default async function Page() {
  const product = await getShopProduct("google-review-card");
  if (!product?.published) notFound();
  return <ShopProductPage lang="en" product={product} />;
}
