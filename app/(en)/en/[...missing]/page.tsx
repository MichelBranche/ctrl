import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "404", robots: { index: false } };

// Unknown /en/* paths render the English 404 (app/en/not-found.tsx) instead of the Italian root one.
export default function Missing() {
  notFound();
}
