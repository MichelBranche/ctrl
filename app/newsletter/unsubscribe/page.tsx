import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { UnsubscribeForm } from "@/components/journal/unsubscribe-form";
import "@/components/journal/journal.css";

export const metadata: Metadata = { title: "Newsletter · CTRL®", robots: { index: false, follow: false } };

/** Target of the unsubscribe link in each newsletter. GET only shows a button, so link scanners cannot unsubscribe anyone. */
export default function Page({ searchParams }: PageProps<"/newsletter/unsubscribe">) {
  return (
    <>
      <SiteHeader />
      <main className="j-root j-article">
        <header className="j-a-head">
          <h1 className="j-a-title">Newsletter</h1>
          <Suspense fallback={null}>
            <Token searchParams={searchParams} />
          </Suspense>
        </header>
      </main>
      <SiteFooter />
    </>
  );
}

async function Token({ searchParams }: { searchParams: PageProps<"/newsletter/unsubscribe">["searchParams"] }) {
  const { token } = await searchParams;
  return <UnsubscribeForm token={typeof token === "string" ? token : ""} />;
}
