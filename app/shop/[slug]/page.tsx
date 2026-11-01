import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ShopProductPage } from "@/components/pages/shop-product-page";
import { getShopProduct, getShopProducts } from "@/lib/shop";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const products = await getShopProducts();
  const params = products.filter((product) => product.slug !== "google-review-card").map((product) => ({ slug: product.slug }));
  return params.length ? params : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProduct(slug);
  if (!product) return { title: "Prodotto non trovato · CTRL®" };
  return { title: `${product.titleIt} · Shop CTRL®`, description: product.descriptionIt, alternates: { canonical: `/shop/${product.slug}`, languages: { it: `/shop/${product.slug}`, en: `/en/shop/${product.slug}` } }, openGraph: { images: [product.images[0] || "/images/shop/hero.webp"] } };
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<main className="shop-page shop-product-page" />}><Body params={params} /></Suspense>;
}

async function Body({ params }: Props) {
  const { slug } = await params;
  const product = await getShopProduct(slug);
  if (!product?.published) notFound();
  return <ShopProductPage lang="it" product={product} />;
}
