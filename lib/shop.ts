import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readSettings } from "@/lib/settings";

export type ShopProduct = {
  published: boolean;
  titleIt: string;
  titleEn: string;
  descriptionIt: string;
  descriptionEn: string;
  price: string;
};

export const DEFAULT_SHOP_PRODUCT: ShopProduct = {
  published: true,
  titleIt: "Card recensioni Google",
  titleEn: "Google Review Card",
  descriptionIt: "Invita i clienti a lasciare una recensione con un semplice tap NFC o una scansione del QR code.",
  descriptionEn: "Invite customers to leave a review with a quick NFC tap or a scan of the QR code.",
  price: "19.90",
};

const KEYS = [
  "shop.product.published",
  "shop.product.title.it",
  "shop.product.title.en",
  "shop.product.description.it",
  "shop.product.description.en",
  "shop.product.price",
];

export async function getShopProduct(): Promise<ShopProduct> {
  const values = await readSettings(KEYS).catch(() => ({}));
  const price = values["shop.product.price"] ?? DEFAULT_SHOP_PRODUCT.price;
  return {
    published: values["shop.product.published"] === undefined ? DEFAULT_SHOP_PRODUCT.published : values["shop.product.published"] === "true",
    titleIt: values["shop.product.title.it"] ?? DEFAULT_SHOP_PRODUCT.titleIt,
    titleEn: values["shop.product.title.en"] ?? DEFAULT_SHOP_PRODUCT.titleEn,
    descriptionIt: values["shop.product.description.it"] ?? DEFAULT_SHOP_PRODUCT.descriptionIt,
    descriptionEn: values["shop.product.description.en"] ?? DEFAULT_SHOP_PRODUCT.descriptionEn,
    price: Number.isFinite(Number(price)) ? price : DEFAULT_SHOP_PRODUCT.price,
  };
}