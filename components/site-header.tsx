"use client";

import { HomeHeader } from "@/components/home/home-header";

/**
 * Site header for inner pages: the same pill nav as the home page (links, dropdowns, mobile menu),
 * always in its dark pill state so it reads on light and dark heroes alike.
 */
export function SiteHeader() {
  return <HomeHeader solid />;
}
