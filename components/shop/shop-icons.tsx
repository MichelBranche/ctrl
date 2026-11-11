/** One stroke icon set for the shop: 24px grid, 1.5 stroke, currentColor. Size via CSS (default 1em). */
import type { SVGProps } from "react";

const paths = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowUpRight: "M7 17L17 7M8 7h9v9",
  chevronDown: "M6 9l6 6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  cart: "M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 8H6M10 20h.01M18 20h.01",
  bag: "M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2",
} as const;

export type ShopIconName = keyof typeof paths;

export function ShopIcon({ name, className, ...rest }: { name: ShopIconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={["shop-icon", className].filter(Boolean).join(" ")} {...rest}><path d={paths[name]} /></svg>;
}
