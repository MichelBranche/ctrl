import type { Metadata } from "next";
import { AdminLocaleProvider } from "@/components/admin/locale-provider";
import { SiteDocument } from "@/components/site-document";
import { getAdminLocale } from "@/lib/admin-locale";
import "../globals.css";

export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | CTRL®" },
  robots: { index: false, follow: false, nocache: true },
  metadataBase: new URL("https://www.ctrlagency.dev"),
};

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getAdminLocale();
  return (
    <SiteDocument lang={lang} jsonLd={false}>
      <AdminLocaleProvider lang={lang}>{children}</AdminLocaleProvider>
    </SiteDocument>
  );
}
