import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ShopProductPage } from "@/components/pages/shop-product-page";
import { publicMeta, shopDocumentDescription, shopDocumentTitle } from "@/lib/seo";
import { getShopProduct, getShopProducts } from "@/lib/shop";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const products = await getShopProducts();
  const params = products.filter((product) => product.published).map((product) => ({ slug: product.slug }));
  return params.length ? params : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProduct(slug);
  if (!product) return { title: { absolute: "Product not found | CTRL®" }, robots: { index: false, follow: false } };
  return publicMeta("en", {
    title: shopDocumentTitle(product.titleEn, "en"),
    description: shopDocumentDescription(product.descriptionEn, "en"),
    itPath: `/shop/${product.slug}`,
    images: [product.images[0] || "/images/shop/hero.webp"],
  });
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<main className="shop-page shop-product-page" />}><Body params={params} /></Suspense>;
}

async function Body({ params }: Props) {
  const { slug } = await params;
  const product = await getShopProduct(slug);
  if (!product?.published) notFound();
  return <ShopProductPage lang="en" product={product} />;
}
