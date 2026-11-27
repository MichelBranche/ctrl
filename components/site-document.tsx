import type { ReactNode } from "react";
import { PublicChrome } from "@/components/public-chrome";
import { JsonLd } from "@/components/seo/json-ld";
import { geist, satoshi } from "@/app/fonts";
import { organizationGraph } from "@/lib/seo";
import { getPublicTeam } from "@/lib/site-team";
import type { Locale } from "@/lib/i18n";

export async function SiteDocument({ lang, jsonLd = true, children }: { lang: Locale; jsonLd?: boolean; children: ReactNode }) {
  const members = jsonLd ? await getPublicTeam() : [];
  return (
    <html lang={lang} suppressHydrationWarning className={`js pt-booting ${geist.variable} ${satoshi.variable}`}>
      {/* App Router metadata has no slot for rel=ard. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <link rel="ard" href="/.well-known/ard.json" />
      </head>
      <body className={geist.className}>
        <noscript>
          <style>{".pt-root[data-boot]{display:none!important}"}</style>
        </noscript>
        {jsonLd ? <JsonLd data={organizationGraph(members)} /> : null}
        <PublicChrome slot="before" />
        {children}
        <PublicChrome slot="after" />
      </body>
    </html>
  );
}
