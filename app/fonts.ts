import { Geist } from "next/font/google";
import localFont from "next/font/local";

export const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
export const satoshi = localFont({ src: "./fonts/Satoshi-Variable.woff2", variable: "--font-satoshi", weight: "300 900", display: "swap" });
