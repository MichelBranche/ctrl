import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Cursor } from "@/components/cursor";
import { IntroLoader } from "@/components/intro-loader";
import { Micro } from "@/components/micro";
import { ScrollProgress } from "@/components/scroll-progress";
import { SmoothScroll } from "@/components/smooth-scroll";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CTRL® — Design. Development. Visual Communication.",
    template: "%s — CTRL®",
  },
  description:
    "CTRL® is an independent studio that combines design, software development and visual communication, helping brands go from identity to digital products and beyond.",
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
        {children}
      </body>
    </html>
  );
}
