import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { CtrlAssistant } from "@/components/ctrl-assistant";
import { CommandMenu } from "@/components/command-menu";
import { PageTransition } from "@/components/page-transition";
import { BackToTop } from "@/components/back-to-top";
import { Micro } from "@/components/micro";
import { ScrollProgress } from "@/components/scroll-progress";
import { SmoothScroll } from "@/components/smooth-scroll";
import { ScrollReveal } from "@/components/scroll-reveal";
import { dict } from "@/lib/i18n";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const satoshi = localFont({
  src: "./fonts/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  weight: "300 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: dict.it.meta.title,
    template: "%s | CTRL®",
  },
  description: dict.it.meta.description,
  metadataBase: new URL("https://ctrlagency.dev"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" suppressHydrationWarning className={`js pt-booting ${geist.variable} ${satoshi.variable}`}>
      <head>
        <noscript>
          <style>{".pt-root[data-boot]{display:none!important}"}</style>
        </noscript>
      </head>
      <body className={geist.className}>
        <SmoothScroll />
        <BackToTop />
        <Micro />
        <ScrollProgress />
        <CommandMenu />
        {children}
        <ScrollReveal />
        <PageTransition />
        <CtrlAssistant />
        <Analytics />
      </body>
    </html>
  );
}
