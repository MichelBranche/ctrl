import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { CommandMenu } from "@/components/command-menu";
import { Cursor } from "@/components/cursor";
import { IntroLoader } from "@/components/intro-loader";
import { Micro } from "@/components/micro";
import { ScrollProgress } from "@/components/scroll-progress";
import { SmoothScroll } from "@/components/smooth-scroll";
import { dict } from "@/lib/i18n";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="it" className={`js ${geist.variable}`}>
      <body className={geist.className}>
        <SmoothScroll />
        <IntroLoader />
        <Cursor />
        <Micro />
        <ScrollProgress />
        <CommandMenu />
        {children}
      </body>
    </html>
  );
}
