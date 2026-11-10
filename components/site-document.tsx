import type { ReactNode } from "react";
import { PublicChrome } from "@/components/public-chrome";
import { JsonLd } from "@/components/seo/json-ld";
import { geist, satoshi } from "@/app/fonts";
import { organizationGraph } from "@/lib/seo";
import type { Locale } from "@/lib/i18n";

export function SiteDocument({ lang, jsonLd = true, children }: { lang: Locale; jsonLd?: boolean; children: ReactNode }) {
  return (
    <html lang={lang} suppressHydrationWarning className={`js pt-booting ${geist.variable} ${satoshi.variable}`}>
      <body className={geist.className}>
        <noscript>
          <style>{".pt-root[data-boot]{display:none!important}"}</style>
        </noscript>
        {jsonLd ? <JsonLd data={organizationGraph()} /> : null}
        <PublicChrome slot="before" />
        {children}
        <PublicChrome slot="after" />
      </body>
    </html>
  );
}
