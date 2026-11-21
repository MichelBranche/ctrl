/**
 * Site feature switches. Flip a value and redeploy; nothing else to change.
 *
 * SHOP_ENABLED: false hides every public way into the shop (desktop and mobile
 * nav, the orange cart button, Ctrl+K, the sitemap) and marks /shop, product
 * and checkout pages noindex. The pages and the code stay: /shop still opens
 * from a direct link, and the cart button still shows on shop and checkout
 * pages so an order can be finished.
 */
export const SHOP_ENABLED = false;

/** Shop and checkout routes, both languages: where the cart stays available while the shop is hidden. */
export function isShopPath(pathname: string) {
  return /^\/(en\/)?(shop|checkout)(\/|$)/.test(pathname);
}

/** Robots override for shop pages while the shop is hidden. */
export const SHOP_ROBOTS = SHOP_ENABLED ? {} : { robots: { index: false, follow: false } };
