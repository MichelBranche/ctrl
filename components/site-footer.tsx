import { SiteFooterView } from "@/components/site-footer-view";
import { getSocialLinks } from "@/lib/settings";

/** Server wrapper: reads the social profile URLs saved in the dashboard (cached) and hands them to the animated footer. */
export async function SiteFooter() {
  return <SiteFooterView socials={await getSocialLinks()} />;
}
