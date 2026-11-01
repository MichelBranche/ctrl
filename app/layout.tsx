import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { PublicChrome } from "@/components/public-chrome";
import { dict } from "@/lib/i18n";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const satoshi = localFont({ src: "./fonts/Satoshi-Variable.woff2", variable: "--font-satoshi", weight: "300 900", display: "swap" });

export const metadata: Metadata = {
  title: { default: dict.it.meta.title, template: "%s | CTRL®" },
  description: dict.it.meta.description,
  metadataBase: new URL("https://www.ctrlagency.dev"),
  openGraph: {
    type: "website",
    siteName: "CTRL®",
    locale: "it_IT",
    images: [{ url: "/images/home/hero.jpg", width: 1200, height: 630, alt: "CTRL® — studio indipendente di creative technology" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" suppressHydrationWarning className={`js pt-booting ${geist.variable} ${satoshi.variable}`}>
      <head><noscript><style>{".pt-root[data-boot]{display:none!important}"}</style></noscript></head>
      <body className={geist.className}>
        <PublicChrome slot="before" />
        {children}
        <PublicChrome slot="after" />
      </body>
    </html>
  );
}
