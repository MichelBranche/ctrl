import type { Metadata } from "next";
import { SiteDocument } from "@/components/site-document";
import { dict } from "@/lib/i18n";
import { openGraph } from "@/lib/seo";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: dict.en.meta.title, template: "%s | CTRL®" },
  description: dict.en.meta.description,
  metadataBase: new URL("https://www.ctrlagency.dev"),
  openGraph: openGraph("en"),
  twitter: { card: "summary_large_image" },
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
