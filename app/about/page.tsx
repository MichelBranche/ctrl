import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "About",
  description:
    "CTRL® is an independent creative technology studio for identity, digital products and visual communication.",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="subpage">
        <p className="kicker">About</p>
        <h1>
          An independent studio
          <br />
          for brands that want
          <br />a sharper presence.
        </h1>
        <div className="subpage-copy">
          <p>
            We&apos;re CTRL®, an independent studio that combines design,
            software development and visual communication, helping brands go
            from identity to digital products and beyond.
          </p>
          <p>
            Un unico partner per progettare, costruire e far evolvere la
            presenza digitale di un&apos;azienda. Dall&apos;identità visiva ai
            prodotti digitali, uniamo creatività, tecnologia e strategia per
            creare esperienze che lasciano il segno.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
