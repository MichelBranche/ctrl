import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Notes from CTRL® on design, digital products and visual communication.",
};

const notes = [
  {
    index: "01",
    title: "Identity before interface",
    text: "Un prodotto digitale regge solo se il linguaggio visivo è già chiaro. Prima il segno, poi lo schermo.",
  },
  {
    index: "02",
    title: "Build it so it can change",
    text: "La presenza di un brand non è un lancio. È un sistema che deve poter evolvere senza perdere la voce.",
  },
  {
    index: "03",
    title: "Quiet pictures, exact type",
    text: "La fotografia tiene il luogo. La tipografia tiene il significato. Insieme fanno il tono.",
  },
];

export default function JournalPage() {
  return (
    <>
      <SiteHeader />
      <main className="subpage">
        <p className="kicker">Journal</p>
        <h1>
          Field notes on design,
          <br />
          product and image.
        </h1>
        <ol className="notes">
          {notes.map((note) => (
            <li key={note.index}>
              <span>{note.index}</span>
              <div>
                <h2>{note.title}</h2>
                <p>{note.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/#work" className="text-link">
          Explore our work
          <ArrowIcon />
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
