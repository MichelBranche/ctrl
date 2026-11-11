import type { Metadata } from "next";
import { SiteDocument } from "@/components/site-document";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | CTRL®" },
  robots: { index: false, follow: false, nocache: true },
  metadataBase: new URL("https://www.ctrlagency.dev"),
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument lang="it" jsonLd={false}>{children}</SiteDocument>;
}
