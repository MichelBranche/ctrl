import "@/components/ds/admin-ui.css";
import { AgendaCard, EcosystemHeader, QuotesCard } from "./view";
import { requireSection } from "@/lib/admin";
import { getAdminLocale } from "@/lib/admin-locale";
import { adminDict } from "@/lib/admin-i18n";
import { fetchQuotesMetrics } from "@/lib/ecosystem-metrics";

export default async function EcosistemaPage() {
  await requireSection("ecosistema");
  const [lang, quotes] = await Promise.all([getAdminLocale(), fetchQuotesMetrics()]);
  const t = adminDict[lang].ecosystem;
  return (
    <main className="eco">
      <EcosystemHeader t={t} />
      <div className="eco-grid">
        <QuotesCard t={t} result={quotes} />
        <AgendaCard t={t} />
      </div>
    </main>
  );
}
