import type { Metadata } from "next";
import { SiteDocument } from "@/components/site-document";
import { NotFoundView } from "@/components/pages/not-found-page";
import "./globals.css";

export const metadata: Metadata = { title: "404", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <SiteDocument lang="it" jsonLd={false}>
      <NotFoundView lang="it" />
    </SiteDocument>
  );
}
