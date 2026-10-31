"use client";

import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { CtrlAssistant } from "@/components/ctrl-assistant";
import { CommandMenu } from "@/components/command-menu";
import { PageTransition } from "@/components/page-transition";
import { BackToTop } from "@/components/back-to-top";
import { Micro } from "@/components/micro";
import { ScrollProgress } from "@/components/scroll-progress";
import { SmoothScroll } from "@/components/smooth-scroll";
import { ScrollReveal } from "@/components/scroll-reveal";

/**
 * Every public-site widget lives behind this one gate, so nothing from the
 * visitor experience (smooth scroll, transition cover, mascot, floating
 * buttons, command menu, analytics) ever mounts inside /admin.
 */
export function PublicChrome({ slot }: { slot: "before" | "after" }) {
  const pathname = usePathname() ?? "/";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return slot === "before" ? (
    <>
      <SmoothScroll />
      <BackToTop />
      <Micro />
      <ScrollProgress />
      <CommandMenu />
    </>
  ) : (
    <>
      <ScrollReveal />
      <PageTransition />
      <CtrlAssistant />
      <Analytics />
    </>
  );
}
